const express = require('express');
const router = express.Router();
const { bookingLimiter, validateBooking, handleValidationErrors } = require('../middleware/security');
const rateLimit = require('express-rate-limit');
const { optionalAuth, verifyToken } = require('../middleware/auth.middleware');
const { verifyAndConsumeLocks } = require('./seats');

const bookingStore = [];

// Own limiter for the public tracking lookup — it's unauthenticated by design (see
// /pnr/:pnr/track below), so it needs its own budget independent of the global one to
// keep PNR brute-forcing/scraping cheap to rate-limit even though the PNR space itself
// (10 hex chars, ~1.1e12 combinations) makes guessing impractical on its own.
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tracking lookups. Please slow down.' }
});

// Server-side fare recalculation (Finding B). The client used to send totalAmount as a
// plain positive number with no cross-check against the bus's actual price — a user
// could POST 4 seats on a ₹1500 bus with totalAmount: 1 and it went through confirmed.
// This fetches the bus's real per-seat pricing and recomputes the total; the client's
// figure is never trusted for anything but display.
async function computeServerFare(busId, seatNumbers, dbConnected) {
  let bus = null;
  if (dbConnected) {
    try { bus = await require('../models/Bus').findById(busId); } catch { /* fall through to mock */ }
  }
  if (!bus) {
    const { mockBuses } = require('./buses');
    bus = mockBuses.find(b => b._id === String(busId));
  }
  if (!bus) return null;

  if (Array.isArray(bus.seats) && bus.seats.length) {
    const priceByNumber = new Map(bus.seats.map(s => [s.number, s.price]));
    let total = 0;
    for (const num of seatNumbers) {
      const p = priceByNumber.get(num);
      if (typeof p !== 'number') return null; // unknown seat number — reject rather than guess
      total += p;
    }
    return total;
  }
  // No per-seat pricing on this bus record — fall back to base price × seat count
  return (bus.price || 0) * seatNumbers.length;
}

