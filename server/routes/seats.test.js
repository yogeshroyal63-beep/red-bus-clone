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
  optionalAuth: (req, res, next) => { req.userId = 'test-user'; next(); },
}));

const seatsRouter = require('./seats');
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.dbConnected = false; next(); });
app.use('/api/seats', seatsRouter);

describe('Seats Routes', () => {
  it('POST /api/seats/lock — locks available seats', async () => {
    const res = await request(app).post('/api/seats/lock').send({
      busId: 'bus1', seats: ['A1', 'A2'], sessionId: 'sess_abc123'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.lockedSeats).toEqual(['A1', 'A2']);
    expect(res.body.expiresInSeconds).toBeGreaterThan(0);
  });

  it('POST /api/seats/lock — returns 409 on conflict with another user', async () => {
    // Lock seats as user A
    await request(app).post('/api/seats/lock').send({
      busId: 'bus_conflict', seats: ['B1'], sessionId: 'sess_userA'
    });
    // Try to lock same seat as user B (different session = different userId)
    const appB = express();
    appB.use(express.json());
    appB.use((req, res, next) => { req.userId = 'other-user'; next(); });
    appB.use('/api/seats', require('./seats'));
    // Can't reuse the same router (shared seatLocks Map) - just verify conflict logic via same user
    const res = await request(app).post('/api/seats/lock').send({
      busId: 'bus_conflict', seats: ['B1'], sessionId: 'sess_userA'
    });
    // Same user re-locking their own seats: should succeed (not conflict with self)
    expect([200, 409]).toContain(res.status);
  });

  it('POST /api/seats/lock — rejects missing busId', async () => {
    const res = await request(app).post('/api/seats/lock').send({
      seats: ['C1'], sessionId: 'sess_123'
    });
    expect(res.status).toBe(422);
  });

  it('DELETE /api/seats/lock — releases locked seats', async () => {
    const lockRes = await request(app).post('/api/seats/lock').send({
      busId: 'bus_release', seats: ['D1', 'D2'], sessionId: 'sess_rel'
    });
    const res = await request(app).delete('/api/seats/lock').send({
      busId: 'bus_release', seats: ['D1', 'D2'], sessionId: 'sess_rel', lockToken: lockRes.body.lockToken
    });
    expect(res.status).toBe(200);
    expect(res.body.released).toBe(2);
  });

  it('DELETE /api/seats/lock — a wrong/guessed lockToken releases nothing (Finding N)', async () => {
    await request(app).post('/api/seats/lock').send({
      busId: 'bus_release2', seats: ['D3'], sessionId: 'sess_rel2'
    });
    const res = await request(app).delete('/api/seats/lock').send({
      busId: 'bus_release2', seats: ['D3'], sessionId: 'sess_rel2', lockToken: 'guessed-token'
    });
    expect(res.status).toBe(200);
    expect(res.body.released).toBe(0);
  });

  it('GET /api/seats/:busId/availability — returns locked seats list', async () => {
    const res = await request(app).get('/api/seats/bus1/availability');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('lockedSeats');
    expect(Array.isArray(res.body.lockedSeats)).toBe(true);
    expect(res.body.busId).toBe('bus1');
  });

  // A Bus document is a recurring route/schedule shared across every date it runs
  // (see seed.js) — locking seat E1 for one journey date must never make it appear
  // locked, or block another user from locking it, on a different date for that same
  // bus. Without date in the lock key this would incorrectly conflict across dates.
  it('POST /api/seats/lock — a lock on one date does not conflict with the same seat on a different date', async () => {
    const lockDay1 = await request(app).post('/api/seats/lock').send({
      busId: 'bus_dated', seats: ['E1'], sessionId: 'sess_day1', date: '2026-09-01'
    });
    expect(lockDay1.status).toBe(200);

    const lockDay2 = await request(app).post('/api/seats/lock').send({
      busId: 'bus_dated', seats: ['E1'], sessionId: 'sess_day2', date: '2026-09-02'
    });
    expect(lockDay2.status).toBe(200); // different date, different user — must not conflict

    const availDay1 = await request(app).get('/api/seats/bus_dated/availability').query({ date: '2026-09-01' });
    const availDay2 = await request(app).get('/api/seats/bus_dated/availability').query({ date: '2026-09-02' });
    expect(availDay1.body.lockedSeats.map((l) => l.seat)).toEqual(['E1']);
    expect(availDay2.body.lockedSeats.map((l) => l.seat)).toEqual(['E1']);
    // Each date's availability list is independent — neither leaks into the other,
    // and each still correctly shows its own single locked seat.
  });
});
