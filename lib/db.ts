import { createServerClient } from './supabase';
import { fuzzySearchTests } from './search';
import type { Lab, Category, Price, ScrapeRun, PendingReview, TestWithPrices } from './types';

function db() {
  return createServerClient();
}

let _supabaseAdmin: ReturnType<typeof createServerClient> | undefined;
function adminClient() {
  if (!_supabaseAdmin) _supabaseAdmin = createServerClient();
  return _supabaseAdmin;
}
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createServerClient>, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = adminClient();
    const val = (c as any)[prop];
    return typeof val === 'function' ? val.bind(c) : val;
  },
});

export async function getLabs(): Promise<Lab[]> {
  const { data, error } = await db()
    .from('labs')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await db()
    .from('categories')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function searchTests(query: string): Promise<TestWithPrices[]> {
  // Try pg_trgm fuzzy search first; fall back to ilike if RPC not available.
  try {
    const fuzzyResults = await fuzzySearchTests(query);
    if (fuzzyResults.length > 0) return fuzzyResults;
  } catch {
    // RPC not yet created — fall through to ilike fallback
  }

  return ilikeSearchTests(query);
}

async function ilikeSearchTests(query: string): Promise<TestWithPrices[]> {
  const term = `%${query}%`;

  // Use separate ilike queries instead of .or() to avoid PostgREST wildcard issues
  // with multi-word queries containing spaces (e.g. "Vitaminas D").
  const [{ data: byLt }, { data: byEn }] = await Promise.all([
    db()
      .from('tests')
      .select('*, category:categories(*), prices(*, lab:labs(*))')
      .ilike('canonical_name_lt', term)
      .limit(40),
    db()
      .from('tests')
      .select('*, category:categories(*), prices(*, lab:labs(*))')
      .ilike('canonical_name_en', term)
      .limit(20),
  ]);

  const seenIds = new Set<number>();
  const byName: NonNullable<typeof byLt> = [];
  for (const t of [...(byLt ?? []), ...(byEn ?? [])]) {
    if (!seenIds.has(t.id)) { seenIds.add(t.id); byName.push(t); }
  }

  // Also find tests matched by lab_test_name in prices (catches alias variants)
  const { data: byLabName } = await db()
    .from('prices')
    .select('test_id')
    .ilike('lab_test_name', term)
    .eq('is_stale', false)
    .limit(20);

  const labNameIds = (byLabName ?? [])
    .map((r) => r.test_id)
    .filter((id) => !seenIds.has(id));

  let byLabTests: typeof byName = [];
  if (labNameIds.length > 0) {
    const { data } = await db()
      .from('tests')
      .select('*, category:categories(*), prices(*, lab:labs(*))')
      .in('id', labNameIds);
    byLabTests = data ?? [];
    byLabTests.forEach((t) => seenIds.add(t.id));
  }

  // Also search aliases array for exact match (handles Lithuanian declension variants)
  const { data: byAlias } = await db()
    .from('tests')
    .select('*, category:categories(*), prices(*, lab:labs(*))')
    .contains('aliases', [query])
    .limit(20);
  const byAliasExtra = (byAlias ?? []).filter((t) => !seenIds.has(t.id));

  const all = [...byName, ...byLabTests, ...byAliasExtra];

  // Only show tests with at least one active (non-stale) price
  return all
    .filter((t) => t.prices.some((p: Price) => !p.is_stale && Number(p.price_eur) > 0))
    .sort((a, b) => {
      const aCount = a.prices.filter((p: Price) => !p.is_stale).length;
      const bCount = b.prices.filter((p: Price) => !p.is_stale).length;
      return bCount - aCount;
    })
    .slice(0, 20) as unknown as TestWithPrices[];
}

export async function getTestsByCategory(categorySlug: string): Promise<TestWithPrices[]> {
  const { data: category } = await db()
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();
  if (!category) return [];

  const { data, error } = await db()
    .from('tests')
    .select('*, category:categories(*), prices(*, lab:labs(*))')
    .eq('category_id', category.id)
    .order('canonical_name_lt');
  if (error) throw error;
  return (data ?? []) as unknown as TestWithPrices[];
}

export async function getRelatedTests(categoryId: number, excludeId: number, limit = 6): Promise<{ id: number; canonical_name_lt: string }[]> {
  const { data } = await db()
    .from('tests')
    .select('id, canonical_name_lt, prices!inner(price_eur, is_stale)')
    .eq('category_id', categoryId)
    .neq('id', excludeId)
    .eq('prices.is_stale', false)
    .gt('prices.price_eur', 0)
    .order('canonical_name_lt')
    .limit(limit * 4);
  const seen = new Set<number>();
  const out: { id: number; canonical_name_lt: string }[] = [];
  for (const t of data ?? []) {
    if (!seen.has(t.id)) { seen.add(t.id); out.push({ id: t.id, canonical_name_lt: t.canonical_name_lt }); }
    if (out.length >= limit) break;
  }
  return out;
}

export async function getTestById(id: number): Promise<TestWithPrices | null> {
  const { data, error } = await db()
    .from('tests')
    .select('*, category:categories(*), prices(*, lab:labs(*))')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as unknown as TestWithPrices;
}

export async function getAllCanonicalTests() {
  const { data, error } = await db().from('tests').select('id, canonical_name_lt, canonical_name_en, aliases');
  if (error) throw error;
  return (data ?? []) as { id: number; canonical_name_lt: string; canonical_name_en: string | null; aliases: string[] }[];
}

export async function getActiveTestIds(): Promise<number[]> {
  const { data } = await db()
    .from('prices')
    .select('test_id')
    .eq('is_stale', false)
    .gt('price_eur', 0);
  return [...new Set((data ?? []).map(r => r.test_id as number))];
}

export async function getAllTests(): Promise<TestWithPrices[]> {
  const { data, error } = await db()
    .from('tests')
    .select('*, category:categories(*), prices(*, lab:labs(*))')
    .order('canonical_name_lt');
  if (error) throw error;
  return (data ?? []) as unknown as TestWithPrices[];
}

export async function getScrapeRuns(limit = 30): Promise<ScrapeRun[]> {
  const { data, error } = await db()
    .from('scrape_runs')
    .select('*, lab:labs(*)')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ScrapeRun[];
}

export async function getPendingReview(): Promise<PendingReview[]> {
  const { data, error } = await db()
    .from('pending_review')
    .select('*, lab:labs(*)')
    .eq('is_resolved', false)
    .order('scraped_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PendingReview[];
}

export async function getPriceHistory(
  testId: number
): Promise<{ lab_id: number; lab_name: string; price_eur: number; recorded_at: string }[]> {
  const { data, error } = await db()
    .from('price_history')
    .select('lab_id, price_eur, recorded_at, lab:labs(name)')
    .eq('test_id', testId)
    .order('recorded_at', { ascending: false })
    .limit(60);
  if (error) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history = (data ?? []).map((r: any) => ({
    lab_id: r.lab_id,
    lab_name: r.lab?.name ?? '—',
    price_eur: Number(r.price_eur),
    recorded_at: r.recorded_at,
  }));

  // When no history exists yet, include current prices as a single data point
  // so charts can display the current state rather than showing "no data".
  if (history.length === 0) {
    const { data: current } = await db()
      .from('prices')
      .select('lab_id, price_eur, scraped_at, lab:labs(name)')
      .eq('test_id', testId)
      .eq('is_stale', false)
      .gt('price_eur', 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (current ?? []).map((r: any) => ({
      lab_id: r.lab_id,
      lab_name: r.lab?.name ?? '—',
      price_eur: Number(r.price_eur),
      recorded_at: r.scraped_at,
    }));
  }

  return history;
}
