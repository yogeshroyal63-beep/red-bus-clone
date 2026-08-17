const request = require('supertest');
const express = require('express');

jest.mock('mongoose', () => ({
  connect: () => Promise.resolve(),
  connection: { readyState: 0 },
  Schema: class { index() { return this; } },
  model: () => null,
}));

// community.js applies real express-rate-limit middleware (postLimiter: 10/hr,
// reportLimiter: 10/min) to protect production traffic. Left un-mocked, this whole
// file's cumulative POST calls (creation + report + moderation tests, run against one
// shared in-process app instance) can exceed that budget mid-suite — the excess
// requests 429, and the existing `if (!id) return;` defensive pattern used throughout
// these tests means a budget-exhausted test silently no-ops instead of failing, so a
// green checkmark doesn't actually mean the behavior was exercised. Rate limiting
// itself is a separate, already-covered concern (security.js), not what these
// functional tests are for, so it's mocked to a passthrough here — matching how
// auth.middleware and mongoose are already mocked below for the same reason.
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../middleware/auth.middleware', () => ({
  // Tests can simulate a distinct caller via X-Test-Userid, needed to exercise the
  // self-like guard (Finding H) — liking your own post now correctly 403s, so the like
  // test needs a second identity distinct from whoever created the post.
  verifyToken: (req, res, next) => { req.userId = req.headers['x-test-userid'] || 'test-user'; req.userName = 'Test User'; next(); },
  optionalAuth: (req, res, next) => { req.userId = req.headers['x-test-userid'] || 'test-user'; req.userName = 'Test User'; next(); },
}));

// requireAdmin (middleware/admin.js) reads ADMIN_USER_IDS off process.env once, at
// module-require time, so this must be set BEFORE requiring the router below — see
// notifications.test.js for the same pattern. 'test-user' matches the default
// X-Test-Userid fallback in the verifyToken mock above, so requests with no explicit
// header are treated as the admin.
process.env.ADMIN_USER_IDS = 'test-user';

const communityRouter = require('./community');
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.dbConnected = false; next(); });
app.use('/api/community', communityRouter);

const validPost = {
  title: 'My first overnight bus trip experience',
  content: 'The journey from Bangalore to Mumbai was absolutely wonderful. Comfortable sleeper berths and great service.',
  category: 'story',
  tags: ['BusTrip', 'Mumbai'],
  userName: 'TestUser',
  // requireVerifiedJourney (added to lock posting down to riders with a real
  // completed journey) needs a PNR matching the real generator shape:
  // 'RB' + 10 uppercase hex chars. Without dbConnected this is a format-only
  // check, so any PNR of the right shape passes here.
  bookingPnr: 'RB1A2B3C4D5E'
};

