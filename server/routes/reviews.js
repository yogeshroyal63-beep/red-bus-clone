const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth } = require('../middleware/auth.middleware');
const { requireVerifiedJourney } = require('../middleware/verification');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const reviewLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }); // 5 reviews/hr
// Finding #4: /report had no limiter at all — one person could script repeated calls
// with no dedup and hide anyone's review instantly. This caps report attempts per IP;
// combined with the per-reviewer dedup in reportedBy below, a single account/IP can no
// longer contribute more than one count toward hiding a review.
const reportLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

// AUDIT FIX: previously an in-memory-only store — reviews vanished on every
// restart, and separately, Bus.rating/Bus.reviews (shown on search results
// and bus cards) were static seed numbers never updated from real submitted
// reviews, so "calculate and display the average rating" only ever worked on
// this dedicated reviews panel, nowhere else in the app. Now backed by
// Mongoose (models/Review.js) when connected, same req.dbConnected pattern as
// buses.js/community.js, and recomputeBusRating() below keeps Bus.rating and
// Bus.reviews in sync after every create/edit/report so the rest of the app
// (which reads those two fields directly) reflects real review data too.
const reviewStore = [];

const validateReview = [
  body('busId').notEmpty().withMessage('busId required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('text').isLength({ min: 50, max: 1000 }).withMessage('Review must be 50-1000 characters'),
  body('journeyDate').isISO8601().withMessage('Valid journey date required'),
  body('bookingPnr').notEmpty().withMessage('Booking PNR required to verify journey'),
];

function toPlainReview(doc) {
  const r = doc.toObject ? doc.toObject() : doc;
  return { ...r, id: r.id || r._id?.toString() };
}

/** Recomputes Bus.rating (avg of visible reviews) and Bus.reviews (count) for one bus.
 *  Finding #3: this used to only ever touch the real Mongoose Bus collection, so in the
 *  (very common, no-MongoDB-configured) demo mode nothing ever reflected a real review —
 *  bus cards showed the same static 4.2/2841 forever. It now also updates the shared
 *  in-memory mock bus array (buses.js's mockBuses, which GET /api/buses/:id actually
 *  serves when the DB isn't connected), computed from whichever review store is live. */
async function recomputeBusRating(busId, dbConnected) {
  let avg = 0, count = 0;
  if (dbConnected) {
    try {
      const Review = require('../models/Review');
      const Bus = require('../models/Bus');
      const visible = await Review.find({ busId, visible: true }).select('rating');
      count = visible.length;
      avg = count ? visible.reduce((s, r) => s + r.rating, 0) / count : 0;
      await Bus.findByIdAndUpdate(busId, { rating: +avg.toFixed(1), reviews: count }).catch(() => {});
    } catch { /* non-fatal — fall through to also try the mock array below */ }
  } else {
    const visible = reviewStore.filter(r => r.busId === busId && r.visible);
    count = visible.length;
    avg = count ? visible.reduce((s, r) => s + r.rating, 0) / count : 0;
  }

  try {
    const { mockBuses } = require('./buses');
    const mockBus = mockBuses.find(b => b._id === String(busId));
    if (mockBus) { mockBus.rating = +avg.toFixed(1); mockBus.reviews = count; }
  } catch { /* non-fatal: rating sync is a nice-to-have, never block the review write itself */ }
}

// GET /api/reviews/:busId
router.get('/:busId', async (req, res) => {
  if (req.dbConnected) {
    try {
      const Review = require('../models/Review');
      const docs = await Review.find({ busId: req.params.busId, visible: true }).sort({ createdAt: -1 });
      const avg = docs.length ? docs.reduce((s, r) => s + r.rating, 0) / docs.length : 0;
      return res.json({ success: true, data: docs.map(toPlainReview), avgRating: +avg.toFixed(1), count: docs.length });
    } catch { /* fall through to in-memory */ }
  }

  const reviews = reviewStore
    .filter(r => r.busId === req.params.busId && r.visible)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  res.json({ success: true, data: reviews, avgRating: +avg.toFixed(1), count: reviews.length });
});

// POST /api/reviews — only verified users who completed the journey
router.post('/', reviewLimiter, verifyToken, validateReview, requireVerifiedJourney, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ error: 'Validation failed', code: 'err.validationFailed', details: errors.array() });

  const { busId, rating, text, journeyDate } = req.body;
  const bookingPnr = req.verifiedPnr; // set by requireVerifiedJourney, not the raw client value

  if (req.dbConnected) {
    try {
      const Review = require('../models/Review');
      // One review per JOURNEY, not per route — a rider who takes the same route
      // again on a different trip (different PNR) is allowed to review that trip too.
      const existing = await Review.findOne({ busId, userId: req.userId, bookingPnr });
      if (existing) return res.status(409).json({ error: 'You have already reviewed this journey.', code: 'err.alreadyReviewed' });

      // Finding #5: userName/userAvatar used to come straight from req.body — any
      // verified user could post under any display name they typed. Now derived from
      // the authenticated account's name, signed into the JWT at login (see
      // auth.middleware.js's generateToken), never client-suppliable per-request.
      const displayName = req.userName || 'Verified Traveller';
      const doc = await new Review({
        busId, userId: req.userId,
        userName: displayName,
        userAvatar: displayName[0]?.toUpperCase() || 'U',
        rating, text, journeyDate, bookingPnr
      }).save();

      await recomputeBusRating(busId, true);
      return res.status(201).json({ success: true, data: toPlainReview(doc) });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'You have already reviewed this journey.', code: 'err.alreadyReviewed' });
      return res.status(400).json({ error: err.message, code: 'err.reviewSubmitFailed' });
    }
  }

  const existing = reviewStore.find(r => r.busId === busId && r.userId === req.userId && r.bookingPnr === bookingPnr);
  if (existing) return res.status(409).json({ error: 'You have already reviewed this journey.', code: 'err.alreadyReviewed' });

  const displayName = req.userName || 'Verified Traveller';
  const review = {
    id: `r_${Date.now()}`,
    busId, userId: req.userId,
    userName: displayName,
    userAvatar: displayName[0]?.toUpperCase() || 'U',
    rating, text,
    journeyDate, bookingPnr,
    createdAt: new Date(),
    upvotes: 0, helpful: [],
    reported: false, reportCount: 0, reportedBy: [],
    visible: true, verified: true
  };

  reviewStore.push(review);
  // Previously only the DB branch kept Bus.rating/reviews in sync — the in-memory demo
  // path (the common case without MongoDB configured) never updated anything a bus card
  // could read (Finding #3).
  await recomputeBusRating(busId, false);
  res.status(201).json({ success: true, data: review });
});

