const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { optionalAuth } = require('../middleware/auth.middleware');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// In-memory seat lock store (use Redis in production)
// Map: "busId:seatNumber" -> { userId, sessionId, lockToken, lockedAt, expiresAt }
const seatLocks = new Map();
const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup expired locks every 60 seconds.
// .unref() so this timer alone doesn't keep the Node process (or a Jest run
// that requires this module) alive — it was previously showing up as a
// dangling "open handle" that only `--forceExit` could paper over.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, lock] of seatLocks.entries()) {
    if (lock.expiresAt < now) seatLocks.delete(key);
  }
}, 60000);
cleanupTimer.unref();

const seatLimiter = rateLimit({ windowMs: 60000, max: 30 });

// POST /api/seats/lock — hold seats before payment
router.post('/lock', seatLimiter, optionalAuth, [
  body('busId').notEmpty().withMessage('busId required'),
  body('seats').isArray({ min: 1, max: 6 }).withMessage('1–6 seats required'),
  body('sessionId').notEmpty().withMessage('sessionId required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ error: 'Validation failed', details: errors.array() });

  const { busId, seats, sessionId } = req.body;
  const userId = req.userId || sessionId;
  const now = Date.now();
  const conflicts = [];

  for (const seatNum of seats) {
    const key = `${busId}:${seatNum}`;
    const existing = seatLocks.get(key);
    if (existing && existing.expiresAt > now && existing.userId !== userId) {
      conflicts.push({ seat: seatNum, expiresIn: Math.ceil((existing.expiresAt - now) / 1000) + 's' });
    }
  }

  if (conflicts.length > 0) {
    return res.status(409).json({
      error: 'Some seats are temporarily held by another user',
      conflicts,
      message: 'Please choose different seats or wait for the hold to expire.'
    });
  }

  // Acquire locks. sessionId alone used to be enough to prove ownership on release
  // (Finding N) — it's a bare client-supplied string with no auth binding, so anyone who
  // observed or guessed another guest's sessionId could release or hijack their held
  // seats. Each successful lock now also gets a server-generated, unguessable lockToken
  // that must be presented to release or consume it — sessionId alone is no longer
  // sufficient on its own.
  const expiresAt = now + LOCK_TTL_MS;
  const lockToken = crypto.randomBytes(24).toString('hex');
  for (const seatNum of seats) {
    seatLocks.set(`${busId}:${seatNum}`, { userId, sessionId, lockToken, lockedAt: now, expiresAt });
  }

  res.json({
    success: true,
    lockedSeats: seats,
    lockToken,
    expiresAt: new Date(expiresAt).toISOString(),
    expiresInSeconds: LOCK_TTL_MS / 1000,
    message: `Seats held for ${LOCK_TTL_MS / 60000} minutes. Complete payment before they expire.`
  });
});

// DELETE /api/seats/lock — release locks (on cancel or back navigation)
router.delete('/lock', optionalAuth, [
  body('busId').notEmpty(),
  body('seats').isArray({ min: 1 }),
  body('sessionId').notEmpty(),
  body('lockToken').notEmpty().withMessage('lockToken required'),
], (req, res) => {
  const { busId, seats, sessionId, lockToken } = req.body;
  const userId = req.userId || sessionId;
  let released = 0;

  for (const seatNum of seats) {
    const key = `${busId}:${seatNum}`;
    const lock = seatLocks.get(key);
    // Require the server-issued lockToken to match, not just the client-supplied
    // sessionId/userId — closes the hijack path in Finding N.
    if (lock && lock.userId === userId && lock.lockToken === lockToken) {
      seatLocks.delete(key);
      released++;
    }
  }

  res.json({ success: true, released, message: `${released} seat(s) released.` });
});

// GET /api/seats/:busId/availability — get real-time seat status
router.get('/:busId/availability', (req, res) => {
  const { busId } = req.params;
  const now = Date.now();
  const lockedSeats = [];

  for (const [key, lock] of seatLocks.entries()) {
    if (key.startsWith(`${busId}:`) && lock.expiresAt > now) {
      lockedSeats.push({
        seat: key.split(':')[1],
        expiresIn: Math.ceil((lock.expiresAt - now) / 1000) + 's'
      });
    }
  }

  res.json({ success: true, busId, lockedSeats, timestamp: new Date().toISOString() });
});

module.exports = router;

// Exposed so bookings.js can enforce that a booking can only be created for seats this
// caller actually holds a live, matching lock on (Finding C: previously bookings.js had
// zero references to seatLocks — the lock system was purely advisory UI sugar that never
// prevented a double-booking at the data layer). Verifies every seat's lock belongs to
// (userId, lockToken) and hasn't expired; if so, consumes (deletes) those locks so they
// can't be reused, and returns true. Returns false — and leaves locks untouched — on any
// mismatch, so the caller can reject the booking without silently releasing someone
// else's real hold.
function verifyAndConsumeLocks(busId, seats, userId, lockToken) {
  if (!lockToken) return false;
  const keys = seats.map(s => `${busId}:${s}`);
  const now = Date.now();
  for (const key of keys) {
    const lock = seatLocks.get(key);
    if (!lock || lock.expiresAt <= now || lock.userId !== userId || lock.lockToken !== lockToken) {
      return false;
    }
  }
  for (const key of keys) seatLocks.delete(key);
  return true;
}

module.exports.verifyAndConsumeLocks = verifyAndConsumeLocks;
