// Strips Mongo operator injection out of request input.
//
// Fields like `busId`/`bookingPnr` (reviews.js) or `email` (auth.js) were validated with
// express-validator's notEmpty()/isEmail() but never coerced to a primitive before being
// interpolated into Mongoose `.findOne({...})` calls. notEmpty() happily accepts an
// object — so a payload like `{"bookingPnr": {"$ne": null}}` reached
// `Booking.findOne({ pnr: bookingPnr })` as a literal Mongo operator, not a string. That
// hits the exact route (verification.js) built to stop journey-verification fraud.
//
// This walks req.body/query/params recursively and deletes any key that starts with '$'
// or contains a '.' (both are how Mongo operator/path injection payloads get in), on
// every request, before any route handler or validator sees it.
function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const clean = {};
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      clean[key] = sanitizeValue(value[key]);
    }
    return clean;
  }
  return value;
}

function mongoSanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeValue(req.body);
  if (req.query && typeof req.query === 'object') {
    const cleaned = sanitizeValue(req.query);
    for (const k of Object.keys(req.query)) delete req.query[k];
    Object.assign(req.query, cleaned);
  }
  if (req.params && typeof req.params === 'object') req.params = sanitizeValue(req.params);
  next();
}

module.exports = { mongoSanitize };