// PUT /api/reviews/:id — edit within 24hrs only
router.put('/:id', verifyToken, [
  body('text').isLength({ min: 50, max: 1000 }),
  body('rating').isInt({ min: 1, max: 5 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ error: 'Validation failed', code: 'err.validationFailed', details: errors.array() });

  if (req.dbConnected) {
    try {
      const Review = require('../models/Review');
      const review = await Review.findById(req.params.id);
      if (!review) return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
      if (review.userId !== req.userId) return res.status(403).json({ error: 'Not your review', code: 'err.notYourReview' });

      const hoursElapsed = (Date.now() - review.createdAt.getTime()) / 3600000;
      if (hoursElapsed > 24) return res.status(403).json({ error: 'Edit window of 24 hours has passed.', code: 'err.editExpired' });

      review.text = req.body.text;
      review.rating = req.body.rating;
      review.editedAt = new Date();
      await review.save();
      await recomputeBusRating(review.busId, true);
      return res.json({ success: true, data: toPlainReview(review) });
    } catch {
      return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
    }
  }

  const review = reviewStore.find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
  if (review.userId !== req.userId) return res.status(403).json({ error: 'Not your review', code: 'err.notYourReview' });

  const hoursElapsed = (Date.now() - new Date(review.createdAt).getTime()) / 3600000;
  if (hoursElapsed > 24) return res.status(403).json({ error: 'Edit window of 24 hours has passed.', code: 'err.editExpired' });

  review.text = req.body.text;
  review.rating = req.body.rating;
  review.editedAt = new Date();

  res.json({ success: true, data: review });
});

// POST /api/reviews/:id/helpful
router.post('/:id/helpful', verifyToken, async (req, res) => {
  if (req.dbConnected) {
    try {
      const Review = require('../models/Review');
      const review = await Review.findById(req.params.id);
      if (!review) return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
      // Finding #26: self-voting was unguarded — a user could upvote their own review,
      // undermining TRUSTED_REVIEWER_UPVOTE_THRESHOLD's integrity.
      if (review.userId === req.userId) return res.status(403).json({ error: "You can't upvote your own review.", code: 'err.selfUpvoteReview' });
      const idx = review.helpful.indexOf(req.userId);
      if (idx > -1) { review.helpful.splice(idx, 1); review.upvotes--; }
      else { review.helpful.push(req.userId); review.upvotes++; }
      await review.save();
      return res.json({ success: true, upvotes: review.upvotes });
    } catch {
      return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
    }
  }

  const review = reviewStore.find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
  if (review.userId === req.userId) return res.status(403).json({ error: "You can't upvote your own review.", code: 'err.selfUpvoteReview' });
  const idx = review.helpful.indexOf(req.userId);
  if (idx > -1) { review.helpful.splice(idx, 1); review.upvotes--; }
  else { review.helpful.push(req.userId); review.upvotes++; }
  res.json({ success: true, upvotes: review.upvotes });
});

