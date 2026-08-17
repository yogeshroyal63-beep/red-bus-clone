const mongoose = require('mongoose');

// Mirrors the shape community.js was already building by hand for its
// in-memory postStore, so switching between the two modes (see community.js)
// produces identical JSON to API consumers either way.
const commentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  userId: String,
  userName: String,
  userAvatar: String,
  text: { type: String, required: true, minlength: 1, maxlength: 500 },
  likes: { type: [String], default: [] }
}, { timestamps: { createdAt: 'createdAt', updatedAt: false }, _id: false });

const postSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String, default: 'Verified Member' },
  userAvatar: String,
  verified: { type: Boolean, default: true }, // earned via requireVerifiedJourney, never client-trusted
  title: { type: String, required: true, minlength: 5, maxlength: 100, trim: true },
  content: { type: String, required: true, minlength: 20, maxlength: 2000 },
  category: { type: String, enum: ['story', 'tip', 'question', 'photo'], required: true },
  tags: { type: [String], default: [], validate: v => v.length <= 10 },
  route: { type: String, default: null },
  // Req 1 fix: the spec explicitly lists photos as a UGC type ("create posts... photos").
  // Stored as base64 data-URL strings (validated in community.js's validatePost) rather
  // than uploaded binary files, so no new file-storage/multer infra is required.
  images: { type: [String], default: [], validate: v => v.length <= 4 },
  likes: { type: [String], default: [] },
  comments: { type: [commentSchema], default: [] },
  visible: { type: Boolean, default: true },
  reportCount: { type: Number, default: 0 },
  // Finding #9: reportCount used to be a bare counter with no per-reporter dedup, so
  // one actor could script repeated calls and hide any post instantly. Mirrors
  // reviews.js's reportedBy pattern: identity = userId when logged in, else IP.
  reportedBy: { type: [String], default: [] },
  // Finding #10: pinned/isTrusted used to be permanently hardcoded true on exactly the
  // 4 seed posts and never computed for real content. They're now recomputed live from
  // real engagement (see recomputeEngagementFlags in community.js) instead of being
  // stored as a fixed flag that can drift out of sync with actual likes/comments.
  pinned: { type: Boolean, default: false }
}, { timestamps: true });

postSchema.index({ visible: 1, createdAt: -1 });
postSchema.index({ category: 1, visible: 1 });

module.exports = mongoose.model('Post', postSchema);
