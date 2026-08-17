const request = require('supertest');
const express = require('express');

jest.mock('mongoose', () => ({
  connect: () => Promise.resolve(),
  connection: { readyState: 0 },
  Schema: class { index() { return this; } },
  model: () => null,
}));

// reviews.js applies real express-rate-limit middleware (reviewLimiter: only 5/hr) to
// protect production traffic. Left un-mocked, this file's cumulative POST /api/reviews
// calls across all its tests — run against one shared in-process app instance — blow
// through that budget well before the file finishes, and the existing
// `if (!id) return;` defensive pattern used throughout these tests means a
// budget-exhausted test silently no-ops instead of failing, so a green checkmark
// doesn't actually mean the behavior was exercised. Verified empirically: without this
// mock, several tests in this file (including ones added for the moderate/delete fix)
// 429 and skip themselves silently. Rate limiting is a separate, already-covered
// concern (security.js), not what these functional tests are for, so it's mocked to a
// passthrough here — matching how auth.middleware and mongoose are already mocked
// below for the same reason.
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../middleware/auth.middleware', () => ({
  // Tests can simulate a distinct (non-admin) caller via X-Test-Userid, needed to
  // exercise the requireAdmin rejection path on /moderate — everything else in this
  // suite keeps calling as the fixed 'test-user' identity as before.
  verifyToken: (req, res, next) => { req.userId = req.headers['x-test-userid'] || 'test-user'; next(); },
  optionalAuth: (req, res, next) => { req.userId = req.headers['x-test-userid'] || 'test-user'; next(); },
}));

// requireAdmin (middleware/admin.js) reads ADMIN_USER_IDS off process.env once, at
// module-require time, so this must be set BEFORE requiring the router below — see
// notifications.test.js for the same pattern. 'test-user' matches the fixed userId
// the verifyToken mock above assigns to every request in this suite.
process.env.ADMIN_USER_IDS = 'test-user';

const reviewsRouter = require('./reviews');
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.dbConnected = false; next(); });
app.use('/api/reviews', reviewsRouter);

const validReview = {
  busId: 'bus1', rating: 5,
  text: 'Excellent journey! Comfortable seats and punctual departure. Highly recommend this operator to all travellers.',
  journeyDate: '2026-07-15',
  // requireVerifiedJourney checks this against the real PNR shape the app
  // generates: 'RB' + exactly 10 uppercase hex chars (see Booking.js /
  // verification.js). The previous fixture ('RBABCDE123', 8 chars) was
  // stale and failed that check, turning every test below into a 403.
  bookingPnr: 'RBABCDE12345'
};

describe('Reviews Routes', () => {
  it('GET /api/reviews/:busId — returns empty array for new busId', async () => {
    const res = await request(app).get('/api/reviews/bus_unknown');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.avgRating).toBe(0);
  });

  it('POST /api/reviews — creates a review with valid PNR', async () => {
    const res = await request(app).post('/api/reviews').send(validReview);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.busId).toBe('bus1');
    expect(res.body.data.verified).toBe(true);
  });

  it('POST /api/reviews — rejects review without PNR', async () => {
    const res = await request(app).post('/api/reviews').send({ ...validReview, bookingPnr: '' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST /api/reviews — prevents duplicate review for same bus+user', async () => {
    await request(app).post('/api/reviews').send({ ...validReview, busId: 'bus_dup' });
    const res = await request(app).post('/api/reviews').send({ ...validReview, busId: 'bus_dup' });
    expect(res.status).toBe(409);
  });

  it('POST /api/reviews/:id/report — increments report count', async () => {
    const post = await request(app).post('/api/reviews').send({ ...validReview, busId: 'bus_report' });
    const id = post.body.data?.id;
    if (!id) return; // skip if creation failed
    const res = await request(app).post(`/api/reviews/${id}/report`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/reviews/:id/helpful — toggles helpful vote', async () => {
    // Bug found while fixing this suite's rate-limiter coupling: with mocking removed,
    // this test started genuinely running instead of silently 429-skipping via
    // `if (!id) return;` — and immediately failed. Not an app bug: Finding #26 added a
    // self-upvote guard (a review's own author can't upvote it) after this test was
    // written, and the test upvoted as the same identity ('test-user', see verifyToken
    // mock above) that created the review, so it now correctly 403s under that guard.
    // The rate-limit silently skipping this test for who knows how long is exactly why
    // nobody caught the mismatch. Fixed by voting as a distinct user via X-Test-Userid,
    // same pattern already used elsewhere in this file for the moderate/non-admin test.
    const post = await request(app).post('/api/reviews').send({ ...validReview, busId: 'bus_helpful' });
    const id = post.body.data?.id;
    if (!id) return;
    const res = await request(app).post(`/api/reviews/${id}/helpful`).set('X-Test-Userid', 'a-different-voter');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('upvotes');
    expect(res.body.upvotes).toBe(1);
  });

  it("POST /api/reviews/:id/helpful — rejects upvoting your own review (Finding #26)", async () => {
    const post = await request(app).post('/api/reviews').send({ ...validReview, busId: 'bus_selfvote' });
    const id = post.body.data?.id;
    if (!id) return;
    const res = await request(app).post(`/api/reviews/${id}/helpful`);
    expect(res.status).toBe(403);
  });

  it("POST /api/reviews/:id/moderate — action:'delete' permanently removes the review", async () => {
    const post = await request(app).post('/api/reviews').send({ ...validReview, busId: 'bus_delete' });
    const id = post.body.data?.id;
    if (!id) return;

    const res = await request(app).post(`/api/reviews/${id}/moderate`).send({ action: 'delete' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, deleted: true, id });

    // Really gone, not just hidden — GET should no longer include it and the average
    // should re-sync back down as if it had never been submitted.
    const listing = await request(app).get('/api/reviews/bus_delete');
    expect(listing.body.data.some(r => r.id === id)).toBe(false);
    expect(listing.body.avgRating).toBe(0);

    // A second delete now 404s, since there's nothing left to delete.
    const again = await request(app).post(`/api/reviews/${id}/moderate`).send({ action: 'delete' });
    expect(again.status).toBe(404);
  });

  it('POST /api/reviews/:id/moderate — rejects an unrecognized action', async () => {
    const post = await request(app).post('/api/reviews').send({ ...validReview, busId: 'bus_badaction' });
    const id = post.body.data?.id;
    if (!id) return;
    const res = await request(app).post(`/api/reviews/${id}/moderate`).send({ action: 'ban' });
    expect(res.status).toBe(400);
  });

  it('POST /api/reviews/:id/moderate — non-admin caller is rejected (Finding #25)', async () => {
    const post = await request(app).post('/api/reviews').send({ ...validReview, busId: 'bus_nonadmin' });
    const id = post.body.data?.id;
    if (!id) return;
    const res = await request(app).post(`/api/reviews/${id}/moderate`)
      .set('X-Test-Userid', 'not-an-admin')
      .send({ action: 'delete' });
    expect(res.status).toBe(403);
  });
});
