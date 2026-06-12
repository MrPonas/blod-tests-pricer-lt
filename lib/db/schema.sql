-- LT Blood Test Price Aggregator — Database Schema

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS labs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  website_url TEXT NOT NULL,
  booking_url TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name_lt VARCHAR(200) NOT NULL,
  name_en VARCHAR(200),
  slug VARCHAR(100) UNIQUE NOT NULL,
  icon VARCHAR(10),
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tests (
  id SERIAL PRIMARY KEY,
  canonical_name_lt VARCHAR(300) NOT NULL,
  canonical_name_en VARCHAR(300),
  category_id INTEGER REFERENCES categories(id),
  aliases TEXT[] DEFAULT '{}',
  match_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tests_category ON tests(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tests_match_key ON tests(match_key) WHERE match_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS prices (
  id SERIAL PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES tests(id),
  lab_id INTEGER NOT NULL REFERENCES labs(id),
  price_eur NUMERIC(8,2) NOT NULL,
  lab_test_name VARCHAR(300),
  lab_test_url TEXT,
  scraped_at TIMESTAMPTZ NOT NULL,
  is_stale BOOLEAN DEFAULT false,
  UNIQUE(test_id, lab_id)
);

CREATE INDEX IF NOT EXISTS prices_test ON prices(test_id);
CREATE INDEX IF NOT EXISTS prices_lab ON prices(lab_id);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id SERIAL PRIMARY KEY,
  lab_id INTEGER REFERENCES labs(id),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status VARCHAR(20),
  tests_updated INTEGER DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS pending_review (
  id SERIAL PRIMARY KEY,
  lab_id INTEGER REFERENCES labs(id),
  raw_name VARCHAR(300) NOT NULL,
  price_eur NUMERIC(8,2),
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  is_resolved BOOLEAN DEFAULT false,
  resolved_test_id INTEGER REFERENCES tests(id)
);

-- Seed labs
INSERT INTO labs (name, slug, website_url, booking_url) VALUES
  ('Synlab',  'synlab',  'https://www.synlab.lt',   'https://www.synlab.lt/registracija'),
  ('Anteja',  'anteja',  'https://anteja.lt',        'https://anteja.lt'),
  ('Affidea', 'affidea', 'https://www.affidea.lt',   'https://www.affidea.lt'),
  ('Meliva',  'meliva',  'https://meliva.lt',        'https://meliva.lt'),
  ('Rezus',   'rezus',   'https://rezus.lt',         'https://rezus.lt')
ON CONFLICT (slug) DO NOTHING;

-- Seed categories
INSERT INTO categories (name_lt, name_en, slug, icon, sort_order) VALUES
  ('Bendra kraujo analizė',      'Complete blood count', 'bendra-kraujo-analize', '🩸', 1),
  ('Hormonai',                   'Hormones',             'hormonai',              '⚗️', 2),
  ('Vitaminai',                  'Vitamins',             'vitaminai',             '💊', 3),
  ('Biochemija',                 'Biochemistry',         'biochemija',            '🔬', 4),
  ('Infekcijos ir serologijos',  'Infections/Serology',  'infekcijos',            '🦠', 5),
  ('Alergologijos',              'Allergy',              'alergologijos',         '🌿', 6),
  ('Onkologiniai žymenys',       'Tumor markers',        'onkologiniai',          '🔴', 7),
  ('Kita',                       'Other',                'kita',                  '📋', 8)
ON CONFLICT (slug) DO NOTHING;

-- Price change history
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
  lab_id INTEGER REFERENCES labs(id),
  price_eur NUMERIC(8,2) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS price_history_test_lab ON price_history(test_id, lab_id, recorded_at DESC);

-- Idempotent alias append: adds alias only if not already present
CREATE OR REPLACE FUNCTION add_test_alias(p_test_id INT, p_alias TEXT)
RETURNS void LANGUAGE sql AS $$
  UPDATE tests
  SET aliases = array_append(aliases, p_alias)
  WHERE id = p_test_id
    AND NOT (aliases @> ARRAY[p_alias]);
$$;

-- ── Mapping system additions ──────────────────────────────────────────────────

-- Enable pgvector (run once in Supabase SQL editor)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding and LOINC columns to canonical tests table
ALTER TABLE tests ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE tests ADD COLUMN IF NOT EXISTS loinc_code VARCHAR(20) UNIQUE;

-- Full-text search vector (auto-maintained)
ALTER TABLE tests ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple'::regconfig, canonical_name_lt || ' ' || COALESCE(canonical_name_en, '') || ' ' || COALESCE(array_to_string(aliases, ' '), ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS tests_embedding_idx ON tests
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS tests_search_vector_idx ON tests USING GIN(search_vector);

-- Permanent mapping cache: vendor raw name → canonical test
CREATE TABLE IF NOT EXISTS test_name_mappings (
  id                   SERIAL PRIMARY KEY,
  lab_id               INTEGER NOT NULL REFERENCES labs(id),
  raw_name             VARCHAR(500) NOT NULL,
  raw_name_normalized  VARCHAR(500) NOT NULL,
  canonical_test_id    INTEGER REFERENCES tests(id),
  match_method         VARCHAR(20) NOT NULL,
  match_confidence     NUMERIC(4,3),
  ai_reasoning         TEXT,
  verified_by_human    BOOLEAN DEFAULT false,
  created_at           TIMESTAMP DEFAULT NOW(),
  UNIQUE(lab_id, raw_name_normalized)
);

-- Job queue: raw names the scraper couldn't resolve from cache
CREATE TABLE IF NOT EXISTS mapping_jobs (
  id           SERIAL PRIMARY KEY,
  lab_id       INTEGER NOT NULL REFERENCES labs(id),
  raw_name     VARCHAR(500) NOT NULL,
  price_eur    NUMERIC(8,2),
  lab_test_url TEXT,
  status       VARCHAR(20) DEFAULT 'pending',
  claimed_at   TIMESTAMP,
  finished_at  TIMESTAMP,
  error        TEXT,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Human review queue: low-confidence agent decisions
CREATE TABLE IF NOT EXISTS mapping_review_queue (
  id                SERIAL PRIMARY KEY,
  lab_id            INTEGER NOT NULL REFERENCES labs(id),
  raw_name          VARCHAR(500) NOT NULL,
  price_eur         NUMERIC(8,2),
  ai_suggestion_id  INTEGER REFERENCES tests(id),
  ai_confidence     NUMERIC(4,3),
  ai_reasoning      TEXT,
  status            VARCHAR(20) DEFAULT 'pending',
  reviewed_at       TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Vector similarity search function (called via supabase.rpc)
CREATE OR REPLACE FUNCTION match_tests(
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
RETURNS TABLE (id int, canonical_name_lt text, canonical_name_en text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    canonical_name_lt,
    canonical_name_en,
    1 - (embedding <=> query_embedding) AS similarity
  FROM tests
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
