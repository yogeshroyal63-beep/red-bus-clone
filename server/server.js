const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { helmetMiddleware, globalLimiter } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ── JWT_SECRET is mandatory in every environment — see middleware/auth.middleware.js
// for why the previous NODE_ENV==='production' guard was bypassable (Finding L).
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

// ── Trust the first hop of the reverse proxy (Netlify/Vercel edge, or any single
// reverse proxy in front of this server). express-rate-limit v7 validates
// X-Forwarded-For against this setting and throws/misattributes IPs without it —
// and this app is required to run behind exactly that kind of proxy (Finding T).
// Set TRUST_PROXY_HOPS to the real number of proxies in front of the app if it's
// ever more than one hop.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS || '1', 10));

// ── Security headers
app.use(helmetMiddleware);

// ── CORS
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:4200', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Body parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// ── Strip Mongo-operator injection from all request input (Finding M)
const { mongoSanitize } = require('./middleware/sanitize');
app.use(mongoSanitize);

// ── Global rate limiting
app.use('/api/', globalLimiter);

// ── Request logger (dev only)
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const dur = Date.now() - start;
      const c = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(`${c}${req.method}\x1b[0m ${req.originalUrl} → ${res.statusCode} (${dur}ms)`);
    });
    next();
  });
}

// ── ISSUE #6: MongoDB — fail LOUDLY, never silently degrade
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/redbus';
let isDbConnected = false;

mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    isDbConnected = true;
    console.log(`✅ MongoDB connected: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//<credentials>@')}`);
  })
  .catch(err => {
    console.warn(`⚠️  MongoDB connection failed: ${err.message}`);
    console.warn('   Running with IN-MEMORY FALLBACK — data will NOT persist on restart');
    console.warn('   Set MONGODB_URI environment variable to persist data');
    // We do NOT exit — in-memory fallback is intentional for local dev/demo
    // In production, change this to: process.exit(1);
  });

// ── DB health middleware — expose connection state to routes
app.use((req, res, next) => {
  req.dbConnected = mongoose.connection.readyState === 1;
  next();
});

// ── Routes
app.use('/api/buses', require('./routes/buses'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/seats', require('./routes/seats'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/community', require('./routes/community'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/traffic', require('./routes/traffic'));

// ── Health check — shows real DB state
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  env: NODE_ENV,
  mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected (in-memory fallback active)',
  mongoState: mongoose.connection.readyState,
  timestamp: new Date().toISOString(),
  uptime: Math.floor(process.uptime()) + 's',
  version: process.env.npm_package_version || '2.0.0'
}));

// ── 404 handler
app.use('/api/*', (req, res) => res.status(404).json({ error: `Route ${req.originalUrl} not found` }));

// ── Global error handler
app.use((err, req, res, next) => {
  if (NODE_ENV !== 'test') console.error('[ERROR]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(NODE_ENV === 'development' && { stack: err.stack?.split('\n').slice(0, 4) })
  });
});

if (NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n🚌 redBus Server [${NODE_ENV}] → http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
  });
}

module.exports = app;
