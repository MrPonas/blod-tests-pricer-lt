import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';

// Run DDL statements one at a time via rpc('exec_sql') won't work on Supabase anon.
// Instead we use supabase-js to call a series of RPCs and table operations
// that achieve the same result as the migration SQL.

// For raw DDL we use the Supabase Management API (no extra password needed).

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!
  .replace('https://', '')
  .split('.')[0];

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function runSQL(sql: string): Promise<void> {
  if (!SUPABASE_ACCESS_TOKEN) {
    throw new Error(
      'Set SUPABASE_ACCESS_TOKEN in .env.local — get it from https://supabase.com/dashboard/account/tokens'
    );
  }

  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SQL failed (${res.status}): ${body}`);
  }

  const result = await res.json();
  if (result.error) throw new Error(result.error.message ?? JSON.stringify(result.error));
}

const STEPS: Array<{ name: string; sql: string }> = [
  {
    name: 'Enable pgvector',
    sql: `CREATE EXTENSION IF NOT EXISTS vector;`,
  },
  {
    name: 'Add embedding column',
    sql: `ALTER TABLE tests ADD COLUMN IF NOT EXISTS embedding vector(1024);`,
  },
  {
    name: 'Add loinc_code column',
    sql: `ALTER TABLE tests ADD COLUMN IF NOT EXISTS loinc_code VARCHAR(20) UNIQUE;`,
  },
  {
    name: 'Create embedding index',
    sql: `CREATE INDEX IF NOT EXISTS tests_embedding_idx ON tests
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);`,
  },
  {
    name: 'Create test_name_mappings table',
    sql: `CREATE TABLE IF NOT EXISTS test_name_mappings (
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
    );`,
  },
  {
    name: 'Create mapping_jobs table',
    sql: `CREATE TABLE IF NOT EXISTS mapping_jobs (
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
    );`,
  },
  {
    name: 'Create mapping_review_queue table',
    sql: `CREATE TABLE IF NOT EXISTS mapping_review_queue (
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
    );`,
  },
  {
    name: 'Create match_tests function',
    sql: `CREATE OR REPLACE FUNCTION match_tests(
      query_embedding vector(1024),
      match_threshold float,
      match_count int
    )
    RETURNS TABLE (id int, canonical_name_lt text, canonical_name_en text, similarity float)
    LANGUAGE sql STABLE AS $$
      SELECT id, canonical_name_lt, canonical_name_en,
        1 - (embedding <=> query_embedding) AS similarity
      FROM tests
      WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> query_embedding) > match_threshold
      ORDER BY similarity DESC
      LIMIT match_count;
    $$;`,
  },
];

async function main() {
  console.log(`Migrating project: ${PROJECT_REF}`);

  for (const step of STEPS) {
    process.stdout.write(`  ${step.name}... `);
    try {
      await runSQL(step.sql);
      console.log('✓');
    } catch (err) {
      console.log('✗');
      console.error(`    Error: ${err}`);
      process.exit(1);
    }
  }

  console.log('\nMigration complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
