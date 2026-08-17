const request = require('supertest');
const express = require('express');

// Minimal fake Mongoose model — exercises the req.dbConnected=true branch in
// community.js (the postLimiter-gated real-persistence path added in the
// audit fix) without needing a real MongoDB connection.
let seq = 0;
function makeFakePostModel() {
  const store = [];

  class FakePost {
    constructor(data) { Object.assign(this, data, { _id: `db_${++seq}`, likes: [], comments: [], visible: true, reportCount: 0 }); }
    async save() {
      const idx = store.findIndex(p => p._id === this._id);
      if (idx > -1) store[idx] = this; else store.push(this);
      return this;
    }
    toObject() { return { ...this }; }
  }

  FakePost.find = (filter = {}) => {
    let results = store.filter(p =>
      (filter.visible === undefined || p.visible === filter.visible) &&
      (!filter.category || p.category === filter.category)
    );
    const api = {
      sort: () => api,
      skip: (n) => { results = results.slice(n); return api; },
      limit: (n) => { results = results.slice(0, n); return api; },
      select: () => api,
      then: (resolve) => resolve(results),
    };
    return api;
  };
  FakePost.countDocuments = async (filter = {}) =>
    store.filter(p => filter.visible === undefined || p.visible === filter.visible).length;
  FakePost.findById = async (id) => store.find(p => p._id === id) || null;
  FakePost.findByIdAndDelete = async (id) => {
    const idx = store.findIndex(p => p._id === id);
    if (idx === -1) return null;
    const [removed] = store.splice(idx, 1);
    return removed;
  };
  // Minimal aggregate() supporting the one pipeline community.js actually uses:
  // $match on visible, $group by category with a count. Real Mongoose aggregate()
  // does far more; this only needs to cover the /forums route's real query shape.
  FakePost.aggregate = async (pipeline = []) => {
    let rows = store;
    const matchStage = pipeline.find(s => s.$match);
    if (matchStage?.$match?.visible !== undefined) {
      rows = rows.filter(p => p.visible === matchStage.$match.visible);
    }
    const groupStage = pipeline.find(s => s.$group);
    if (groupStage) {
      const counts = new Map();
      for (const p of rows) counts.set(p.category, (counts.get(p.category) || 0) + 1);
      return [...counts.entries()].map(([_id, count]) => ({ _id, count }));
    }
    return rows;
  };

  return FakePost;
}

const mockPostModel = makeFakePostModel();
jest.mock('../models/Post', () => mockPostModel);

// See the matching note in community.test.js — same postLimiter budget applies to this
// file's shared app instance, so it's mocked to a passthrough here too for consistency
// and to stay safe as this file grows more creation-heavy tests over time.
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

// requireVerifiedJourney (middleware/verification.js) also does a real DB
// lookup once req.dbConnected is true — without mocking Booking too, that
// call hangs forever waiting on a mongoose connection that doesn't exist in
// this test process (mongoose buffers commands by default). Mock it to
// confirm the one PNR our tests use.
jest.mock('../models/Booking', () => ({
  // userId must match req.userId ('test-user') and date must be in the past — see the
  // same note in reviews.db.test.js for why (guest-PNR-bypass + journey-completed fixes).
  findOne: async ({ pnr }) =>
    pnr === 'RB1A2B3C4D5E' ? { pnr, status: 'confirmed', userId: 'test-user', date: '2020-01-01' } : null,
}));

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
// X-Test-Userid fallback above, so requests with no explicit header are the admin.
process.env.ADMIN_USER_IDS = 'test-user';

const communityRouter = require('./community');
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.dbConnected = true; next(); }); // <-- the branch under test
app.use('/api/community', communityRouter);

const validPost = {
  title: 'A real persisted post for the DB path',
  content: 'This content is long enough to pass the 20-char minimum content validation rule easily.',
  category: 'story',
  tags: ['Test'],
  userName: 'DbTester',
  bookingPnr: 'RB1A2B3C4D5E'
};

describe('Community Routes — dbConnected=true (Mongoose path)', () => {
  it('POST /api/community/posts — persists via the Post model, not the in-memory array', async () => {
    const res = await request(app).post('/api/community/posts').send(validPost);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe(validPost.title);
    expect(res.body.data.id).toMatch(/^db_/); // proves it came from the fake Mongoose model, not postStore
  });

  it('GET /api/community/posts — reads back the persisted post', async () => {
    const res = await request(app).get('/api/community/posts');
    expect(res.status).toBe(200);
    expect(res.body.data.some(p => p.title === validPost.title)).toBe(true);
  });

  it('POST /api/community/posts/:id/like — toggles like on the persisted doc', async () => {
    const created = await request(app).post('/api/community/posts').send({ ...validPost, title: 'Second persisted post here' });
    const id = created.body.data.id;
    // Finding H: self-liking is rejected — like as a different user than the author
    const res = await request(app).post(`/api/community/posts/${id}/like`).set('X-Test-Userid', 'a-different-user');
    expect(res.status).toBe(200);
    expect(res.body.likes).toBe(1);
  });

  it('GET /api/community/forums — post count reflects real persisted count', async () => {
    const res = await request(app).get('/api/community/forums');
    // validPost.category is 'story', which FORUM_META maps to forum 'f4' (Trip Planning),
    // not 'f1' — both posts created above ('validPost' + its 'like' variant) count here.
    const tripPlanning = res.body.data.find(f => f.id === 'f4');
    expect(tripPlanning.posts).toBeGreaterThanOrEqual(2);
  });

  it("POST /api/community/posts/:id/moderate — action:'delete' removes it from the Post model, not just hides it", async () => {
    const created = await request(app).post('/api/community/posts').send({ ...validPost, title: 'A post bound for real deletion' });
    const id = created.body.data.id;

    const res = await request(app).post(`/api/community/posts/${id}/moderate`).send({ action: 'delete' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, deleted: true, id });

    expect(await mockPostModel.findById(id)).toBeNull();

    const again = await request(app).post(`/api/community/posts/${id}/moderate`).send({ action: 'delete' });
    expect(again.status).toBe(404);
  });
});
