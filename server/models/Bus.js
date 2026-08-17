const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  id: String,
  number: String,
  status: { type: String, enum: ['available', 'booked', 'ladies'], default: 'available' },
  type: { type: String, enum: ['seater', 'sleeper'] },
  price: Number,
  deck: { type: String, enum: ['lower', 'upper'] }
});

const boardingPointSchema = new mongoose.Schema({
  id: String,
  name: String,
  time: String,
  address: String
});

const busSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: String,
  departureTime: String,
  arrivalTime: String,
  duration: String,
  from: { type: String, required: true },
  to: { type: String, required: true },
  price: { type: Number, required: true },
  totalSeats: Number,
  availableSeats: Number,
  rating: { type: Number, default: 4.0 },
  reviews: { type: Number, default: 0 },
  amenities: [String],
  boardingPoints: [boardingPointSchema],
  droppingPoints: [boardingPointSchema],
  seats: [seatSchema],
  offers: [String],
  cancellationPolicy: { type: String, default: 'Free cancellation before 24 hrs' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

busSchema.index({ from: 1, to: 1 });
module.exports = mongoose.model('Bus', busSchema);
