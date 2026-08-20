const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin');
const { body, validationResult } = require('express-validator');

// In real production: integrate Nodemailer (email), FCM (push), Twilio (SMS)
// Here we simulate delivery with proper status tracking + retry queue

// Finding #17: this was a plain in-memory array, wiped on every restart — contradicting
// the spec's "logged... for future reference." Now backed by Mongo when connected (via
// DeliveryLog), following the same req.dbConnected dual-mode pattern used everywhere
// else in this app; the in-memory array remains only as the offline/no-DB fallback.
const deliveryLog = [];

async function recordDelivery(entry, dbConnected) {
  deliveryLog.push(entry);
  if (dbConnected) {
    try {
      const DeliveryLog = require('../models/DeliveryLog');
      await new DeliveryLog(entry).save();
    } catch { /* non-fatal — in-memory copy above is the fallback */ }
  }
}

const CHANNEL_SIMULATORS = {
  async email(notif) {
    // Real: await nodemailer.sendMail(...)
    const success = Math.random() > 0.1; // 90% success rate simulation
    return { channel: 'email', success, timestamp: new Date() };
  },
  async push(notif) {
    // Real: await fcm.send(...)
    const success = Math.random() > 0.05; // 95% success rate
    return { channel: 'push', success, timestamp: new Date() };
  },
  async sms(notif) {
    // Real: await twilio.messages.create(...)
    const success = Math.random() > 0.15; // 85% success rate
    return { channel: 'sms', success, timestamp: new Date() };
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Spec fix: "retry mechanisms for failed deliveries" previously only existed as a
// message string ("Retry scheduled") — nothing ever actually retried. This now
// really re-attempts a failed channel up to MAX_RETRIES times with exponential
// backoff, and every attempt (including the retries) is written to the delivery
// log with its attempt number, so the log shows genuine retry history rather than
// a single failed row.
const MAX_RETRIES = 2; // i.e. up to 3 attempts total per channel
const RETRY_BASE_DELAY_MS = 300;

async function deliverWithRetry(channel, notif, notificationId, dbConnected) {
  const simulator = CHANNEL_SIMULATORS[channel];
  if (!simulator) return null;

  let lastResult = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    attempts = attempt;
    try {
      lastResult = await simulator(notif);
    } catch (err) {
      lastResult = { channel, success: false, timestamp: new Date(), error: err.message };
    }

    await recordDelivery({
      notificationId, channel, success: lastResult.success,
      timestamp: lastResult.timestamp, title: notif.title,
      attempt, error: lastResult.error
    }, dbConnected);

    if (lastResult.success) break;
    if (attempt <= MAX_RETRIES) await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
  }

  return { ...lastResult, attempts, retried: attempts > 1 };
}

// POST /api/notifications/send — dispatch notification through channels
// FIX: this had no auth check at all — anyone could trigger sends for any user.
router.post('/send', verifyToken, async (req, res) => {
  const { notificationId, channels = ['push'], title, message } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'title and message required' });

  const results = await Promise.all(
    channels.map((channel) => deliverWithRetry(channel, { title, message }, notificationId, req.dbConnected))
  );

  const attempted = results.filter(Boolean);
  const delivered = attempted.filter(r => r.success);
  const failed = attempted.filter(r => !r.success);
  const retriedChannels = attempted.filter(r => r.retried).map(r => r.channel);

  const allDelivered = failed.length === 0;
  res.status(allDelivered ? 200 : 207).json({
    success: allDelivered,
    delivered: delivered.map(r => r.channel),
    failed: failed.map(r => r.channel),
    retried: retriedChannels,
    message: allDelivered
      ? (retriedChannels.length ? `Delivered on all channels (retried: ${retriedChannels.join(', ')})` : 'Delivered on all channels')
      : `Failed on: ${failed.map(r => r.channel).join(', ')} after ${MAX_RETRIES + 1} attempts each.`
  });
});

// GET /api/notifications/log — delivery log (admin)
// FIX: this was public — anyone could read the global delivery log.
router.get('/log', verifyToken, requireAdmin, async (req, res) => {
  if (req.dbConnected) {
    try {
      const DeliveryLog = require('../models/DeliveryLog');
      const docs = await DeliveryLog.find().sort({ timestamp: -1 }).limit(100);
      return res.json({ success: true, data: docs });
    } catch { /* fall through to in-memory */ }
  }
  res.json({ success: true, data: deliveryLog.slice(-100) });
});

// GET/PUT /api/notifications/history — Finding #16: notification history used to be
// localStorage-only, so it never followed the user across devices (unlike notifPrefs,
// which already synced via /auth/me/preferences). This stores/retrieves a capped
// history on the user's account, the same pattern used for prefs.
// Note: this requires MongoDB (User lookup); in the in-memory fallback mode it's a
// no-op best-effort, same honest limitation the rest of this app's in-memory paths have.
router.get('/history', verifyToken, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId).select('preferences.notifHistory');
    return res.json({ success: true, data: user?.preferences?.notifHistory || null });
  } catch {
    return res.json({ success: true, data: null });
  }
});

router.put('/history', verifyToken, async (req, res) => {
  try {
    const { notifications } = req.body;
    if (!Array.isArray(notifications)) return res.status(400).json({ error: 'notifications must be an array' });
    const capped = notifications.slice(0, 100);
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.userId, { $set: { 'preferences.notifHistory': capped } });
    return res.json({ success: true });
  } catch (err) {
    // Best-effort — the caller already has the data in localStorage either way.
    return res.status(200).json({ success: false, error: err.message });
  }
});

module.exports = router;
