const request = require('supertest');
const express = require('express');

// Prevent mongoose from attempting a real connection during tests
jest.mock('mongoose', () => ({
  connect: () => Promise.resolve(),
  connection: { readyState: 0 },
  Schema: class { index() { return this; } },
  model: () => null,
}));

// buses.js imports auth.middleware for the admin-only POST / route, and that module now
// throws at require-time if JWT_SECRET isn't set (a stricter, better version of the earlier
// fallback-secret fix — no dev default exists anymore). Every other route test file already
// mocks this; this file was missed, so `npm test` failed here even though buses.js itself was
// fine — same shape of mock as community.test.js/auth.test.js, not a real bug in the route.
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => { req.userId = req.headers['x-test-userid'] || 'test-admin'; next(); },
  optionalAuth: (req, res, next) => { req.userId = req.headers['x-test-userid'] || null; next(); },
}));

const busesRouter = require('./buses');

const app = express();
app.use(express.json());
// Inject dbConnected=false so routes skip Mongoose and use mock data immediately
app.use((req, res, next) => { req.dbConnected = false; next(); });
app.use('/api/buses', busesRouter);

describe('GET /api/buses/search', () => {
  it('returns 400 if from/to are missing', async () => {
    const res = await request(app).get('/api/buses/search');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns buses for valid from/to', async () => {
    const res = await request(app).get('/api/buses/search?from=Bangalore&to=Chennai&date=2026-08-15');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('returns empty for unknown route', async () => {
    const res = await request(app).get('/api/buses/search?from=Mars&to=Venus');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  it('returns all buses from GET /', async () => {
    const res = await request(app).get('/api/buses');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns a bus by valid ID', async () => {
    const res = await request(app).get('/api/buses/1');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data._id || res.body.data.id).toBeTruthy();
  });

  it('returns 404 for invalid ID', async () => {
    const res = await request(app).get('/api/buses/nonexistent999');
    expect(res.status).toBe(404);
  });
});
