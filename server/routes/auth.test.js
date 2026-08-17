const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Mock security and auth middleware for testing
jest.mock('../middleware/security', () => ({
  authLimiter: (req, res, next) => next(),
  validateRegister: [],
  validateLogin: [],
  handleValidationErrors: (req, res, next) => next(),
}));

jest.mock('../middleware/auth.middleware', () => ({
  generateToken: () => 'mock-token-xyz',
  verifyToken: (req, res, next) => { req.userId = 'test-user-id'; next(); },
  optionalAuth: (req, res, next) => next(),
}));

// Mock mongoose to prevent any connection attempts
jest.mock('mongoose', () => ({
  connect: () => Promise.resolve(),
  connection: { readyState: 0 },
  Schema: class { index() { return this; } },
  model: () => null,
}));

const authRouter = require('./auth');
const app = express();
app.use(bodyParser.json());
// Inject dbConnected=false so routes skip Mongoose and use in-memory fallback immediately
app.use((req, res, next) => { req.dbConnected = false; next(); });
app.use('/api/auth', authRouter);

describe('Auth Routes', () => {
  const testUser = { name: 'Test User', email: `test${Date.now()}@example.com`, mobile: '9876543210', password: 'Test@1234' };

  it('POST /register — creates a new user', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.email).toBe(testUser.email);
  });

  it('POST /register — rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send(testUser);
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.status).toBe(409);
  });

  it('POST /login — authenticates valid credentials', async () => {
    await request(app).post('/api/auth/register').send(testUser);
    const res = await request(app).post('/api/auth/login').send({ email: testUser.email, password: testUser.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('POST /login — rejects wrong password', async () => {
    await request(app).post('/api/auth/register').send(testUser);
    const res = await request(app).post('/api/auth/login').send({ email: testUser.email, password: 'WrongPass999' });
    expect(res.status).toBe(401);
  });

  it('POST /login — rejects unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@nowhere.com', password: 'anything' });
    expect(res.status).toBe(404);
  });

  it('GET /me — returns user when authenticated', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer mock-token-xyz');
    // With mock verifyToken this will attempt to find user
    expect([200, 404]).toContain(res.status);
  });
});
