const mongoose = require('mongoose');

// Finding #17: deliveryLog used to be a plain in-memory array in notifications.js,
// wiped on every server restart — contradicting the spec's requirement that
// notifications be "logged and accessible... for future reference." Persisted here
// when MongoDB is connected.
const deliveryLogSchema = new mongoose.Schema({
  notificationId: String,
  channel: String,
  success: Boolean,
  error: String,
  title: String,
  timestamp: { type: Date, default: Date.now }
});

deliveryLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('DeliveryLog', deliveryLogSchema);
