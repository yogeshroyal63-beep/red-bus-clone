const request = require('supertest');
const express = require('express');

jest.mock('mongoose', () => ({
  connect: () => Promise.resolve(),
  connection: { readyState: 0 },
  Schema: class { index() { return this; } },
  model: () => null,
}));

jest.mock('../middleware/auth.middleware', () => ({
  generateToken: () => 'mock-token',
  verifyToken: (req, res, next) => { req.userId = 'test-user-id'; next(); },
  optionalAuth: (req, res, next) => { req.userId = 'test-user-id'; next(); },
}));

jest.mock('../middleware/security', () => ({
  bookingLimiter: (req, res, next) => next(),
  validateBooking: [],
  handleValidationErrors: (req, res, next) => next(),
  globalLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  validateRegister: [],
  validateLogin: [],
  helmetMiddleware: (req, res, next) => next(),
}));

const bookingsRouter = require('./bookings');
const seatsRouter = require('./seats');
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.dbConnected = false; next(); });
app.use('/api/bookings', bookingsRouter);
app.use('/api/seats', seatsRouter);

const validBooking = {
  busId: '1', busName: 'VRL Travels', from: 'Bangalore', to: 'Chennai',
  date: '2026-09-01', departureTime: '21:30', arrivalTime: '06:00',
  seats: ['1', '2'], totalAmount: 1300, boardingPoint: 'bp1', droppingPoint: 'dp1',
  paymentMethod: 'upi', contactEmail: 'test@test.com', contactPhone: '9876543210',
  passengerDetails: [{ name: 'Test Passenger 1', age: 30, gender: 'M' }, { name: 'Test Passenger 2', age: 28, gender: 'F' }],
  sessionId: 'test-session-1'
};

// Booking now requires a real, unexpired seat lock (Finding C) and the fare is
// recomputed server-side rather than trusting client totalAmount (Finding B) — so every
// "creates a booking" test locks the seats first and doesn't assert on a fixed amount.
async function lockThenBookingPayload(overrides = {}) {
  const lockRes = await request(app).post('/api/seats/lock').send({
    busId: overrides.busId || validBooking.busId,
    seats: overrides.seats || validBooking.seats,
    sessionId: overrides.sessionId || validBooking.sessionId,
  });
  return { ...validBooking, ...overrides, lockToken: lockRes.body.lockToken };
}

describe('Bookings Routes', () => {
  it('POST /api/bookings — creates a confirmed booking', async () => {
    const payload = await lockThenBookingPayload();
    const res = await request(app).post('/api/bookings').send(payload);
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pnr).toBeTruthy();
    expect(res.body.data.status).toBe('confirmed');
    // Server recomputes the fare from the bus's own real per-seat pricing (seat '1' =
    // 650+50=700, seat '2' = 650+100=750 — see generateSeats in routes/buses.js) rather
    // than trusting the client's totalAmount.
    expect(res.body.data.totalAmount).toBe(1450);
  });

  it('POST /api/bookings — rejects when the seats were never locked (Finding C)', async () => {
    const res = await request(app).post('/api/bookings').send({ ...validBooking, seats: ['3', '4'], lockToken: 'not-a-real-token' });
    expect(res.status).toBe(409);
  });

  it('POST /api/bookings — ignores a client-supplied totalAmount (Finding B)', async () => {
    const payload = await lockThenBookingPayload({ seats: ['5', '6'], totalAmount: 1 });
    const res = await request(app).post('/api/bookings').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).not.toBe(1);
    // seat '5' = 650+100=750, seat '6' = 650+0=650
    expect(res.body.data.totalAmount).toBe(1400);
  });

  it('POST /api/bookings — PNR starts with RB', async () => {
    const payload = await lockThenBookingPayload({ seats: ['7', '8'] });
    const res = await request(app).post('/api/bookings').send(payload);
    expect(res.body.data.pnr).toMatch(/^RB/);
  });

  it('GET /api/bookings/my — returns array for authenticated user', async () => {
    const res = await request(app).get('/api/bookings/my');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/bookings/my — returns correct shape after booking', async () => {
    const payload = await lockThenBookingPayload({ seats: ['9', '10'] });
    await request(app).post('/api/bookings').send(payload);
    const res = await request(app).get('/api/bookings/my');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    // count matches data array length
    expect(res.body.count).toBe(res.body.data.length);
  });
});
