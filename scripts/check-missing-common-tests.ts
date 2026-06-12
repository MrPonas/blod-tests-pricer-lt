/**
 * For each of the 16 "common" genuinely-missing B4 canonicals,
 * find the top active match at similarity ≥ 0.65 using match_tests RPC.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF  = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN        = process.env.SUPABASE_ACCESS_TOKEN!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function sql<T = Record<string, unknown>>(q: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data as T[];
}

async function matchTests(embedding: number[], threshold: number, count: number) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_tests`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query_embedding: embedding, match_threshold: threshold, match_count: count }),
  });
  if (!res.ok) return [];
  return res.json() as Promise<{ id: number; canonical_name_lt: string; similarity: number }[]>;
}

const TARGET_IDS = [82, 86, 87, 89, 109, 110, 124, 125, 150, 156, 172, 221, 253, 258, 259, 279];

async function main() {
  // Fetch embeddings + names for target IDs
  const rows = await sql<{ id: number; name: string; embedding: string }>(
    `SELECT id, canonical_name_lt AS name, embedding::text AS embedding
     FROM tests WHERE id IN (${TARGET_IDS.join(',')})`
  );

  // Price counts for active canonicals
  const pcRows = await sql<{ test_id: number; cnt: number }>(
    `SELECT test_id, COUNT(*)::int AS cnt FROM prices WHERE is_stale = false GROUP BY test_id`
  );
  const priceCounts = new Map(pcRows.map(r => [r.test_id, r.cnt]));

  const results: {
    missingId: number; missingName: string;
    activeId: number | null; activeName: string | null;
    similarity: number | null; priceCount: number | null;
  }[] = [];

  for (const row of rows) {
    const embedding = JSON.parse((row as any).embedding) as number[];
    const hits = await matchTests(embedding, 0.65, 10);
    // Find best active hit (has prices, not itself)
    const best = hits.find(h => h.id !== row.id && (priceCounts.get(h.id) ?? 0) > 0);
    results.push({
      missingId:   row.id,
      missingName: (row as any).name,
      activeId:    best?.id ?? null,
      activeName:  best?.canonical_name_lt ?? null,
      similarity:  best ? +best.similarity : null,
      priceCount:  best ? (priceCounts.get(best.id) ?? 0) : null,
    });
  }

  // Sort by missing id for consistent output
  results.sort((a, b) => a.missingId - b.missingId);

  const high   = results.filter(r => r.similarity !== null && r.similarity >= 0.80);
  const mid    = results.filter(r => r.similarity !== null && r.similarity >= 0.65 && r.similarity < 0.80);
  const noHit  = results.filter(r => r.similarity === null || r.similarity < 0.65);

  console.log(`\n=== ≥ 0.80 — almost certainly same test (${high.length}) ===\n`);
  for (const r of high) {
    console.log(`  [${r.similarity!.toFixed(4)}] missing=${r.missingId} → active=${r.activeId} (${r.priceCount} prices)`);
    console.log(`    missing: "${r.missingName}"`);
    console.log(`    active:  "${r.activeName}"`);
  }

  console.log(`\n=== 0.65–0.80 — possibly same, needs decision (${mid.length}) ===\n`);
  for (const r of mid) {
    console.log(`  [${r.similarity!.toFixed(4)}] missing=${r.missingId} → active=${r.activeId} (${r.priceCount} prices)`);
    console.log(`    missing: "${r.missingName}"`);
    console.log(`    active:  "${r.activeName}"`);
  }

  console.log(`\n=== No match ≥ 0.65 — genuinely missing, needs re-scraping (${noHit.length}) ===\n`);
  for (const r of noHit) {
    console.log(`  id=${r.missingId}  "${r.missingName}"`);
  }
}

main().catch(console.error);
