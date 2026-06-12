import { createServerClient } from './supabase';
import type { Price, TestWithPrices } from './types';

interface SearchRpcRow {
  id: number;
  canonical_name_lt: string;
  canonical_name_en: string | null;
  category_slug: string | null;
  similarity: number;
}

export async function fuzzySearchTests(query: string, limit = 20): Promise<TestWithPrices[]> {
  const db = createServerClient();

  const { data: rows, error } = await db.rpc('search_tests', {
    query: query.trim(),
    min_similarity: 0.15,
    result_limit: Math.min(limit * 3, 60),
  });

  if (error || !rows?.length) return [];

  const ids = (rows as SearchRpcRow[]).map((r) => r.id);

  const { data: tests } = await db
    .from('tests')
    .select('*, category:categories(*), prices(*, lab:labs(*))')
    .in('id', ids);

  if (!tests?.length) return [];

  const simMap = new Map((rows as SearchRpcRow[]).map((r) => [r.id, r.similarity]));

  return (tests as unknown as TestWithPrices[])
    .filter((t) => t.prices.some((p: Price) => !p.is_stale && Number(p.price_eur) > 0))
    .sort((a, b) => (simMap.get(b.id) ?? 0) - (simMap.get(a.id) ?? 0))
    .slice(0, limit);
}
