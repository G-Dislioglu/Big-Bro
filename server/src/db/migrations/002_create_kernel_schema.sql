-- 1. Extension für Vektor-Suche aktivieren (falls noch nicht da)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Enum für die Art der Information
DO $$ BEGIN
    CREATE TYPE memory_type AS ENUM ('fact', 'idea', 'risk', 'strategy', 'critique', 'structure');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABLE: kernel_objects (Der Inhalt - speichert jeden Gedanken nur 1x)
CREATE TABLE IF NOT EXISTS kernel_objects (
  id BIGSERIAL PRIMARY KEY,
  content_hash CHAR(64) UNIQUE NOT NULL, -- SHA256 Hash des Inhalts zur Deduplizierung
  memory_type memory_type NOT NULL,
  canonical_json JSONB NOT NULL,         -- Der rohe Inhalt als JSON
  embedding VECTOR(1536),                -- Vektor für semantische Suche (OpenAI Standard)
  tsv TSVECTOR GENERATED ALWAYS AS (     -- Volltext-Suche Index
      to_tsvector('german', canonical_json->>'description')
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index für schnelle Vektor-Suche (HNSW ist State-of-the-Art)
CREATE INDEX IF NOT EXISTS idx_kernel_objects_embedding 
ON kernel_objects USING hnsw (embedding vector_cosine_ops);

-- Index für Volltext-Suche
CREATE INDEX IF NOT EXISTS idx_kernel_objects_tsv ON kernel_objects USING GIN(tsv);


-- 4. TABLE: kernel_instances (Die Vorkommen - Wer hat es wann gesagt?)
CREATE TABLE IF NOT EXISTS kernel_instances (
  id BIGSERIAL PRIMARY KEY,
  object_id BIGINT REFERENCES kernel_objects(id) ON DELETE CASCADE,
  source_agent VARCHAR(50) NOT NULL,     -- z.B. "scout-gemini-flash"
  confidence_score FLOAT DEFAULT 1.0,    -- Wie sicher ist sich der Agent?
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index für schnelle Abfragen pro Agent
CREATE INDEX IF NOT EXISTS idx_kernel_instances_source ON kernel_instances(source_agent);
