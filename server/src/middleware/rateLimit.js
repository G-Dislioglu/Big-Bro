// In-memory rate limiting middleware
const rateLimit = {};

function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;

  // Initialize or get rate limit data for this IP
  if (!rateLimit[ip]) {
    rateLimit[ip] = { count: 0, resetTime: now + windowMs };
  }

  const ipData = rateLimit[ip];

  // Reset if window has passed
  if (now > ipData.resetTime) {
    ipData.count = 0;
    ipData.resetTime = now + windowMs;
  }

  // Increment request count
  ipData.count++;

  // Check if limit exceeded
  if (ipData.count > maxRequests) {
    return res.status(429).json({
      error: 'Too many requests, please try again later.'
    });
  }

  next();
}

// Cleanup old entries periodically (every hour)
setInterval(() => {
  const now = Date.now();
  Object.keys(rateLimit).forEach(ip => {
    if (now > rateLimit[ip].resetTime + 60 * 60 * 1000) {
      delete rateLimit[ip];
    }
  });
}, 60 * 60 * 1000);

module.exports = rateLimitMiddleware;
