const config = require('../config');

function requireAuth(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  
  if (!config.adminKey) {
    return res.status(500).json({ error: 'Server configuration error: ADMIN_KEY not set' });
  }
  
  if (!adminKey || adminKey !== config.adminKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing x-admin-key' });
  }
  
  next();
}

module.exports = requireAuth;
