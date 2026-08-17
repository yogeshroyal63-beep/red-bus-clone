const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Security headers
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  crossOriginEmbedderPolicy: false
});

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again after 15 minutes.' }
});

// Auth-specific limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});

// Booking limiter
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many booking attempts. Please slow down.' }
});

// Traffic proxy limiter — this endpoint makes a live, billed call to a third-party
// (TomTom) on every miss, is unauthenticated (optionalAuth), and previously sat behind
// only the global 200/15min limiter shared with every other route. An unauthenticated
// actor could cheaply exhaust the traffic API budget by looping distinct lat/lng pairs
// (Finding R). This gives it its own tighter budget, independent of the global one.
const trafficLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many traffic lookups. Please slow down.' }
});

// Validation middleware
const validateBooking = [
  body('busId').notEmpty().withMessage('Bus ID is required'),
  body('seats').isArray({ min: 1 }).withMessage('At least one seat required'),
  body('totalAmount').isNumeric().isFloat({ min: 1 }).withMessage('Invalid amount'),
  body('contactEmail').isEmail().withMessage('Valid email required'),
  body('contactPhone').isMobilePhone('en-IN').withMessage('Valid Indian mobile number required'),
  body('passengerDetails').isArray({ min: 1 }).withMessage('Passenger details required'),
  body('passengerDetails.*.name').notEmpty().trim().escape().withMessage('Passenger name required'),
  body('passengerDetails.*.age').isInt({ min: 1, max: 120 }).withMessage('Valid age required'),
  body('passengerDetails.*.gender').isIn(['M', 'F']).withMessage('Gender must be M or F'),
];

const validateRegister = [
  body('name').notEmpty().trim().escape().isLength({ min: 2, max: 60 }).withMessage('Name must be 2-60 chars'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('mobile').isMobilePhone('en-IN').withMessage('Valid Indian mobile required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase and number'),
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

// Req 3 fix: maps an express-validator field path to an i18n key so
// handleValidationErrors (below) can give the frontend something translatable instead of
// only the hardcoded English `msg` text above.
const FIELD_ERROR_CODES = {
  name: 'auth.err.name',
  email: 'val.email',
  mobile: 'val.phone',
  password: 'auth.passwordHint',
  'passengerDetails': 'val.required',
  'passengerDetails.*.name': 'val.required',
  'passengerDetails.*.age': 'val.age',
  'passengerDetails.*.gender': 'val.selectGender',
  busId: 'val.required',
  seats: 'val.selectSeats',
  totalAmount: 'val.required',
  contactEmail: 'val.email',
  contactPhone: 'val.phone',
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Validation failed',
      code: 'err.validationFailed',
      // field -> i18n key mapping lets the frontend show a real translated message per
      // field without the server needing to know the user's language (Req 3 fix).
      details: errors.array().map(e => ({ field: e.path, message: e.msg, code: FIELD_ERROR_CODES[e.path] || 'err.validationFailed' }))
    });
  }
  next();
};

module.exports = { helmetMiddleware, globalLimiter, authLimiter, bookingLimiter, trafficLimiter, validateBooking, validateRegister, validateLogin, handleValidationErrors };
