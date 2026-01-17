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
    
    // Create cards table for Strategy Lab
    await db.query(`
      CREATE TABLE IF NOT EXISTS cards (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'idea',
        content TEXT,
        tags TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Create card_links table for Strategy Lab
    await db.query(`
      CREATE TABLE IF NOT EXISTS card_links (
        id UUID PRIMARY KEY,
        from_card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        to_card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        link_type TEXT NOT NULL DEFAULT 'related',
        strength INT DEFAULT 3 CHECK (strength >= 1 AND strength <= 5),
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Create card_runs table for Strategy Lab (optional for MVP but included)
    await db.query(`
      CREATE TABLE IF NOT EXISTS card_runs (
        id UUID PRIMARY KEY,
        input JSONB,
        output JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    console.log('✓ Database schema initialized');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
}

module.exports = { db, ensureSchema };
