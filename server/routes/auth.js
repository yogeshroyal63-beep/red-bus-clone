const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { generateToken, verifyToken, revokeToken } = require('../middleware/auth.middleware');
const { authLimiter, validateRegister, validateLogin, handleValidationErrors } = require('../middleware/security');

const userStore = []; // In-memory fallback

// A real bcrypt hash of an arbitrary, never-used string — see the timing-attack note in
// the /login handler below. Computed once at module load (not per-request) so it's a
// fixed, valid hash rather than a hand-typed string that risks being malformed.
const DUMMY_HASH_FOR_TIMING = bcrypt.hashSync('rb-timing-normalization-not-a-real-password', 12);

// POST /api/auth/register
router.post('/register', authLimiter, validateRegister, handleValidationErrors, async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;
    const User = req.dbConnected ? require('../models/User') : null;
    if (User) {
      let exists;
      try { exists = await User.findOne({ email }); }
      catch (dbErr) { return res.status(503).json({ error: 'Could not reach the database. Please try again.', code: 'err.server' }); }
      if (exists) return res.status(409).json({ error: 'Email already registered', code: 'auth.err.emailTaken' });

      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      let user;
      try {
        user = new User({ name, email, mobile, password: hashedPassword });
        await user.save();
      } catch (saveErr) {
        return res.status(400).json({ error: saveErr.message || 'Could not create account.', code: 'auth.registerFailed' });
      }
      user = user.toObject();
      const { password: _, ...safeUser } = user;
      const token = generateToken(user._id.toString(), user.name);
      return res.status(201).json({ success: true, data: safeUser, token, expiresIn: '7d' });
    }

    let exists = userStore.find(u => u.email === email);
    if (exists) return res.status(409).json({ error: 'Email already registered', code: 'auth.err.emailTaken' });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = { _id: `u_${Date.now()}`, name, email, mobile, password: hashedPassword, wallet: 0, bookings: [], preferences: { lang: 'en', notifPrefs: null }, createdAt: new Date() };
    userStore.push(user);

    const { password: _, ...safeUser } = user;
    const token = generateToken(user._id.toString(), user.name);
    res.status(201).json({ success: true, data: safeUser, token, expiresIn: '7d' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;
    const User = req.dbConnected ? require('../models/User') : null;

    let user;
    if (User) {
      try { user = await User.findOne({ email }); } catch { return res.status(503).json({ error: 'Could not reach the database. Please try again.', code: 'err.server' }); }
      if (user) user = user.toObject();
    } else {
      user = userStore.find(u => u.email === email);
    }

    // Finding #36: unknown email and wrong password used to return different status
    // codes and messages (404 "No account found" vs. 401 "Incorrect password"), which
    // lets an attacker enumerate registered emails just by watching the response. Both
    // cases now return the identical 401 + generic message/code.
    //
    // Skipping bcrypt.compare entirely on the "no such user" path would still leak the
    // same thing through timing — a missing account replies in microseconds, a wrong
    // password takes as long as bcrypt does (~100ms+). DUMMY_HASH_FOR_TIMING is a bcrypt
    // hash of an unguessable, unused string; comparing against it costs the same as a
    // real check, so both paths take a similar amount of time either way.
    const isMatch = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, DUMMY_HASH_FOR_TIMING);

    if (!user || !isMatch) {
      return res.status(401).json({ error: 'Incorrect email or password', code: 'auth.err.invalidCredentials' });
    }

    const { password: _, ...safeUser } = user;
    const token = generateToken(user._id.toString(), user.name);
    res.json({ success: true, data: safeUser, token, expiresIn: '7d' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me - protected
router.get('/me', verifyToken, async (req, res) => {
  try {
    let User;
    try { User = require('../models/User'); } catch {}
    let user = userStore.find(u => u._id === req.userId);
    if (!user && User) {
      try { user = await User.findById(req.userId).select('-password'); } catch {}
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...safeUser } = user.toObject ? user.toObject() : user;
    res.json({ success: true, data: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/me/preferences — account-linked lang + notification prefs (Req 2 & 3 follow-up)
// Lets language/notification settings follow the user across devices instead
// of living only in that one browser's localStorage.
router.put('/me/preferences', verifyToken, async (req, res) => {
  try {
    const { lang, notifPrefs } = req.body;
    const update = {};
    if (lang) update['preferences.lang'] = lang;
    if (notifPrefs) update['preferences.notifPrefs'] = notifPrefs;

    let User;
    try { User = require('../models/User'); } catch {}
    let user = userStore.find(u => u._id === req.userId);

    if (user) {
      user.preferences = { ...(user.preferences || {}), ...(lang && { lang }), ...(notifPrefs && { notifPrefs }) };
      const { password: _, ...safeUser } = user;
      return res.json({ success: true, data: safeUser });
    }

    if (User) {
      const updated = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true }).select('-password');
      if (!updated) return res.status(404).json({ error: 'User not found' });
      return res.json({ success: true, data: updated });
    }

    return res.status(404).json({ error: 'User not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', verifyToken, (req, res) => {
  revokeToken(req.token);
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
