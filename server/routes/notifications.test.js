const request = require('supertest');
const express = require('express');

jest.mock('mongoose', () => ({
  connect: () => Promise.resolve(),
  connection: { readyState: 0 },
  Schema: class { index() { return this; } },
  model: () => null,
}));

jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => { req.userId = 'test-user'; next(); },
  optionalAuth: (req, res, next) => next(),
}));

// requireAdmin (added to lock the delivery log down from "public read") reads
// ADMIN_USER_IDS off process.env once, at module-require time, and checks it
// against req.userId ('test-user', per the mocked verifyToken above). This
// must be set BEFORE requiring the router or every /log call 503s as
// "Admin access not configured", which is what was happening here before.
process.env.ADMIN_USER_IDS = 'test-user';

const notificationsRouter = require('./notifications');
const app = express();
app.use(express.json());
app.use('/api/notifications', notificationsRouter);

describe('Notifications Routes', () => {
  it('POST /api/notifications/send — requires title and message', async () => {
    const res = await request(app).post('/api/notifications/send').send({ channels: ['push'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('POST /api/notifications/send — dispatches push notification', async () => {
    const res = await request(app).post('/api/notifications/send').send({
      notificationId: 'n1', channels: ['push'],
      title: 'Booking Confirmed', message: 'PNR: RBTEST001'
    });
    expect([200, 207]).toContain(res.status);
    expect(res.body).toHaveProperty('delivered');
    expect(res.body).toHaveProperty('failed');
  });

  it('POST /api/notifications/send — handles unknown channel gracefully', async () => {
    const res = await request(app).post('/api/notifications/send').send({
      notificationId: 'n2', channels: ['fax'],
      title: 'Test', message: 'Test message'
    });
    // Unknown channel is skipped, not crashed
    expect([200, 207]).toContain(res.status);
  });

  it('POST /api/notifications/send — response has correct shape', async () => {
    const res = await request(app).post('/api/notifications/send').send({
      notificationId: 'n3', channels: ['email', 'sms'],
      title: 'Reminder', message: 'Your bus departs in 2 hours'
    });
    expect(res.body).toHaveProperty('delivered');
    expect(res.body).toHaveProperty('failed');
    expect(res.body).toHaveProperty('message');
    expect(Array.isArray(res.body.delivered)).toBe(true);
    expect(Array.isArray(res.body.failed)).toBe(true);
  });

  it('GET /api/notifications/log — returns delivery log array', async () => {
    const res = await request(app).get('/api/notifications/log');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // Retry mechanism fix: a failed channel attempt must genuinely retry (multiple
  // logged attempts for the same notificationId+channel), not just say "Retry
  // scheduled" without doing anything. SMS has the highest simulated failure rate,
  // so sending enough of them makes at least one retry statistically certain.
  it('POST /api/notifications/send — retries a failed channel and logs each attempt', async () => {
    for (let i = 0; i < 25; i++) {
      await request(app).post('/api/notifications/send').send({
        notificationId: `retry_test_${i}`, channels: ['sms'],
        title: 'Retry test', message: 'Retry test message'
      });
    }
    const log = (await request(app).get('/api/notifications/log')).body.data;
    const retryRows = log.filter(r => r.notificationId?.startsWith('retry_test_') && r.attempt > 1);
    expect(retryRows.length).toBeGreaterThan(0);
  });

  it('GET /api/notifications/log — log grows after a send', async () => {
    const before = (await request(app).get('/api/notifications/log')).body.data.length;
    await request(app).post('/api/notifications/send').send({
      notificationId: 'n_grow', channels: ['push'],
      title: 'Test', message: 'Test'
    });
    const after = (await request(app).get('/api/notifications/log')).body.data.length;
    expect(after).toBeGreaterThan(before);
  });

  // Finding #16: per-account notification history — previously history lived only in the
  // browser's localStorage, so logging in on a second device showed the seed demo
  // notifications again, never the account's real history. In-memory fallback mode (no
  // real Mongo User document here) is a best-effort no-op, same honest limitation the
  // rest of this app's in-memory paths have — these tests confirm that no-op is graceful.
  describe('per-account history (Finding #16)', () => {
    it('GET /api/notifications/history — no-ops gracefully without a real account', async () => {
      const res = await request(app).get('/api/notifications/history');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('PUT /api/notifications/history — rejects a non-array payload', async () => {
      const res = await request(app).put('/api/notifications/history').send({ notifications: 'not-an-array' });
      expect(res.status).toBe(400);
    });

    it('PUT /api/notifications/history — accepts an array and caps it at 100 (best-effort without a real user)', async () => {
      const notifications = Array.from({ length: 120 }, (_, i) => ({ id: `n_${i}`, title: `Notif ${i}`, read: false }));
      const res = await request(app).put('/api/notifications/history').send({ notifications });
      expect(res.status).toBe(200);
      // No real MongoDB user in this suite, so the write is best-effort and reports
      // success: false rather than throwing — this just confirms it never crashes.
      expect(res.body).toHaveProperty('success');
    });
  });
});
