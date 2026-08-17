const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['M', 'F'], required: true },
  seat: String
});

const bookingSchema = new mongoose.Schema({
  pnr: { type: String, unique: true },
  busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus' },
  busName: String,
  from: String,
  to: String,
  date: String,
  departureTime: String,
  arrivalTime: String,
  seats: [String],
  passengerDetails: [passengerSchema],
  totalAmount: Number,
  boardingPoint: String,
  droppingPoint: String,
  status: { type: String, enum: ['confirmed', 'pending', 'cancelled'], default: 'confirmed' },
  paymentMethod: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  contactEmail: String,
  contactPhone: String
}, { timestamps: true });

bookingSchema.pre('save', function(next) {
  if (!this.pnr) this.pnr = (() => { const { randomBytes } = require('crypto'); return 'RB' + randomBytes(5).toString('hex').toUpperCase(); })();
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
