const mongoose = require('mongoose');

// Mirrors the shape reviews.js was already building by hand for its
// in-memory reviewStore (see reviews.js), so both modes return identical JSON.
const reviewSchema = new mongoose.Schema({
  busId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, default: 'Verified Traveller' },
  userAvatar: String,
  rating: { type: Number, required: true, min: 1, max: 5 },
  text: { type: String, required: true, minlength: 50, maxlength: 1000 },
  journeyDate: { type: String, required: true },
  bookingPnr: { type: String, required: true },
  upvotes: { type: Number, default: 0 },
  helpful: { type: [String], default: [] },
  reported: { type: Boolean, default: false },
  reportCount: { type: Number, default: 0 },
  // Finding #4: report-bombing — reportedBy tracks which identities (userId when
  // authenticated, else req.ip) have already reported this review, so a script
  // hammering the endpoint can only ever contribute one count total.
  reportedBy: { type: [String], default: [] },
  visible: { type: Boolean, default: true },
  verified: { type: Boolean, default: true },
  editedAt: Date
}, { timestamps: true });

// One review per journey: same rider, same bus, same PNR shouldn't double up.
// A rider taking the same route again on a different trip (different PNR) is
// still allowed to review that separate journey.
reviewSchema.index({ busId: 1, userId: 1, bookingPnr: 1 }, { unique: true });
reviewSchema.index({ busId: 1, visible: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
