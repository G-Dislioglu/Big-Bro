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
    // Enable pgcrypto for gen_random_uuid()
    await db.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    
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
    
    // Create idea_cards table (PR-1: Idea Cards + Links)
    await db.query(`
      CREATE TABLE IF NOT EXISTS idea_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        tags TEXT[] NOT NULL DEFAULT '{}',
        layer TEXT NOT NULL CHECK (layer IN ('Rational', 'Spekulativ', 'Meta')),
        value_pct INT NOT NULL DEFAULT 50 CHECK (value_pct >= 0 AND value_pct <= 100),
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'tested', 'validated', 'killed')),
        risk_notes TEXT NOT NULL DEFAULT '',
        next_steps TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'text-note',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Ensure new columns exist (for existing tables)
    await db.query(`ALTER TABLE idea_cards ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text-note'`);
    await db.query(`ALTER TABLE idea_cards ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb`);

    const statusConstraints = await db.query(
      `SELECT con.conname
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       WHERE rel.relname = 'idea_cards' AND con.contype = 'c'`
    );

    for (const row of statusConstraints.rows) {
      if (String(row.conname || '').includes('status')) {
        await db.query(`ALTER TABLE idea_cards DROP CONSTRAINT IF EXISTS ${row.conname}`);
      }
    }

    await db.query(
      `ALTER TABLE idea_cards
       ADD CONSTRAINT idea_cards_status_check
       CHECK (status IN ('draft', 'active', 'archived', 'tested', 'validated', 'killed'))`
    );
    
    // Create indexes for idea_cards
    await db.query(`CREATE INDEX IF NOT EXISTS idx_idea_cards_created_at ON idea_cards(created_at DESC)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_idea_cards_status ON idea_cards(status)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_idea_cards_layer ON idea_cards(layer)`);
    
    // Create idea_card_links table (PR-1: Idea Cards + Links)
    await db.query(`
      CREATE TABLE IF NOT EXISTS idea_card_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL REFERENCES idea_cards(id) ON DELETE CASCADE,
        target_id UUID NOT NULL REFERENCES idea_cards(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('supports', 'contradicts', 'depends_on', 'variant_of')),
        weight INT NOT NULL DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),
        note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT idea_card_links_no_self_link CHECK (source_id <> target_id),
        CONSTRAINT idea_card_links_unique UNIQUE (source_id, target_id, type)
      )
    `);
    
    // Create indexes for idea_card_links
    await db.query(`CREATE INDEX IF NOT EXISTS idx_idea_links_source ON idea_card_links(source_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_idea_links_target ON idea_card_links(target_id)`);
    
    // Big-Bro Kernel Schema for Scout-Swarm
    // 1. Extension für Vektor-Suche aktivieren (falls noch nicht da)
    await db.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // 2. Enum für die Art der Information
    await db.query(`
      DO $$ BEGIN
          CREATE TYPE memory_type AS ENUM ('fact', 'idea', 'risk', 'strategy', 'critique', 'structure');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$
    `);

    // 3. TABLE: kernel_objects (Der Inhalt - speichert jeden Gedanken nur 1x)
    await db.query(`
      CREATE TABLE IF NOT EXISTS kernel_objects (
        id BIGSERIAL PRIMARY KEY,
        content_hash CHAR(64) UNIQUE NOT NULL, -- SHA256 Hash des Inhalts zur Deduplizierung
        memory_type memory_type NOT NULL,
        canonical_json JSONB NOT NULL,         -- Der rohe Inhalt als JSON
        embedding VECTOR(1536),                -- Vektor für semantische Suche (OpenAI Standard)
        tsv TSVECTOR GENERATED ALWAYS AS (     -- Volltext-Suche Index
            to_tsvector('german', COALESCE(canonical_json->>'description', '') || ' ' || COALESCE(canonical_json->>'title', ''))
        ) STORED,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Index für schnelle Vektor-Suche (HNSW ist State-of-the-Art)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_kernel_objects_embedding 
    ON kernel_objects USING hnsw (embedding vector_cosine_ops)`);

    // Index für Volltext-Suche
    await db.query(`CREATE INDEX IF NOT EXISTS idx_kernel_objects_tsv ON kernel_objects USING GIN(tsv)`);


    // 4. TABLE: kernel_instances (Die Vorkommen - Wer hat es wann gesagt?)
    await db.query(`
      CREATE TABLE IF NOT EXISTS kernel_instances (
        id BIGSERIAL PRIMARY KEY,
        object_id BIGINT REFERENCES kernel_objects(id) ON DELETE CASCADE,
        source_agent VARCHAR(50) NOT NULL,     -- z.B. "scout-gemini-flash"
        confidence_score FLOAT DEFAULT 1.0,    -- Wie sicher ist sich der Agent?
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Index für schnelle Abfragen pro Agent
    await db.query(`CREATE INDEX IF NOT EXISTS idx_kernel_instances_source ON kernel_instances(source_agent)`);
    
    console.log('✓ Database schema initialized');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
}

module.exports = { db, ensureSchema };
