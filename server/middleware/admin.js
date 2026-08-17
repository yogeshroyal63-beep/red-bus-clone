// Shared admin gate. Requires a valid token AND an explicit allowlisted admin
// user id via env (ADMIN_USER_IDS). In a real deploy this would check
// User.role === 'admin' via a DB lookup instead — this is the same stopgap
// notifications.js already used for GET /notifications/log, now shared so
// reviews.js and community.js can offer real moderation tooling too instead
// of "blind auto-hide is the only mechanism that exists."
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

function requireAdmin(req, res, next) {
  if (!ADMIN_USER_IDS.length) {
    return res.status(503).json({ error: 'Admin access not configured (set ADMIN_USER_IDS).' });
  }
  if (!ADMIN_USER_IDS.includes(req.userId)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { requireAdmin, ADMIN_USER_IDS };
