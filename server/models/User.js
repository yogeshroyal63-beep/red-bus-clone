const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [60, 'Name must be at most 60 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,  // MongoDB enforces uniqueness at DB level — not just app level
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address']
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    match: [/^[6-9]\d{9}$/, 'Enter a valid Indian mobile number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // Finding #6: this used to be a dead schema field — default false, never set true
  // anywhere (no email/OTP flow), and never read by the review/community middleware,
  // even though it used the same "verified account" language as the spec. The app's
  // actual verification mechanism is requireVerifiedJourney (a real confirmed + completed
  // booking PNR, checked per-action) — a different, stronger concept than a one-time
  // account flag, so the field has been removed rather than wired up to something it
  // was never meant to represent.
  bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
  wallet: { type: Number, default: 0, min: 0 },
  // Account-linked prefs (Req 2 & 3 follow-up) — so language/notification
  // settings follow the user across devices instead of living only in
  // localStorage on one browser.
  preferences: {
    lang: { type: String, default: 'en' },
    notifPrefs: { type: mongoose.Schema.Types.Mixed, default: null },
    // Finding #16: notification history used to live only in one browser's localStorage,
    // unlike prefs (synced above) — logging in on a second device showed the seed demo
    // notifications again, never the user's real history. Synced the same way prefs are.
    notifHistory: { type: mongoose.Schema.Types.Mixed, default: null }
  }
}, {
  timestamps: true,
  toJSON: {
    // Never accidentally send password in JSON responses
    transform: (doc, ret) => { delete ret.password; return ret; }
  }
});

// ISSUE #3 FIX: Catch MongoDB duplicate-key error (11000) properly
userSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('Email already registered'));
  } else {
    next(error);
  }
});

// Index for faster lookups
userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);
