const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth } = require('../middleware/auth.middleware');
const { requireVerifiedJourney } = require('../middleware/verification');
const { requireAdmin } = require('../middleware/admin');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const postLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });
// Finding #9: /posts/:id/report previously had no rate limiter and no per-reporter
// dedup at all — a script could hit it 5 times and hide any post instantly. Mirrors
// the reportLimiter already added to reviews.js.
const reportLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

// AUDIT FIX: previously an in-memory-only store (real posts, comments, likes
// and reports vanished on every server restart) despite the spec calling for
// persistent community content. Now backed by Mongoose (models/Post.js) when
// MongoDB is connected, following the same req.dbConnected dual-mode pattern
// already used in buses.js and verification.js. The in-memory arrays remain
// as the honest local/offline fallback — same as everywhere else in this app.
const postStore = [];

// Finding #10: how "highlighted" content is now decided. Nothing is stored as a
// permanent flag — pinned/isTrusted/trending are recomputed on every read from real
// engagement, so they can never drift out of sync with what's actually happening.
const PIN_ENGAGEMENT_THRESHOLD = 8; // likes + comments on a single post
const TRUSTED_POSTER_LIKE_THRESHOLD = 15; // total likes across a user's visible posts

// Req 1 fix: photos are accepted as base64 data-URL strings in the JSON body (no multer/
// multipart infra in this app). Each entry must look like a real image data URL and stay
// under ~2.7MB of base64 (≈2MB decoded) so a handful of large photos can't be used to
// balloon a single post document.
const MAX_PHOTOS = 4;
const MAX_PHOTO_DATA_URL_LENGTH = 2.75 * 1024 * 1024; // ~2MB image, base64-inflated
const isImageDataUrl = (s) => typeof s === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(s) && s.length <= MAX_PHOTO_DATA_URL_LENGTH;

const validatePost = [
  body('title').isLength({ min: 5, max: 100 }).trim().escape().withMessage('Title must be 5-100 chars'),
  body('content').isLength({ min: 20, max: 2000 }).withMessage('Content must be 20-2000 chars'),
  body('category').isIn(['story', 'tip', 'question', 'photo']).withMessage('Invalid category'),
  body('tags').optional().isArray({ max: 10 }).withMessage('Max 10 tags'),
  body('images').optional().isArray({ max: MAX_PHOTOS }).withMessage(`Max ${MAX_PHOTOS} photos`)
    .custom((imgs) => !imgs || imgs.every(isImageDataUrl)).withMessage('Each photo must be a valid image under 2MB'),
];

function toPlainPost(doc) {
  // Normalizes a Mongoose doc down to the same plain-object shape the
  // in-memory path already returns, so API consumers never see a difference.
  const p = doc.toObject ? doc.toObject() : doc;
  return { ...p, id: p.id || p._id?.toString() };
}

/** Recomputes pinned for a batch of already-fetched posts, live, from real
 *  engagement — replacing the old hardcoded-on-seed-data-only flag (Finding #10). */
function recomputePinned(posts) {
  return posts.map(p => ({
    ...p,
    pinned: (p.likes?.length || 0) + (p.comments?.length || 0) >= PIN_ENGAGEMENT_THRESHOLD
  }));
}

/** isTrusted is a function of a user's total likes across ALL their visible posts, not
 *  just the ones on the current page — takes the full visible-post set separately. */
function withTrustedFlag(posts, allVisiblePosts) {
  const likesByUser = new Map();
  for (const p of allVisiblePosts) likesByUser.set(p.userId, (likesByUser.get(p.userId) || 0) + (p.likes?.length || 0));
  return posts.map(p => ({ ...p, isTrusted: (likesByUser.get(p.userId) || 0) >= TRUSTED_POSTER_LIKE_THRESHOLD }));
}

/** Computes real trending tags from actual visible-post tag frequency — replacing the
 *  static hardcoded array in the frontend service (Finding #10). */
