const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const { ensureSchema } = require('./db');
const rateLimitMiddleware = require('./middleware/rateLimit');
const errorHandler = require('./middleware/error');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const settingsRouter = require('./routes/settings');
const tasksRouter = require('./routes/tasks');
const cardsRouter = require('./routes/cards');
const cardLinksRouter = require('./routes/card-links');
const crossingRouter = require('./routes/crossing');
const ideaCardsRouter = require('./routes/idea-cards');
const ideaLinksRouter = require('./routes/idea-links');

const app = express();

// Middleware: Helmet for security headers
if (config.enableHelmet) {
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for easier development
  }));
}

// Middleware: CORS
const corsOptions = config.corsOrigin ? { origin: config.corsOrigin } : {};
app.use(cors(corsOptions));

// Middleware: Parse JSON
app.use(express.json());

// Middleware: Rate limiting for API routes
app.use('/api/', rateLimitMiddleware);

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/card-links', cardLinksRouter);
app.use('/api/crossing', crossingRouter);
app.use('/api/idea-cards', ideaCardsRouter);
app.use('/api/links', ideaLinksRouter);

// Serve static files from client/dist in production
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Application not built. Run npm run build first.');
    }
  });
});

// Error handler middleware
app.use(errorHandler);

// Initialize and start server
async function start() {
  try {
    // Initialize database schema if DATABASE_URL is set
    if (config.isDbConfigured) {
      await ensureSchema();
    } else {
      console.log('ℹ DATABASE_URL not set - running without database (settings & tasks endpoints will return 503)');
    }
    
    app.listen(config.port, () => {
      console.log(`✓ Server running on port ${config.port}`);
      console.log(`✓ Health check: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