// POST /api/reviews/:id/report
// Findings #4: previously no rate limit and no dedup at all — a script could hit this
// 3+ times and hide any review instantly. reportLimiter caps attempts per IP, and
// reportedBy (identity = userId when logged in, else IP) ensures only one count per
// reporter regardless of how many times they call it.
router.post('/:id/report', reportLimiter, optionalAuth, async (req, res) => {
  const reporterId = req.userId || req.ip;

  if (req.dbConnected) {
    try {
      const Review = require('../models/Review');
      const review = await Review.findById(req.params.id);
      if (!review) return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
      if (review.reportedBy?.includes(reporterId)) {
        return res.status(200).json({ success: true, message: 'You already reported this review.' });
      }
      review.reportedBy = [...(review.reportedBy || []), reporterId];
      review.reportCount = review.reportedBy.length;
      if (review.reportCount >= 3) review.visible = false;
      await review.save();
      if (review.reportCount >= 3) await recomputeBusRating(review.busId, true);
      return res.json({ success: true, message: 'Review reported. Our team will review it shortly.' });
    } catch {
      return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
    }
  }

  const review = reviewStore.find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
  review.reportedBy = review.reportedBy || [];
  if (review.reportedBy.includes(reporterId)) {
    return res.json({ success: true, message: 'You already reported this review.' });
  }
  review.reportedBy.push(reporterId);
  review.reportCount = review.reportedBy.length;
  if (review.reportCount >= 3) { review.visible = false; await recomputeBusRating(review.busId, false); }
  res.json({ success: true, message: 'Review reported. Our team will review it shortly.' });
});

// ── Moderation (Finding #25): previously the only mechanism anywhere was blind
// auto-hide at reportCount >= 3 — no admin could inspect the report queue, reverse a
// bad hide, or manually remove something under threshold. These mirror the pattern
// notifications.js already used for its admin-gated log endpoint.
const { requireAdmin } = require('../middleware/admin');

// GET /api/reviews/moderation/queue — reviews that have been reported at all
router.get('/moderation/queue', verifyToken, requireAdmin, async (req, res) => {
  if (req.dbConnected) {
    try {
      const Review = require('../models/Review');
      const docs = await Review.find({ reportCount: { $gt: 0 } }).sort({ reportCount: -1 });
      return res.json({ success: true, data: docs.map(toPlainReview) });
    } catch { /* fall through */ }
  }
  res.json({ success: true, data: reviewStore.filter(r => r.reportCount > 0) });
});

// POST /api/reviews/:id/moderate — admin override: { action: 'hide' | 'restore' | 'delete' }
// hide/restore are reversible soft-moderation (review stays stored, just toggles
// visible); 'delete' is a genuine, permanent removal — the spec calls for moderators
// to be able to "report, review, or remove inappropriate" content, and hide/restore
// alone never actually removed anything. Kept as a separate explicit action (rather
// than replacing hide) so accidental clicks don't destroy data. Either way, Bus.rating
// and Bus.reviews are re-synced afterward since a deleted review must stop counting
// toward the average exactly like a hidden one does.
router.post('/:id/moderate', verifyToken, requireAdmin, async (req, res) => {
  const { action } = req.body;
  if (!['hide', 'restore', 'delete'].includes(action)) {
    return res.status(400).json({ error: "action must be 'hide', 'restore', or 'delete'" });
  }

  if (action === 'delete') {
    if (req.dbConnected) {
      try {
        const Review = require('../models/Review');
        const deleted = await Review.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
        await recomputeBusRating(deleted.busId, true);
        return res.json({ success: true, deleted: true, id: req.params.id });
      } catch { return res.status(404).json({ error: 'Review not found', code: 'err.notFound' }); }
    }

    const idx = reviewStore.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
    const [removed] = reviewStore.splice(idx, 1);
    await recomputeBusRating(removed.busId, false);
    return res.json({ success: true, deleted: true, id: req.params.id });
  }

  if (req.dbConnected) {
    try {
      const Review = require('../models/Review');
      const review = await Review.findById(req.params.id);
      if (!review) return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
      review.visible = action === 'restore';
      await review.save();
      await recomputeBusRating(review.busId, true);
      return res.json({ success: true, data: toPlainReview(review) });
    } catch { return res.status(404).json({ error: 'Review not found', code: 'err.notFound' }); }
  }

  const review = reviewStore.find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found', code: 'err.notFound' });
  review.visible = action === 'restore';
  await recomputeBusRating(review.busId, false);
  res.json({ success: true, data: review });
});

module.exports = router;