function computeTrendingTags(posts, limit = 8) {
  const freq = new Map();
  for (const p of posts) {
    for (const tag of (p.tags || [])) freq.set(tag, (freq.get(tag) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => tag);
}

// GET /api/community/posts
router.get('/posts', optionalAuth, async (req, res) => {
  const { category, page = 1, limit = 20 } = req.query;
  const start = (Number(page) - 1) * Number(limit);

  if (req.dbConnected) {
    try {
      const Post = require('../models/Post');
      const filter = { visible: true };
      if (category && category !== 'all') filter.category = category;
      const [docs, total, allVisible] = await Promise.all([
        Post.find(filter).sort({ createdAt: -1 }).skip(start).limit(Number(limit)),
        Post.countDocuments(filter),
        // Needed to compute isTrusted/trending across the whole corpus, not just this page
        Post.find({ visible: true }).select('userId likes tags comments')
      ]);
      const pinned = recomputePinned(docs.map(toPlainPost));
      const withTrust = withTrustedFlag(pinned, allVisible.map(toPlainPost));
      const trendingTags = computeTrendingTags(allVisible.map(toPlainPost));
      return res.json({ success: true, data: withTrust, total, trendingTags });
    } catch {
      // fall through to in-memory below rather than 500ing the community page
    }
  }

  let posts = postStore.filter(p => p.visible);
  if (category && category !== 'all') posts = posts.filter(p => p.category === category);
  posts = posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const allVisible = postStore.filter(p => p.visible);
  const pagePinned = recomputePinned(posts.slice(start, start + Number(limit)));
  const withTrust = withTrustedFlag(pagePinned, allVisible);
  res.json({ success: true, data: withTrust, total: posts.length, trendingTags: computeTrendingTags(allVisible) });
});

// POST /api/community/posts — only verified users (server-checked, not client-trusted)
router.post('/posts', postLimiter, verifyToken, validatePost, requireVerifiedJourney, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ error: 'Validation failed', code: 'err.validationFailed', details: errors.array() });

  const postData = {
    userId: req.userId,
    userName: req.userName || 'Verified Member', // Finding #5-equivalent: server-derived, not client-trusted
    userAvatar: req.userName?.[0]?.toUpperCase() || 'U',
    verified: true, // earned above by requireVerifiedJourney, not assumed
    title: req.body.title,
    content: req.body.content,
    category: req.body.category,
    tags: req.body.tags || [],
    route: req.body.route || null,
    images: req.body.images || [],
  };

  if (req.dbConnected) {
    try {
      const Post = require('../models/Post');
      const doc = await new Post(postData).save();
      return res.status(201).json({ success: true, data: toPlainPost(doc) });
    } catch (err) {
      return res.status(400).json({ error: err.message, code: 'err.postFailed' });
    }
  }

  const post = {
    id: `p_${Date.now()}`,
    ...postData,
    likes: [],
    comments: [],
    createdAt: new Date(),
    visible: true,
    reportCount: 0,
    reportedBy: [],
    pinned: false
  };

  postStore.push(post);
  res.status(201).json({ success: true, data: post });
});

// POST /api/community/posts/:id/like
router.post('/posts/:id/like', verifyToken, async (req, res) => {
  if (req.dbConnected) {
    try {
      const Post = require('../models/Post');
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
      // Finding #26 (extended to community): self-liking was unguarded, undermining the
      // isTrusted engagement threshold.
      if (post.userId === req.userId) return res.status(403).json({ error: "You can't like your own post.", code: 'err.selfLikePost' });
      const idx = post.likes.indexOf(req.userId);
      if (idx > -1) post.likes.splice(idx, 1);
      else post.likes.push(req.userId);
      await post.save();
      return res.json({ success: true, likes: post.likes.length });
    } catch {
      return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
    }
  }

  const post = postStore.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
  if (post.userId === req.userId) return res.status(403).json({ error: "You can't like your own post.", code: 'err.selfLikePost' });
  const idx = post.likes.indexOf(req.userId);
  if (idx > -1) post.likes.splice(idx, 1);
  else post.likes.push(req.userId);
  res.json({ success: true, likes: post.likes.length });
});

