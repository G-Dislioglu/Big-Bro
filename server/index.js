import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { randomUUID } from 'crypto';

const { Pool } = pg;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory (root of monorepo)
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const CORS_ORIGIN = process.env.CORS_ORIGIN;

// Database connection pool (only if DATABASE_URL is set)
let db = null;
if (DATABASE_URL) {
  db = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });
}

// Ensure database schema exists
async function ensureSchema() {
  if (!db) return;
  
  try {
    // Create settings table
    await db.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Create tasks table
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    console.log('✓ Database schema initialized');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
}

// Middleware: Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for easier development
}));

// Middleware: CORS
const corsOptions = CORS_ORIGIN ? { origin: CORS_ORIGIN } : {};
app.use(cors(corsOptions));

// Middleware: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Middleware: Parse JSON
app.use(express.json());

// Middleware: Authentication
function requireAuth(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  
  if (!ADMIN_KEY) {
    return res.status(500).json({ error: 'Server configuration error: ADMIN_KEY not set' });
  }
  
  if (!adminKey || adminKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing x-admin-key' });
  }
  
  next();
}

// Middleware: Database required
function requireDB(req, res, next) {
  if (!db || !DATABASE_URL) {
    return res.status(503).json({ 
      error: 'Service Unavailable: DATABASE_URL is not configured. Please set DATABASE_URL environment variable.' 
    });
  }
  next();
}

// Routes
// GET /api/health - Public health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'not configured'
  });
});

// GET /api/auth/whoami - Protected authentication check
app.get('/api/auth/whoami', requireAuth, (req, res) => {
  res.json({ 
    authenticated: true,
    message: 'You are authenticated as admin'
  });
});

// GET /api/settings - Get all settings (Protected, DB required)
app.get('/api/settings', requireAuth, requireDB, async (req, res, next) => {
  try {
    const result = await db.query('SELECT key, value, updated_at FROM settings ORDER BY key');
    res.json({ settings: result.rows });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings - Update a setting (Protected, DB required)
app.put('/api/settings', requireAuth, requireDB, async (req, res, next) => {
  try {
    const { key, value } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }
    
    const result = await db.query(
      `INSERT INTO settings (key, value, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, updated_at = NOW()
       RETURNING key, value, updated_at`,
      [key, value]
    );
    
    res.json({ setting: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks - Get all tasks (Protected, DB required)
app.get('/api/tasks', requireAuth, requireDB, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, title, status, created_at, updated_at FROM tasks ORDER BY created_at DESC'
    );
    res.json({ tasks: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks - Create a new task (Protected, DB required)
app.post('/api/tasks', requireAuth, requireDB, async (req, res, next) => {
  try {
    const { title, status = 'todo' } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const id = randomUUID();
    const result = await db.query(
      `INSERT INTO tasks (id, title, status, created_at, updated_at) 
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, title, status, created_at, updated_at`,
      [id, title, status]
    );
    
    res.status(201).json({ task: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks - Update a task (Protected, DB required)
app.patch('/api/tasks', requireAuth, requireDB, async (req, res, next) => {
  try {
    const { id, title, status } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Task ID is required' });
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const result = await db.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, title, status, created_at, updated_at`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ task: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Serve static files from client/dist in production
const clientDistPath = path.join(__dirname, '../client/dist');
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
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize and start server
async function start() {
  try {
    // Initialize database schema if DATABASE_URL is set
    if (db) {
      await ensureSchema();
    } else {
      console.log('ℹ DATABASE_URL not set - running without database (settings & tasks endpoints will return 503)');
    }
    
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
