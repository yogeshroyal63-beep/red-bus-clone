const jwt = require('jsonwebtoken');

// The hardcoded fallback secret used to apply whenever JWT_SECRET wasn't set — which
// server.js only refused to boot on when NODE_ENV was the exact string 'production'.
// Netlify/Vercel function runtimes don't reliably set that for every deploy target, so
// this could silently boot on a secret that's sitting in the public repo, letting anyone
// mint a valid token for any userId. There is no safe fallback for a signing secret:
// if it isn't set, refuse to load this module at all rather than pick one.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. There is no default — set a ' +
    'real secret (32+ random chars) before starting the server, in every environment, ' +
    'including local dev.'
  );
}
const JWT_EXPIRES = '7d';

// Finding S: logout used to be a literal no-op ("client should discard token; server-side
// blacklist would go here") — with 7-day tokens sitting in localStorage, a leaked token
// stayed fully valid for up to 7 days no matter how many times the owner "logged out".
// This in-memory blacklist is a real, if best-effort, fix: a token revoked via /logout is
// rejected by verifyToken from that point on. It resets on process restart and doesn't
// scale across multiple server instances (a production deploy would want this in Redis,
// keyed by the token's jti with a TTL matching JWT_EXPIRES) — but it's a genuine
// improvement over doing nothing, and closes the gap for the common single-instance case.
const revokedTokens = new Set();
function revokeToken(token) { revokedTokens.add(token); }

// Signing the display name into the token (rather than trusting a client-supplied
// userName on every write) closes Finding #5: any verified user could previously post a
// review/post under any display name they chose in the request body, e.g. impersonating
// someone. The name here is exactly what the account registered with, verified once at
// login/register time, and can't be overridden per-request.
const generateToken = (userId, name) => {
  return jwt.sign({ userId, name, iat: Date.now() }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
};

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Access token required' });
  if (revokedTokens.has(token)) return res.status(401).json({ error: 'Token has been logged out. Please login again.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userName = decoded.name;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired. Please login again.' });
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token && !revokedTokens.has(token)) {
    try { const d = jwt.verify(token, JWT_SECRET); req.userId = d.userId; req.userName = d.name; req.token = token; } catch {}
  }
  next();
};

module.exports = { generateToken, verifyToken, optionalAuth, revokeToken };
