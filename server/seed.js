// One-time seed script — inserts the app's existing curated bus data (real operator
// names, timings, fares — see the comment on mockBuses in routes/buses.js) into the
// actual MongoDB `buses` collection, so a live search against the real database
// returns real results instead of an empty array. Safe to re-run: it clears only the
// buses it previously seeded (by _id) rather than wiping the whole collection, so any
// buses added by other means (e.g. an admin panel, real bookings) aren't touched.
//
// Usage:
//   cd server
//   npm install          # if not already done
//   node seed.js
//
// Requires MONGODB_URI to be set — either in server/.env (see .env.example) or as a
// real environment variable. Reads mockBuses directly from routes/buses.js so this
// script can never drift out of sync with the data the app already ships and tests
// against — there's exactly one dataset, not a second copy to maintain here.

require('dotenv').config();

// routes/buses.js requires middleware/auth.middleware.js at the top (for its
// admin-only routes), which throws immediately if JWT_SECRET isn't set — a correct
// safeguard for the running server, but this script never calls any auth-guarded
// handler, only the exported mockBuses array. Rather than requiring a real secret
// just to seed data, fall back to a harmless placeholder when one isn't already set.
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'seed-script-placeholder-not-used-for-auth';

const mongoose = require('mongoose');
const Bus = require('./models/Bus');
const { mockBuses } = require('./routes/buses');

const MONGODB_URI = process.env.MONGODB_URI;

async function seed() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set. Add it to server/.env (see .env.example) or export it before running this script.');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB…`);
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`✅ Connected: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//<credentials>@')}`);

  // generateSeats() in routes/buses.js is a normal JS function, not middleware/route
  // logic — it's fine to reuse here so seeded buses get the same deterministic seat
  // map shape the rest of the app (seat-selection, booking flow) already expects.
  const seatIds = mockBuses.map(b => b._id);

  const removed = await Bus.deleteMany({ _id: { $in: seatIds } });
  if (removed.deletedCount) {
    console.log(`Cleared ${removed.deletedCount} previously-seeded bus(es) before re-inserting.`);
  }

  const docs = mockBuses.map(b => ({ ...b, active: true }));
  const inserted = await Bus.insertMany(docs, { ordered: false });

  console.log(`✅ Seeded ${inserted.length} buses:`);
  const routeCounts = {};
  for (const b of inserted) {
    const route = `${b.from} → ${b.to}`;
    routeCounts[route] = (routeCounts[route] || 0) + 1;
  }
  for (const [route, count] of Object.entries(routeCounts)) {
    console.log(`   ${route}: ${count} bus(es)`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err.message);
  process.exit(1);
});
