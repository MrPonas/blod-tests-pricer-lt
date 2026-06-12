import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  // Supabase JS client doesn't expose raw DDL; use the REST /rpc approach
  // or just check if the column exists by querying it.
  const { error } = await db.from('tests').select('match_key').limit(1);
  if (!error) {
    console.log('Column match_key already exists — no migration needed.');
    return;
  }
  if (error.code !== '42703') {
    console.error('Unexpected error:', error);
    return;
  }

  console.log('Column does not exist. Please run this SQL in your Supabase SQL editor:');
  console.log('');
  console.log('ALTER TABLE tests ADD COLUMN IF NOT EXISTS match_key TEXT;');
  console.log('CREATE UNIQUE INDEX IF NOT EXISTS idx_tests_match_key');
  console.log('  ON tests(match_key) WHERE match_key IS NOT NULL;');
  console.log('');
  console.log('Then re-run: npx tsx scripts/generate-match-keys.ts --apply');
}

main().catch(console.error);