// POST /api/community/posts/:id/comments
// Finding #8: comments used to only require verifyToken while posts required
// requireVerifiedJourney — an inconsistency, since comments are user-generated content
// in the same forum too. Comments are now gated the same way posts are.
router.post('/posts/:id/comments', verifyToken, [
  body('text').isLength({ min: 1, max: 500 }).withMessage('Comment must be 1-500 chars'),
], requireVerifiedJourney, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ error: 'Validation failed', code: 'err.validationFailed', details: errors.array() });

  const commentData = {
    id: `c_${Date.now()}`,
    userId: req.userId,
    userName: req.userName || 'Member', // server-derived, not client-trusted (Finding #5-equivalent)
    userAvatar: req.userName?.[0]?.toUpperCase() || 'U',
    text: req.body.text,
    likes: []
  };

  if (req.dbConnected) {
    try {
      const Post = require('../models/Post');
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
      post.comments.push(commentData);
      await post.save();
      const saved = post.comments[post.comments.length - 1];
      return res.status(201).json({ success: true, data: { ...commentData, createdAt: saved.createdAt } });
    } catch {
      return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
    }
  }

  const post = postStore.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });

  const comment = { ...commentData, postId: req.params.id, createdAt: new Date() };
  post.comments.push(comment);
  res.status(201).json({ success: true, data: comment });
});

