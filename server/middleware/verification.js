// Server-side "verified user" enforcement.
//
// PREVIOUSLY: reviews.js and community.js both trusted a client-sent flag
// (community.js hardcoded verified:true on every post; reviews.js only checked
// that bookingPnr.startsWith('RB') — any string starting with those two letters
// passed). Neither actually confirmed the caller holds a real booking.
//
// NOW: this middleware requires a bookingPnr in the request body and validates
// its format against the real PNR shape the app generates ('RB' + 8 uppercase
// hex chars — see Booking.js pre-save hook). When Mongo is connected it goes
// further and confirms a *confirmed* booking with that PNR actually exists,
// and — if the caller is authenticated — that it belongs to them.
//
// Honest limitation: bookings.js keeps its in-memory fallback store local to
// that module (not exported), so when running WITHOUT MongoDB there is no
// cross-route way to check that a given PNR really exists — the best this
// middleware can do in that mode is enforce the correct PNR shape. With
// MongoDB connected (the intended production path), it's a real check against
// the Booking collection.

// Matches the actual generator: 'RB' + randomBytes(5).toString('hex').toUpperCase()
// = 'RB' + 10 hex chars. (bookings.js's own /pnr/:pnr lookup had this wrong too —
// fixed alongside this file, see bookings.js.)
const PNR_RE = /^RB[A-F0-9]{10}$/;

async function requireVerifiedJourney(req, res, next) {
  const bookingPnr = (req.body.bookingPnr || '').toUpperCase();

  if (!PNR_RE.test(bookingPnr)) {
    return res.status(403).json({
      error: 'A valid completed-journey PNR is required to verify your account for this action.'
    });
  }

  if (req.dbConnected) {
    try {
      const Booking = require('../models/Booking');
      const booking = await Booking.findOne({ pnr: bookingPnr });
      if (!booking) {
        return res.status(403).json({ error: 'No booking found for that PNR.' });
      }
      if (booking.status !== 'confirmed') {
        return res.status(403).json({ error: 'This booking is not a confirmed journey.' });
      }
      // Ownership: this middleware always runs behind verifyToken, so req.userId is
      // always set here. A booking with no userId (guest checkout) can never be tied
      // to *this* — or any — account, so it must be rejected rather than silently
      // allowed through: previously `booking.userId && req.userId && ...` short-circuited
      // to "no check" whenever booking.userId was null, letting any logged-in user claim
      // any guest booking's PNR as their own verified journey.
      if (!booking.userId || booking.userId.toString() !== req.userId) {
        return res.status(403).json({ error: 'This PNR does not belong to your account.' });
      }
      // "Only after completing the journey": the booking's travel date must actually
      // be in the past, not merely confirmed. A confirmed booking for a bus departing
      // next month is not a completed journey yet.
      const journeyDate = new Date(booking.date);
      if (isNaN(journeyDate.getTime()) || journeyDate.getTime() > Date.now()) {
        return res.status(403).json({ error: 'This journey has not been completed yet. You can review or post about it after the travel date has passed.' });
      }
    } catch {
      // DB hiccup — fail closed rather than silently letting an unverifiable post through
      return res.status(503).json({ error: 'Could not verify booking right now. Please try again.' });
    }
  }

  req.verifiedPnr = bookingPnr;
  next();
}

module.exports = { requireVerifiedJourney, PNR_RE };