describe('Community Routes', () => {
  it('GET /api/community/posts — returns empty array initially', async () => {
    const res = await request(app).get('/api/community/posts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/community/forums — returns forum list', async () => {
    const res = await request(app).get('/api/community/forums');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('POST /api/community/posts — creates a post', async () => {
    const res = await request(app).post('/api/community/posts').send(validPost);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe(validPost.title);
    expect(res.body.data.visible).toBe(true);
  });

  it('POST /api/community/posts — rejects short title', async () => {
    const res = await request(app).post('/api/community/posts').send({ ...validPost, title: 'Hi' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST /api/community/posts — rejects invalid category', async () => {
    const res = await request(app).post('/api/community/posts').send({ ...validPost, category: 'spam' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST /api/community/posts/:id/like — toggles like', async () => {
    const post = await request(app).post('/api/community/posts').send(validPost);
    const id = post.body.data?.id;
    if (!id) return;
    // Finding H: self-liking is rejected — like as a different user than the author
    const res = await request(app).post(`/api/community/posts/${id}/like`).set('X-Test-Userid', 'a-different-user');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('likes');
  });

  it("POST /api/community/posts/:id/like — rejects liking your own post (Finding H)", async () => {
    const post = await request(app).post('/api/community/posts').send(validPost);
    const id = post.body.data?.id;
    if (!id) return;
    const res = await request(app).post(`/api/community/posts/${id}/like`);
    expect(res.status).toBe(403);
  });

  it('POST /api/community/posts/:id/comments — adds a comment (with a verified-journey PNR)', async () => {
    const post = await request(app).post('/api/community/posts').send(validPost);
    const id = post.body.data?.id;
    if (!id) return;
    // Finding #8: comments are now verification-gated the same as posts — needs a PNR
    // of the correct shape (format-only check since dbConnected=false in this suite).
    const res = await request(app).post(`/api/community/posts/${id}/comments`).send({ text: 'Great post!', bookingPnr: 'RB1A2B3C4D5E' });
    expect(res.status).toBe(201);
    expect(res.body.data.text).toBe('Great post!');
  });

  it('POST /api/community/posts/:id/comments — rejects without a valid PNR (Finding #8)', async () => {
    const post = await request(app).post('/api/community/posts').send(validPost);
    const id = post.body.data?.id;
    if (!id) return;
    const res = await request(app).post(`/api/community/posts/${id}/comments`).send({ text: 'Great post!' });
    expect(res.status).toBe(403);
  });

  it('POST /api/community/posts/:postId/comments/:commentId/like — likes a comment (Finding H)', async () => {
    const post = await request(app).post('/api/community/posts').send(validPost);
    const postId = post.body.data?.id;
    if (!postId) return;
    const comment = await request(app).post(`/api/community/posts/${postId}/comments`)
      .set('X-Test-Userid', 'comment-author')
      .send({ text: 'Nice trip!', bookingPnr: 'RB1A2B3C4D5E' });
    const commentId = comment.body.data?.id;
    if (!commentId) return;
    const res = await request(app).post(`/api/community/posts/${postId}/comments/${commentId}/like`).set('X-Test-Userid', 'a-liker');
    expect(res.status).toBe(200);
    expect(res.body.likes).toBe(1);
  });

  it("POST /api/community/posts/:postId/comments/:commentId/like — rejects liking your own comment (Finding H)", async () => {
    const post = await request(app).post('/api/community/posts').send(validPost);
    const postId = post.body.data?.id;
    if (!postId) return;
    const comment = await request(app).post(`/api/community/posts/${postId}/comments`)
      .set('X-Test-Userid', 'self-commenter')
      .send({ text: 'My own comment', bookingPnr: 'RB1A2B3C4D5E' });
    const commentId = comment.body.data?.id;
    if (!commentId) return;
    const res = await request(app).post(`/api/community/posts/${postId}/comments/${commentId}/like`).set('X-Test-Userid', 'self-commenter');
    expect(res.status).toBe(403);
  });

  it('POST /api/community/posts/:id/report — increments report count', async () => {
    const post = await request(app).post('/api/community/posts').send(validPost);
    const id = post.body.data?.id;
    if (!id) return;
    const res = await request(app).post(`/api/community/posts/${id}/report`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/community/posts?category=tip — filters by category', async () => {
    await request(app).post('/api/community/posts').send({ ...validPost, category: 'tip' });
    const res = await request(app).get('/api/community/posts?category=tip');
    expect(res.status).toBe(200);
    expect(res.body.data.every((p) => p.category === 'tip')).toBe(true);
  });

  it("POST /api/community/posts/:id/moderate — action:'delete' permanently removes the post", async () => {
    const post = await request(app).post('/api/community/posts').send(validPost);
    const id = post.body.data?.id;
    if (!id) return;

    const res = await request(app).post(`/api/community/posts/${id}/moderate`).send({ action: 'delete' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, deleted: true, id });

    // Really gone, not just hidden — even an admin re-fetch of the feed shouldn't see it.
    const listing = await request(app).get('/api/community/posts');
    expect(listing.body.data.some(p => p.id === id)).toBe(false);

    // And a second delete now 404s, since there's nothing left to delete.
    const again = await request(app).post(`/api/community/posts/${id}/moderate`).send({ action: 'delete' });
    expect(again.status).toBe(404);
  });

  it('POST /api/community/posts/:id/moderate — rejects an unrecognized action', async () => {
    const post = await request(app).post('/api/community/posts').send(validPost);
    const id = post.body.data?.id;
    if (!id) return;
    const res = await request(app).post(`/api/community/posts/${id}/moderate`).send({ action: 'ban' });
    expect(res.status).toBe(400);
  });

  it('POST /api/community/posts/:id/moderate — non-admin caller is rejected (Finding #25)', async () => {
    const post = await request(app).post('/api/community/posts').send(validPost);
    const id = post.body.data?.id;
    if (!id) return;
    const res = await request(app).post(`/api/community/posts/${id}/moderate`)
      .set('X-Test-Userid', 'not-an-admin')
      .send({ action: 'delete' });
    expect(res.status).toBe(403);
  });
});