// POST /api/bookings
router.post('/', bookingLimiter, optionalAuth, validateBooking, handleValidationErrors, async (req, res) => {
  try {
    const { busId, busName, from, to, date, departureTime, arrivalTime,
      seats, passengerDetails, boardingPoint, droppingPoint,
      paymentMethod, contactEmail, contactPhone, sessionId, lockToken } = req.body;

    if (!Array.isArray(seats) || !Array.isArray(passengerDetails) || seats.length !== passengerDetails.length) {
      return res.status(400).json({ error: 'Number of seats must match number of passengers.', code: 'err.seatPassengerMismatch' });
    }

    // Finding C: the seat-lock system was purely advisory UI sugar — POST /seats/lock
    // and POST /bookings shared no state, so a booking could be created for seats
    // nobody locked, or seats someone else currently holds, with no conflict at all.
    // This now requires the caller to actually hold a live lock (proven by the
    // server-issued lockToken from the lock step) on exactly these seats before a
    // booking can be created for them, and consumes that lock so it can't be reused.
    const lockOwnerId = req.userId || sessionId;
    if (!lockOwnerId || !verifyAndConsumeLocks(busId, seats, lockOwnerId, lockToken)) {
      return res.status(409).json({
        error: 'These seats are not currently held by you (lock missing or expired). Please reselect your seats.',
        code: 'err.seatLockExpired'
      });
    }

    // Finding B: recompute the fare server-side rather than trusting req.body.totalAmount.
    const serverAmount = await computeServerFare(busId, seats, req.dbConnected);
    if (serverAmount === null) {
      return res.status(400).json({ error: 'Could not verify fare for the selected bus/seats.', code: 'err.fareVerifyFailed' });
    }
    const totalAmount = serverAmount;

    let booking;
    try {
      const Booking = require('../models/Booking');
      booking = new Booking({
        busId, busName, from, to, date, departureTime, arrivalTime,
        seats, passengerDetails, totalAmount, boardingPoint, droppingPoint,
        paymentMethod, contactEmail, contactPhone, status: 'confirmed',
        userId: req.userId || null
      });
      await booking.save();
    } catch {
      booking = {
        _id: Date.now().toString(),
        pnr: (() => { const { randomBytes } = require('crypto'); return 'RB' + randomBytes(5).toString('hex').toUpperCase(); })(),
        busId, busName, from, to, date, departureTime, arrivalTime,
        seats, passengerDetails, totalAmount, boardingPoint, droppingPoint,
        paymentMethod, contactEmail, contactPhone, status: 'confirmed',
        userId: req.userId || null,
        createdAt: new Date()
      };
      bookingStore.push(booking);
    }

    res.status(201).json({ success: true, data: booking, pnr: booking.pnr,
      message: `Booking confirmed! PNR: ${booking.pnr}. E-ticket sent to ${contactEmail}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/pnr/:pnr/track — public, PNR-only lookup for the bus-tracking page.
// Finding #35: tightening the endpoint above to owner-only (correctly, for #23) broke
// tracking for the app's default flow — bookings don't require login (POST /api/bookings
// is optionalAuth), so a guest booking's userId is always null and can never pass an
// ownership check, not even for the person who made it. Real PNR-based tracking (airlines,
// other bus operators) treats the PNR itself as the credential and doesn't require login.
// This endpoint restores that: no auth required, but it returns only what a tracking page
// needs — never passengerDetails, contactEmail, contactPhone, totalAmount, or seats, which
// is exactly the PII exposure #23 was about in the first place. The owner-only endpoint
// above stays locked down for anything that needs the full record.
router.get('/pnr/:pnr/track', trackLimiter, async (req, res) => {
  try {
    const pnr = req.params.pnr.toUpperCase();
    if (!/^RB[A-F0-9]{10}$/i.test(pnr)) return res.status(400).json({ error: 'Invalid PNR format', code: 'err.pnrInvalid' });

    let booking;
    try {
      const Booking = require('../models/Booking');
      booking = await Booking.findOne({ pnr });
    } catch {
      booking = bookingStore.find(b => b.pnr === pnr);
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found. Check your PNR.', code: 'err.pnrNotFound' });

    const b = typeof booking.toObject === 'function' ? booking.toObject() : booking;
    const { busName, from, to, date, departureTime, arrivalTime, boardingPoint, droppingPoint, status } = b;
    res.json({ success: true, data: { pnr, busName, from, to, date, departureTime, arrivalTime, boardingPoint, droppingPoint, status } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/pnr/:pnr
// Finding #23 / 22: this used to be a public IDOR — optionalAuth with zero ownership
// check, returning the full booking doc (passenger details, contact email/phone, amount)
// to anyone who had the PNR string. Only the authenticated owner of the booking can fetch
// the full record by PNR — use /pnr/:pnr/track above for the unauthenticated tracking case.
router.get('/pnr/:pnr', verifyToken, async (req, res) => {
  try {
    const pnr = req.params.pnr.toUpperCase();
    // FIX: generator emits 'RB' + randomBytes(5).toString('hex') = 10 hex chars, not 8 —
    // the old 8-char regex rejected every real PNR the app itself generates.
    if (!/^RB[A-F0-9]{10}$/i.test(pnr)) return res.status(400).json({ error: 'Invalid PNR format', code: 'err.pnrInvalid' });

    let booking;
    try {
      const Booking = require('../models/Booking');
      booking = await Booking.findOne({ pnr });
    } catch {
      booking = bookingStore.find(b => b.pnr === pnr);
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found. Check your PNR.', code: 'err.pnrNotFound' });
    if (!booking.userId || booking.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'This booking does not belong to your account.', code: 'err.notYourBooking' });
    }
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/my - user's bookings (protected)
router.get('/my', verifyToken, async (req, res) => {
  try {
    let bookings;
    try {
      const Booking = require('../models/Booking');
      bookings = await Booking.find({ userId: req.userId }).sort({ createdAt: -1 });
    } catch {
      bookings = bookingStore.filter(b => b.userId === req.userId);
    }
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bookings/:id/cancel
// Finding A: this used to be a public IDOR — optionalAuth with no ownership check at
// all, so anyone who knew (or guessed a sequential) booking _id could cancel a
// stranger's booking. My-bookings (the only UI surface that lists bookings to cancel)
// already requires a real login via GET /my, so requiring login + ownership here costs
// no legitimate functionality.
router.put('/:id/cancel', verifyToken, async (req, res) => {
  try {
    let booking;
    try {
      const Booking = require('../models/Booking');
      booking = await Booking.findById(req.params.id);
      if (booking && (!booking.userId || booking.userId.toString() !== req.userId)) {
        return res.status(403).json({ error: 'This booking does not belong to your account.', code: 'err.notYourBooking' });
      }
      if (booking) { booking.status = 'cancelled'; await booking.save(); }
    } catch {
      booking = bookingStore.find(b => b._id === req.params.id);
      if (booking && booking.userId !== req.userId) {
        return res.status(403).json({ error: 'This booking does not belong to your account.', code: 'err.notYourBooking' });
      }
      if (booking) booking.status = 'cancelled';
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found', code: 'err.pnrNotFound' });
    res.json({ success: true, data: booking, message: 'Booking cancelled. Refund will process in 5-7 business days.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
