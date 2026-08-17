const request = require('supertest');
const express = require('express');

// Minimal fake Mongoose models — exercises the req.dbConnected=true branch in
// reviews.js (the real-persistence + Bus.rating-sync path added in the audit
// fix) without needing a real MongoDB connection.
let seq = 0;
function makeFakeReviewModel() {
  const store = [];

  class FakeReview {
    constructor(data) {
      Object.assign(this, data, {
        _id: `rdb_${++seq}`, upvotes: 0, helpful: [], reported: false,
        reportCount: 0, visible: true, verified: true, createdAt: new Date()
      });
    }
    async save() {
      const idx = store.findIndex(r => r._id === this._id);
      if (idx > -1) store[idx] = this; else store.push(this);
      return this;
    }
    toObject() { return { ...this }; }
  }

  FakeReview.find = (filter = {}) => {
    let results = store.filter(r =>
      (!filter.busId || r.busId === filter.busId) &&
      (filter.visible === undefined || r.visible === filter.visible)
    );
    const api = {
      sort: () => api,
      select: () => api,
      then: (resolve) => resolve(results),
    };
    return api;
  };
  FakeReview.findOne = async (filter) =>
    store.find(r => r.busId === filter.busId && r.userId === filter.userId && r.bookingPnr === filter.bookingPnr) || null;
  FakeReview.findById = async (id) => store.find(r => r._id === id) || null;
  FakeReview.findByIdAndDelete = async (id) => {
    const idx = store.findIndex(r => r._id === id);
    if (idx === -1) return null;
    const [removed] = store.splice(idx, 1);
    return removed;
  };

  return FakeReview;
}

function makeFakeBusModel() {
  const busUpdates = {};
  const FakeBus = { updates: busUpdates };
  FakeBus.findByIdAndUpdate = async (id, patch) => { busUpdates[id] = { ...(busUpdates[id] || {}), ...patch }; return busUpdates[id]; };
  return FakeBus;
}

const mockReviewModel = makeFakeReviewModel();
const mockBusModel = makeFakeBusModel();
jest.mock('../models/Review', () => mockReviewModel);
jest.mock('../models/Bus', () => mockBusModel);

// This file's cumulative POST /api/reviews (creation) calls sit right at
// reviewLimiter's 5/hr budget already — one more test added here without this mock
// would silently start 429-ing. Mocked to a passthrough for the same reason it's
// mocked in reviews.test.js: rate limiting is a separate, already-covered concern
// (security.js), not what these functional tests are for.
jest.mock('express-rate-limit', () => () => (req, res, next) => next());
jest.mock('../models/Booking', () => ({
  // userId must match the authenticated req.userId ('test-user' per the auth mock below)
  // and the journey date must be in the past — both are now enforced by
  // verification.js (fixes for the guest-PNR bypass and the "never actually checks the
  // journey happened" findings). date is deliberately last year so "journey completed"
  // holds regardless of when this suite runs.
  findOne: async ({ pnr }) => (pnr && pnr.startsWith('RBDB')) ? { pnr, status: 'confirmed', userId: 'test-user', date: '2020-01-01' } : null,
}));

jest.mock('../middleware/auth.middleware', () => ({
  // Tests can simulate distinct callers via the X-Test-Userid header (falls back to a
  // fixed id) — needed to exercise the per-reporter dedup in Finding #4's report-bombing
  // fix, since a single request identity can now only contribute one report count.
  verifyToken: (req, res, next) => { req.userId = req.headers['x-test-userid'] || 'test-user'; next(); },
  optionalAuth: (req, res, next) => { req.userId = req.headers['x-test-userid'] || 'test-user'; next(); },
}));

// requireAdmin (middleware/admin.js) reads ADMIN_USER_IDS off process.env once, at
// module-require time, so this must be set BEFORE requiring the router below — see
// notifications.test.js for the same pattern. 'test-user' matches the default
// X-Test-Userid fallback above, so requests with no explicit header are the admin.
process.env.ADMIN_USER_IDS = 'test-user';

const reviewsRouter = require('./reviews');
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.dbConnected = true; next(); }); // <-- the branch under test
app.use('/api/reviews', reviewsRouter);

const validReview = {
  busId: 'busX', rating: 4,
  text: 'Solid overnight journey, the seats reclined well and the AC worked the whole way through.',
  journeyDate: '2026-07-20',
  bookingPnr: 'RBDBAA11BB22'
};

describe('Reviews Routes — dbConnected=true (Mongoose path)', () => {
  it('POST /api/reviews — persists via the Review model and syncs Bus.rating', async () => {
    const res = await request(app).post('/api/reviews').send(validReview);
    expect(res.status).toBe(201);
    expect(res.body.data.id).toMatch(/^rdb_/); // proves it came from the fake Mongoose model
    expect(mockBusModel.updates['busX']).toEqual({ rating: 4, reviews: 1 });
  });

  it('GET /api/reviews/:busId — reads back the real average from the model', async () => {
    const res = await request(app).get('/api/reviews/busX');
    expect(res.status).toBe(200);
    expect(res.body.avgRating).toBe(4);
    expect(res.body.count).toBe(1);
  });

  it('POST /api/reviews — duplicate PNR+bus+user is rejected via the DB findOne check', async () => {
    const res = await request(app).post('/api/reviews').send(validReview);
    expect(res.status).toBe(409);
  });

  it('POST /api/reviews/:id/report — 3 distinct reporters hide it and re-sync Bus.rating to 0', async () => {
    const created = await request(app).post('/api/reviews').send({ ...validReview, busId: 'busY', bookingPnr: 'RBDBCC33DD44' });
    const id = created.body.data.id;
    // Finding #4: report-bombing dedup — each reporter can only count once, so this
    // uses 3 distinct identities rather than one identity looping 3 times.
    for (const reporter of ['reporter-a', 'reporter-b', 'reporter-c']) {
      await request(app).post(`/api/reviews/${id}/report`).set('X-Test-Userid', reporter);
    }
    expect(mockBusModel.updates['busY']).toEqual({ rating: 0, reviews: 0 });
  });

  it('POST /api/reviews/:id/report — the same reporter calling repeatedly only counts once', async () => {
    const created = await request(app).post('/api/reviews').send({ ...validReview, busId: 'busZ', bookingPnr: 'RBDBEE55FF66' });
    const id = created.body.data.id;
    for (let i = 0; i < 5; i++) {
      await request(app).post(`/api/reviews/${id}/report`).set('X-Test-Userid', 'same-reporter');
    }
    // Still visible — one reporter, however many times they call it, is one report.
    expect(mockBusModel.updates['busZ']).toEqual({ rating: 4, reviews: 1 });
  });

  it("POST /api/reviews/:id/moderate — action:'delete' removes it from the Review model and re-syncs Bus.rating", async () => {
    const created = await request(app).post('/api/reviews').send({ ...validReview, busId: 'busDelete', bookingPnr: 'RBDBAABBCCDD' });
    const id = created.body.data.id;

    const res = await request(app).post(`/api/reviews/${id}/moderate`).send({ action: 'delete' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, deleted: true, id });

    expect(await mockReviewModel.findById(id)).toBeNull();
    expect(mockBusModel.updates['busDelete']).toEqual({ rating: 0, reviews: 0 });

    const again = await request(app).post(`/api/reviews/${id}/moderate`).send({ action: 'delete' });
    expect(again.status).toBe(404);
  });
});
