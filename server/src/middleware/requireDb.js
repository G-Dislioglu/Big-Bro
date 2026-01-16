const config = require('../config');

function requireDb(req, res, next) {
  if (!config.isDbConfigured) {
    return res.status(503).json({ 
      error: 'Service Unavailable: DATABASE_URL is not configured. Please set DATABASE_URL environment variable.' 
    });
  }
  next();
}

module.exports = requireDb;
