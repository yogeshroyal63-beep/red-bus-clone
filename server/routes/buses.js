const { verifyToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin');
const express = require('express');
const router = express.Router();

// Escapes regex metacharacters so user-supplied `from`/`to` search terms can't be used
// to construct a catastrophic-backtracking pattern (Finding P) — e.g. nested quantifiers
// in an unsanitized `new RegExp(from, 'i')` can hang Node's single-threaded event loop
// for every user, not just the attacker, on the app's main unauthenticated landing route.
// A hard length cap on top means even a legitimate-looking pathological string can't be
// passed through as a "city name" in the first place.
const MAX_SEARCH_TERM_LEN = 60;
function escapeRegex(str) {
  return String(str).slice(0, MAX_SEARCH_TERM_LEN).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Deterministic per-seat generator — mirrors the shape the frontend mock used
// (bus.service.ts's generateSeats), but ties seat price to the bus's own fare instead of
// a hardcoded 650 base, and is deterministic per bus (seeded by seat index) rather than
// Math.random() so re-fetching the same bus doesn't change its seat map underneath a
// user mid-booking.
function generateSeats(count, basePrice) {
  const seats = [];
  for (let i = 1; i <= count; i++) {
    // Deterministic pseudo-random status from the seat index — stable across requests
    const r = ((i * 9301 + 49297) % 233280) / 233280;
    const status = r < 0.5 ? 'available' : r < 0.85 ? 'booked' : 'ladies';
    seats.push({
      id: `s${i}`,
      number: `${i}`,
      status,
      type: i % 3 === 0 ? 'sleeper' : 'seater',
      price: basePrice + (i % 3) * 50,
      deck: i <= count / 2 ? 'lower' : 'upper'
    });
  }
  return seats;
}

// Mock data (falls back when MongoDB not connected)
// NOTE (Finding #30 fix): these ids/names now match src/app/services/bus.service.ts's
// frontend mock exactly. They used to be two independently-maintained datasets where the
// SAME ids pointed at DIFFERENT buses (server id 3 = Kallada, frontend id 3 = Orange —
// and so on for 4/5). Seed reviews are filed against the frontend's ids (e.g. review r4
// is filed under busId:'2' for SRS), so if BusService were wired to this endpoint without
// reconciling identities first, bus cards for ids 3-5 would silently swap — Orange's
// reviews/rating rendering under Kallada's card and vice versa. They're now one dataset.
const mockBuses = [
  {
    _id: '1', name: 'VRL Travels', type: 'Multi-Axle Semi Sleeper (2+2)',
    departureTime: '21:30', arrivalTime: '06:00', duration: '8h 30m',
    from: 'Bangalore', to: 'Chennai', price: 650, totalSeats: 40, availableSeats: 22,
    rating: 4.2, reviews: 2841, offers: ['15% off with ICICI card'],
    amenities: ['wifi', 'charging', 'water', 'blanket', 'ac'],
    cancellationPolicy: 'Free cancellation before 24 hrs',
    boardingPoints: [
      { id: 'b1', name: 'Majestic Bus Stand', time: '21:30', address: 'Majestic, Bangalore' },
      { id: 'b2', name: 'Silk Board', time: '21:50', address: 'Silk Board Junction, Bangalore' },
      { id: 'b3', name: 'Hebbal', time: '21:10', address: 'Hebbal Flyover, Bangalore' }
    ],
    droppingPoints: [
      { id: 'd1', name: 'CMBT', time: '05:50', address: 'CMBT, Chennai' },
      { id: 'd2', name: 'Koyambedu', time: '06:00', address: 'Koyambedu, Chennai' },
      { id: 'd3', name: 'Guindy', time: '06:20', address: 'Guindy, Chennai' }
    ],
    seats: generateSeats(40, 650)
  },
  {
    _id: '2', name: 'SRS Travels', type: 'Volvo Multi-Axle A/C Sleeper (2+1)',
    departureTime: '20:00', arrivalTime: '05:30', duration: '9h 30m',
    from: 'Bangalore', to: 'Chennai', price: 950, totalSeats: 30, availableSeats: 8,
    rating: 4.5, reviews: 5123, offers: ['10% off on 1st booking'],
    amenities: ['wifi', 'charging', 'water', 'blanket', 'ac', 'snacks', 'entertainment'],
    cancellationPolicy: 'Free cancellation before 12 hrs',
    boardingPoints: [
      { id: 'b1', name: 'Shivajinagar', time: '20:00', address: 'Shivajinagar Bus Stand' },
      { id: 'b2', name: 'Electronic City', time: '20:30', address: 'Electronic City Phase 2' }
    ],
    droppingPoints: [
      { id: 'd1', name: 'CMBT', time: '05:20', address: 'CMBT, Chennai' },
      { id: 'd2', name: 'Koyambedu', time: '05:30', address: 'Koyambedu' }
    ],
    seats: generateSeats(30, 950)
  },
  {
    _id: '3', name: 'Orange Tours & Travels', type: 'A/C Seater / Sleeper (2+2)',
    departureTime: '22:45', arrivalTime: '07:15', duration: '8h 30m',
    from: 'Bangalore', to: 'Chennai', price: 750, totalSeats: 44, availableSeats: 30,
    rating: 3.9, reviews: 876, amenities: ['charging', 'water', 'ac'],
    cancellationPolicy: 'Free cancellation before 6 hrs',
    boardingPoints: [
      { id: 'b1', name: 'Majestic', time: '22:45', address: 'Majestic Bus Stand' }
    ],
    droppingPoints: [
      { id: 'd1', name: 'CMBT', time: '07:10', address: 'CMBT, Chennai' }
    ],
    seats: generateSeats(44, 750)
  },
  {
    _id: '4', name: 'Kallada Travels (G6)', type: 'Volvo Multi Axle A/C Sleeper (2+1)',
    departureTime: '19:30', arrivalTime: '04:45', duration: '9h 15m',
    from: 'Bangalore', to: 'Chennai', price: 1100, totalSeats: 27, availableSeats: 4,
    rating: 4.6, reviews: 7232, offers: ['FIRST10: 10% off'],
    amenities: ['wifi', 'charging', 'water', 'blanket', 'ac', 'entertainment'],
    cancellationPolicy: 'Free cancellation before 24 hrs',
    boardingPoints: [
      { id: 'b1', name: 'Jayanagar', time: '19:30', address: 'Jayanagar 4th Block' },
      { id: 'b2', name: 'Silk Board', time: '19:50', address: 'Silk Board Junction' }
    ],
    droppingPoints: [
      { id: 'd1', name: 'Koyambedu', time: '04:45', address: 'Koyambedu Bus Terminal' },
      { id: 'd2', name: 'Anna Nagar', time: '05:10', address: 'Anna Nagar Tower' }
    ],
    seats: generateSeats(27, 1100)
  },
  {
    _id: '5', name: 'KSRTC Airavat Club Class', type: 'Volvo Multi Axle A/C Seater (2+2)',
    departureTime: '06:00', arrivalTime: '13:30', duration: '7h 30m',
    from: 'Bangalore', to: 'Chennai', price: 520, totalSeats: 40, availableSeats: 35,
    rating: 4.0, reviews: 3421, amenities: ['ac', 'charging'],
    cancellationPolicy: 'Non-refundable',
    boardingPoints: [
      { id: 'b1', name: 'Majestic (Kempegowda Bus Stand)', time: '06:00', address: 'Majestic Bus Stand' }
    ],
    droppingPoints: [
      { id: 'd1', name: 'CMBT', time: '13:30', address: 'CMBT, Chennai' }
    ],
    seats: generateSeats(40, 520)
  },
  {
    _id: '6', name: 'Parveen Travels', type: 'A/C Sleeper (2+1)',
    departureTime: '23:59', arrivalTime: '08:30', duration: '8h 31m',
    from: 'Bangalore', to: 'Chennai', price: 880, totalSeats: 24, availableSeats: 12,
    rating: 4.1, reviews: 1543, offers: ['5% off with HDFC card'],
    amenities: ['charging', 'water', 'blanket', 'ac'],
    cancellationPolicy: 'Free cancellation before 6 hrs',
    boardingPoints: [
      { id: 'b1', name: 'Shivajinagar', time: '23:59', address: 'Shivajinagar Bus Stand' }
    ],
    droppingPoints: [
      { id: 'd1', name: 'CMBT', time: '08:30', address: 'CMBT, Chennai' }
    ],
    seats: generateSeats(24, 880)
  },
  {
    _id: '7', name: 'SRS Travels', type: 'Multi-Axle A/C Sleeper (2+1)',
    departureTime: '18:00', arrivalTime: '04:00', duration: '10h',
    from: 'Mumbai', to: 'Pune', price: 450, totalSeats: 36, availableSeats: 20,
    rating: 4.3, reviews: 1200, amenities: ['ac', 'water', 'blanket'],
    cancellationPolicy: 'Free cancellation before 12 hrs',
    boardingPoints: [{ id: 'b1', name: 'Dadar', time: '18:00', address: 'Dadar Bus Stand, Mumbai' }],
    droppingPoints: [{ id: 'd1', name: 'Shivajinagar Pune', time: '04:00', address: 'Shivajinagar, Pune' }],
    seats: generateSeats(36, 450)
  },
  {
    _id: '8', name: 'Raj National Express', type: 'A/C Sleeper (2+1)',
    departureTime: '22:00', arrivalTime: '07:30', duration: '9h 30m',
    from: 'Mumbai', to: 'Pune', price: 380, totalSeats: 30, availableSeats: 14,
    rating: 4.1, reviews: 890, amenities: ['ac', 'charging'],
    cancellationPolicy: 'Free cancellation before 6 hrs',
    boardingPoints: [{ id: 'b1', name: 'Borivali', time: '22:00', address: 'Borivali Bus Stand, Mumbai' }],
    droppingPoints: [{ id: 'd1', name: 'Swargate', time: '07:30', address: 'Swargate, Pune' }],
    seats: generateSeats(30, 380)
  }
];

// GET /api/buses/search?from=Bangalore&to=Chennai&date=2024-05-27
router.get('/search', async (req, res) => {
  try {
    const { from, to, date } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

    let results;
    const BusModel = req.dbConnected ? require('../models/Bus') : null;
    if (BusModel) {
      try {
        results = await BusModel.find({
          from: new RegExp(escapeRegex(from), 'i'),
          to: new RegExp(escapeRegex(to), 'i'),
          active: true
        }).select('-seats');
      } catch (dbErr) {
        results = null;
      }
    }
    // Fallback to mock data if no DB or DB failed. Strip seats here too, matching the
    // DB path's .select('-seats') — search results don't need the full seat map.
    if (!results) {
      results = mockBuses.filter(b =>
        b.from.toLowerCase().includes(from.toLowerCase()) &&
        b.to.toLowerCase().includes(to.toLowerCase())
      ).map(({ seats, ...rest }) => rest);
    }

    res.json({ success: true, count: results.length, data: results, date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/buses/:id?date=YYYY-MM-DD
router.get('/:id', async (req, res) => {
  try {
    let bus;
    const BusById = req.dbConnected ? require('../models/Bus') : null;
    if (BusById) {
      try { bus = await BusById.findById(req.params.id); } catch {}
    }
    if (!bus) bus = mockBuses.find(b => b._id === req.params.id);
    if (!bus) return res.status(404).json({ error: 'Bus not found' });

    // A Bus document is a recurring route/schedule template shared across every date
    // it runs (see seed.js) — it has no date of its own, so "seat 5 is booked" can't
    // live on the Bus record itself without incorrectly marking that seat booked on
    // every future date too. The real per-date truth already exists on confirmed
    // Booking documents (busId + date + seats), just never consulted here before.
    // When a date is given, overlay that onto a plain-object copy of the bus's seat
    // map for the response only — the stored Bus document is never mutated, since
    // "booked" here is true only for this one date, not for the bus in general.
    const { date } = req.query;
    const plainBus = typeof bus.toObject === 'function' ? bus.toObject() : JSON.parse(JSON.stringify(bus));

    if (date && Array.isArray(plainBus.seats) && plainBus.seats.length) {
      let bookedSeatNumbers = new Set();
      if (req.dbConnected) {
        try {
          const Booking = require('../models/Booking');
          const bookings = await Booking.find({
            busId: String(req.params.id),
            date,
            status: { $ne: 'cancelled' }
          }).select('seats');
          for (const b of bookings) for (const s of (b.seats || [])) bookedSeatNumbers.add(s);
        } catch { /* fall through with whatever we have (possibly none found) */ }
      }
      if (bookedSeatNumbers.size) {
        plainBus.seats = plainBus.seats.map(seat =>
          bookedSeatNumbers.has(seat.number) ? { ...seat, status: 'booked' } : seat
        );
      }
    }

    res.json({ success: true, data: plainBus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/buses - all buses
router.get('/', async (req, res) => {
  try {
    let buses;
    const BusAll = req.dbConnected ? require('../models/Bus') : null;
    if (BusAll) {
      try { buses = await BusAll.find({ active: true }).select('-seats'); } catch {}
    }
    if (!buses) buses = mockBuses.map(({ seats, ...rest }) => rest);
    res.json({ success: true, count: buses.length, data: buses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buses - add bus (real admin gate — the old comment claimed "admin only"
// but only checked verifyToken, so any registered account could create arbitrary bus
// listings with zero validation beyond Mongoose's required fields (Finding Q). This now
// actually requires an allowlisted admin id, same gate as the moderation endpoints.
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const Bus = require('../models/Bus');
    const bus = new Bus(req.body);
    await bus.save();
    res.status(201).json({ success: true, data: bus });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
module.exports.mockBuses = mockBuses;
