import { createClient } from '@supabase/supabase-js';
import type { Test } from '@/lib/types';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function getLabId(slug: string): Promise<number | null> {
  const { data } = await db().from('labs').select('id').eq('slug', slug).single();
  return data?.id ?? null;
}

export async function getAllTests(): Promise<Test[]> {
  const { data, error } = await db().from('tests').select('*');
  if (error) throw error;
  return data ?? [];
}

// Look up the canonical test_id by URL slug across all labs.
// Anteja and Rezus both use the same URL slug structure for the same tests,
// so this is a reliable cross-lab identity signal.
// Returns the test_id of any existing price that shares this slug, or null.
export async function findTestByUrlSlug(url: string, excludeLabId: number): Promise<number | null> {
  let slug: string;
  try { slug = new URL(url).pathname.replace(/^\//, '').replace(/\/$/, ''); }
  catch { return null; }
  if (!slug) return null;

  const { data } = await db()
    .from('prices')
    .select('test_id')
    .like('lab_test_url', `%/${slug}`)
    .neq('lab_id', excludeLabId)
    .eq('is_stale', false)
    .limit(1)
    .single();
  return data?.test_id ?? null;
}

export async function upsertPrice(params: {
  testId: number;
  labId: number;
  priceEur: number;
  labTestName: string;
  labTestUrl: string | null;
}) {
  // Check current price to detect changes
  const { data: existing } = await db()
    .from('prices')
    .select('price_eur')
    .eq('test_id', params.testId)
    .eq('lab_id', params.labId)
    .single();

  const priceChanged = !existing || Number(existing.price_eur) !== params.priceEur;

  const { error } = await db().from('prices').upsert(
    {
      test_id: params.testId,
      lab_id: params.labId,
      price_eur: params.priceEur,
      lab_test_name: params.labTestName,
      lab_test_url: params.labTestUrl,
      scraped_at: new Date().toISOString(),
      is_stale: false,
    },
    { onConflict: 'test_id,lab_id' }
  );
  if (error) throw error;

  // Record history only when price changes (or first time)
  if (priceChanged) {
    await db().from('price_history').insert({
      test_id: params.testId,
      lab_id: params.labId,
      price_eur: params.priceEur,
      recorded_at: new Date().toISOString(),
    });
  }
}

export async function insertPendingReview(params: {
  labId: number;
  rawName: string;
  priceEur: number;
}) {
  const truncated = params.rawName.substring(0, 500);
  // Skip if an identical unresolved entry already exists (same lab + name)
  const { data: existing } = await db()
    .from('pending_review')
    .select('id')
    .eq('lab_id', params.labId)
    .eq('raw_name', truncated)
    .eq('is_resolved', false)
    .limit(1)
    .single();
  if (existing) return;

  const { error } = await db().from('pending_review').insert({
    lab_id: params.labId,
    raw_name: truncated,
    price_eur: params.priceEur,
  });
  if (error) console.error('pending_review insert failed:', error.message);
}

export async function insertScrapeRun(labId: number): Promise<number> {
  const { data, error } = await db()
    .from('scrape_runs')
    .insert({ lab_id: labId, started_at: new Date().toISOString(), status: 'running' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateScrapeRun(
  id: number,
  update: { status: 'success' | 'partial' | 'failed'; testsUpdated?: number; errorMessage?: string }
) {
  const { error } = await db()
    .from('scrape_runs')
    .update({
      finished_at: new Date().toISOString(),
      status: update.status,
      tests_updated: update.testsUpdated ?? 0,
      error_message: update.errorMessage ?? null,
    })
    .eq('id', id);
  if (error) console.error('updateScrapeRun failed:', error.message);
}

export async function addAliasIfNew(testId: number, alias: string) {
  const { error } = await db().rpc('add_test_alias', { p_test_id: testId, p_alias: alias });
  if (error) console.error('addAliasIfNew failed:', error.message);
}

export async function markLabPricesStale(labId: number) {
  const { error } = await db()
    .from('prices')
    .update({ is_stale: true })
    .eq('lab_id', labId);
  if (error) console.error('markLabPricesStale failed:', error.message);
}

export async function setMatchKey(testId: number, key: string) {
  const { error } = await db()
    .from('tests')
    .update({ match_key: key })
    .eq('id', testId)
    .is('match_key', null);
  if (error) console.error('setMatchKey failed:', error.message);
}
