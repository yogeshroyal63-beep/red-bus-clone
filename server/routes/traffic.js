const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth.middleware');
const { trafficLimiter } = require('../middleware/security');

// Real traffic integration (Req 4 fix). Proxied server-side so the API key
// never reaches the browser. Uses TomTom's Traffic Flow Segment Data API:
// https://developer.tomtom.com/traffic-api/documentation/traffic-flow/flow-segment-data
//
// Without TRAFFIC_API_KEY set, this falls back to the same deterministic
// simulation the route planner already used — but now the response says so
// explicitly (`source: 'simulated'`) instead of silently pretending to be live,
// which was the actual audit finding: not that a simulation existed, but that
// nothing in the UI/API disclosed it wasn't real.

function hashSeed(str, mod) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return (h % mod) / mod;
}

function simulateTraffic(lat, lng) {
  const seed = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const level = ['light', 'moderate', 'heavy'][Math.floor(hashSeed(seed, 100) * 3)];
  const delayFactor = { light: 1.05, moderate: 1.35, heavy: 1.8 }[level];
  return {
    source: 'simulated',
    congestionLevel: level,
    currentSpeedKmh: null,
    freeFlowSpeedKmh: null,
    delayFactor,
  };
}

// Short-lived cache so repeated lookups for the same rounded point (e.g. a user
// re-planning the same route, or the route-planner's per-route jittered points landing
// close together) don't each burn a fresh billed TomTom call — also blunts the
// budget-exhaustion angle from Finding R on top of the dedicated rate limiter below.
const trafficCache = new Map(); // key -> { data, expiresAt }
const CACHE_TTL_MS = 60 * 1000;

function cacheKey(lat, lng) { return `${lat.toFixed(2)},${lng.toFixed(2)}`; }

// GET /api/traffic/flow?lat=..&lng=..
router.get('/flow', trafficLimiter, optionalAuth, async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng query params required' });
  }

  const key = cacheKey(lat, lng);
  const cached = trafficCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ success: true, ...cached.data, cached: true });
  }

  const apiKey = process.env.TRAFFIC_API_KEY;
  if (!apiKey) {
    const data = simulateTraffic(lat, lng);
    trafficCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return res.json({ success: true, ...data });
  }

  try {
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json` +
      `?key=${encodeURIComponent(apiKey)}&point=${lat},${lng}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!resp.ok) {
      // Provider error (bad key, rate limit, etc.) — fall back rather than 500ing the UI
      const data = simulateTraffic(lat, lng);
      return res.json({ success: true, ...data, providerError: resp.status });
    }

    const data = await resp.json();
    const seg = data.flowSegmentData;
    if (!seg) {
      const fallback = simulateTraffic(lat, lng);
      trafficCache.set(key, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
      return res.json({ success: true, ...fallback });
    }

    const ratio = seg.freeFlowSpeed > 0 ? seg.currentSpeed / seg.freeFlowSpeed : 1;
    const congestionLevel = ratio > 0.8 ? 'light' : ratio > 0.5 ? 'moderate' : 'heavy';

    const result = {
      source: 'tomtom',
      congestionLevel,
      currentSpeedKmh: seg.currentSpeed,
      freeFlowSpeedKmh: seg.freeFlowSpeed,
      delayFactor: seg.freeFlowSpeed > 0 ? +(seg.freeFlowTravelTime > 0
        ? (seg.currentTravelTime / seg.freeFlowTravelTime) : (1 / ratio)).toFixed(2) : 1,
    };
    trafficCache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    res.json({ success: true, ...result });
  } catch (err) {
    // Network/timeout failure calling the provider — degrade to simulation, don't break the planner
    res.json({ success: true, ...simulateTraffic(lat, lng), providerError: err.message });
  }
});

module.exports = router;