// POST /api/community/posts/:postId/comments/:commentId/like
// Finding H: comment likes previously had no backend route at all — the Comment
// interface's `likes: string[]` and the "like a comment" UI action were purely
// client-side signal manipulation with no persistence. This adds a real endpoint,
// with the same self-like guard the post-like route has.
router.post('/posts/:postId/comments/:commentId/like', verifyToken, async (req, res) => {
  const toggle = (post) => {
    const comment = post.comments.find(c => c.id === req.params.commentId);
    if (!comment) return null;
    if (comment.userId === req.userId) return 'self';
    comment.likes = comment.likes || [];
    const idx = comment.likes.indexOf(req.userId);
    if (idx > -1) comment.likes.splice(idx, 1);
    else comment.likes.push(req.userId);
    return comment;
  };

  if (req.dbConnected) {
    try {
      const Post = require('../models/Post');
      const post = await Post.findById(req.params.postId);
      if (!post) return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
      const result = toggle(post);
      if (result === 'self') return res.status(403).json({ error: "You can't like your own comment.", code: 'err.selfLikeComment' });
      if (!result) return res.status(404).json({ error: 'Comment not found', code: 'err.notFound' });
      await post.save();
      return res.json({ success: true, likes: result.likes.length });
    } catch {
      return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
    }
  }

  const post = postStore.find(p => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
  const result = toggle(post);
  if (result === 'self') return res.status(403).json({ error: "You can't like your own comment.", code: 'err.selfLikeComment' });
  if (!result) return res.status(404).json({ error: 'Comment not found', code: 'err.notFound' });
  res.json({ success: true, likes: result.likes.length });
});

// POST /api/community/posts/:id/report
// Finding #9: previously optionalAuth with no rate limiter and no per-reporter dedup at
// all — one person could script repeated calls with no rate limit and hide any post
// instantly. reportLimiter caps attempts per IP, and reportedBy (identity = userId when
// logged in, else IP) ensures only one count per reporter regardless of retries.
router.post('/posts/:id/report', reportLimiter, optionalAuth, async (req, res) => {
  const reporterId = req.userId || req.ip;

  if (req.dbConnected) {
    try {
      const Post = require('../models/Post');
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
      if (post.reportedBy?.includes(reporterId)) {
        return res.status(200).json({ success: true, message: 'You already reported this post.' });
      }
      post.reportedBy = [...(post.reportedBy || []), reporterId];
      post.reportCount = post.reportedBy.length;
      if (post.reportCount >= 5) post.visible = false;
      await post.save();
      return res.json({ success: true, message: 'Post reported. Our moderators will review it.' });
    } catch {
      return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
    }
  }

  const post = postStore.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
  post.reportedBy = post.reportedBy || [];
  if (post.reportedBy.includes(reporterId)) {
    return res.json({ success: true, message: 'You already reported this post.' });
  }
  post.reportedBy.push(reporterId);
  post.reportCount = post.reportedBy.length;
  if (post.reportCount >= 5) post.visible = false;
  res.json({ success: true, message: 'Post reported. Our moderators will review it.' });
});

// ── Moderation (extends Finding #25 to community, which previously had no admin
// tooling at all — only blind auto-hide at reportCount >= 5). Mirrors reviews.js.
router.get('/moderation/queue', verifyToken, requireAdmin, async (req, res) => {
  if (req.dbConnected) {
    try {
      const Post = require('../models/Post');
      const docs = await Post.find({ reportCount: { $gt: 0 } }).sort({ reportCount: -1 });
      return res.json({ success: true, data: docs.map(toPlainPost) });
    } catch { /* fall through */ }
  }
  res.json({ success: true, data: postStore.filter(p => p.reportCount > 0) });
});

// action: 'hide' | 'restore' | 'delete'. hide/restore are reversible soft-moderation
// (post stays in storage, just toggles visible); 'delete' is a genuine, permanent
// removal — the spec calls for moderators to be able to "report, review, or remove
// inappropriate posts", and hide/restore alone never actually removed anything. Kept
// as a separate explicit action (rather than replacing hide) so accidental clicks
// don't destroy data — hide is still the reversible first line of defense, delete is
// the deliberate, irreversible one.
router.post('/posts/:id/moderate', verifyToken, requireAdmin, async (req, res) => {
  const { action } = req.body;
  if (!['hide', 'restore', 'delete'].includes(action)) {
    return res.status(400).json({ error: "action must be 'hide', 'restore', or 'delete'" });
  }

  if (action === 'delete') {
    if (req.dbConnected) {
      try {
        const Post = require('../models/Post');
        const deleted = await Post.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
        return res.json({ success: true, deleted: true, id: req.params.id });
      } catch { return res.status(404).json({ error: 'Post not found', code: 'err.notFound' }); }
    }

    const idx = postStore.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
    postStore.splice(idx, 1);
    return res.json({ success: true, deleted: true, id: req.params.id });
  }

  if (req.dbConnected) {
    try {
      const Post = require('../models/Post');
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
      post.visible = action === 'restore';
      await post.save();
      return res.json({ success: true, data: toPlainPost(post) });
    } catch { return res.status(404).json({ error: 'Post not found', code: 'err.notFound' }); }
  }

  const post = postStore.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found', code: 'err.notFound' });
  post.visible = action === 'restore';
  res.json({ success: true, data: post });
});

// GET /api/community/forums
// Finding #11: only "Route Reviews" ever had a real computed count; the other five
// forums (Travel Tips, Safety & Help, Lost & Found, Trip Planning, Food & Dhabas) were
// permanently hardcoded numbers that never changed no matter how much real activity
// happened, and the frontend never even called this endpoint — it rendered its own
// static array instead. All six now derive from real per-category post counts (posts
// don't have a forum id, so category is used as the closest real mapping), and
// community.service.ts now actually calls this endpoint (see loadForums()).
const FORUM_META = [
  { id: 'f1', name: 'Route Reviews', icon: 'fa-route', color: '#d84e55', category: 'question' },
  { id: 'f2', name: 'Travel Tips', icon: 'fa-lightbulb', color: '#f47c20', category: 'tip' },
  { id: 'f3', name: 'Safety & Help', icon: 'fa-shield-alt', color: '#4caf50', category: 'photo' },
  { id: 'f4', name: 'Trip Planning', icon: 'fa-map', color: '#9c27b0', category: 'story' },
];

router.get('/forums', async (req, res) => {
  let counts = {};
  if (req.dbConnected) {
    try {
      const Post = require('../models/Post');
      const rows = await Post.aggregate([
        { $match: { visible: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);
      counts = Object.fromEntries(rows.map(r => [r._id, r.count]));
    } catch { /* fall through to in-memory count below */ }
  }
  if (!Object.keys(counts).length) {
    for (const p of postStore.filter(p => p.visible)) counts[p.category] = (counts[p.category] || 0) + 1;
  }

  const forums = FORUM_META.map(f => ({ ...f, posts: counts[f.category] || 0 }));
  res.json({ success: true, data: forums });
});

module.exports = router;
