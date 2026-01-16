const { Pool } = require('pg');
const config = require('./config');

// Database connection pool (only if DATABASE_URL is set)
let db = null;
if (config.databaseUrl) {
  db = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
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
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Create tasks table with constraint
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'doing', 'done'))
      )
    `);
    
    console.log('✓ Database schema initialized');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
}

module.exports = { db, ensureSchema };
