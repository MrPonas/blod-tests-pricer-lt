/**
 * Audits all zero-price canonicals, classifies them, and for B4 orphans
 * finds the active canonical that absorbed their prices via vector similarity.
 *
 * Outputs only counts + summaries — no mutations.
 *
 * Usage: npx tsx scripts/audit-zero-price-canonicals.ts
 */

import dotenv from 'dotenv';
import { writeFileSync } from 'fs';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN       = process.env.SUPABASE_ACCESS_TOKEN!;
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

// ── Classification patterns ───────────────────────────────────────────────────

function classify(id: number, name: string): 'A' | 'B1' | 'B2' | 'B3' | 'B4' {
  // A: |KL..| packages (ids 1-68, confirmed by pattern)
  if (/^\|KL\d+\|/.test(name)) return 'A';

  // B1: lab programs / bundles
  if (/ištyrimo programa|sveikatos programa|tyrimų programa|imuniteto žvaigždės|energijos balanso|nuovargio priežasčių|speciali vyro|speciali moters|mamos dienai|kaimynų pagrindinė/i.test(name)) return 'B1';

  // B2: genetic / specialty panels not in our scrape scope
  if (/GeneScreen|myPrenatal|Placenta Safe|GlycanAge|GenoTricho|GenoAthletic|myCancerRisk|myGeneticRisk|myPharma|AnteMEL|Diagnostic Panel|NIPTIFY|Pregnancy Loss|WID-easy|Bladder EpiCheck|myPrenatal/i.test(name)) return 'B2';

  // B3: procedural / non-blood tests
  if (/mikroskopinis tyrimas grybams|citopatolinis.*tepinėlis|nuograndų tyrimas spalin|burnos gleivinės.*nuograndų|antigenų nustatymas iš nosies|tepinėlis iš nosiaryklės|pasėlis iš nosiaryklės/i.test(name)) return 'B3';

  return 'B4';
}

interface ZeroPriceTest {
  id: number;
  canonical_name_lt: string;
  canonical_name_en: string | null;
  embedding: number[] | null;
}

interface ActiveDuplicate {
  orphanId: number;
  orphanName: string;
  activeId: number;
  activeName: string;
  similarity: number;
  priceCount: number;
}

async function main() {
  console.log('Fetching all zero-price canonicals...\n');

  // Fetch zero-price tests with embeddings
  const zeros = await sql<ZeroPriceTest>(`
    SELECT t.id, t.canonical_name_lt, t.canonical_name_en,
           t.embedding::text AS embedding
    FROM tests t
    WHERE NOT EXISTS (SELECT 1 FROM prices WHERE test_id = t.id)
    ORDER BY t.id
  `);

  // Parse embedding from text
  const tests: ZeroPriceTest[] = zeros.map((r: any) => ({
    ...r,
    embedding: r.embedding ? JSON.parse(r.embedding) : null,
  }));

  // Classify
  const byClass: Record<string, ZeroPriceTest[]> = { A: [], B1: [], B2: [], B3: [], B4: [] };
  for (const t of tests) {
    const cat = classify(t.id, t.canonical_name_lt);
    byClass[cat].push(t);
  }

  console.log(`=== Zero-price canonical breakdown ===`);
  console.log(`  Total : ${tests.length}`);
  console.log(`  A  (|KL| packages)       : ${byClass.A.length}`);
  console.log(`  B1 (lab programs/bundles): ${byClass.B1.length}`);
  console.log(`  B2 (genetic/specialty)   : ${byClass.B2.length}`);
  console.log(`  B3 (procedural/non-blood): ${byClass.B3.length}`);
  console.log(`  B4 (real blood tests)    : ${byClass.B4.length}\n`);

  // ── B4: Find active duplicates via vector search ──────────────────────────
  console.log(`Searching for active duplicates for ${byClass.B4.length} B4 orphans...\n`);

  // Get price counts for active canonicals (for result enrichment)
  const priceCountRows = await sql<{ test_id: number; cnt: number }>(
    `SELECT test_id, COUNT(*)::int AS cnt FROM prices WHERE is_stale = false GROUP BY test_id`
  );
  const priceCounts = new Map(priceCountRows.map(r => [r.test_id, r.cnt]));

  const withDuplicate: ActiveDuplicate[] = [];
  const noEmbedding: ZeroPriceTest[]    = [];
  const genuinelyMissing: ZeroPriceTest[] = [];

  for (const orphan of byClass.B4) {
    if (!orphan.embedding) {
      noEmbedding.push(orphan);
      continue;
    }

    const hits = await matchTests(orphan.embedding, 0.80, 5);
    // Filter: must have prices, must not be zero-price themselves
    const activeHits = hits.filter(h => h.id !== orphan.id && (priceCounts.get(h.id) ?? 0) > 0);

    if (activeHits.length > 0) {
      const best = activeHits[0];
      withDuplicate.push({
        orphanId:   orphan.id,
        orphanName: orphan.canonical_name_lt,
        activeId:   best.id,
        activeName: best.canonical_name_lt,
        similarity: best.similarity,
        priceCount: priceCounts.get(best.id) ?? 0,
      });
    } else {
      genuinelyMissing.push(orphan);
    }
  }

  // ── Results ───────────────────────────────────────────────────────────────
  console.log(`=== B4 analysis results ===`);
  console.log(`  Active duplicate found (→ merge): ${withDuplicate.length}`);
  console.log(`  No embedding (→ investigate)    : ${noEmbedding.length}`);
  console.log(`  Genuinely missing (→ re-scrape) : ${genuinelyMissing.length}\n`);

  // Split by similarity tier
  const highConf  = withDuplicate.filter(d => d.similarity >= 0.92);
  const lowConf   = withDuplicate.filter(d => d.similarity >= 0.80 && d.similarity < 0.92);
  console.log(`  Merge candidates:`);
  console.log(`    ≥ 0.92 (high confidence) : ${highConf.length}`);
  console.log(`    0.80–0.92 (review first) : ${lowConf.length}\n`);

  // Show high-conf candidates
  if (highConf.length > 0) {
    console.log(`=== High-confidence merge candidates (≥ 0.92) ===`);
    for (const d of highConf) {
      console.log(`  [${d.similarity.toFixed(4)}] orphan=${d.orphanId} → active=${d.activeId} (${d.priceCount} prices)`);
      console.log(`    orphan: "${d.orphanName}"`);
      console.log(`    active: "${d.activeName}"`);
    }
  }

  if (lowConf.length > 0) {
    console.log(`\n=== Low-confidence merge candidates (0.80–0.92) — needs review ===`);
    for (const d of lowConf) {
      console.log(`  [${d.similarity.toFixed(4)}] orphan=${d.orphanId} → active=${d.activeId} (${d.priceCount} prices)`);
      console.log(`    orphan: "${d.orphanName}"`);
      console.log(`    active: "${d.activeName}"`);
    }
  }

  if (genuinelyMissing.length > 0) {
    console.log(`\n=== Genuinely missing — no active duplicate found ===`);
    for (const t of genuinelyMissing) {
      console.log(`  id=${t.id}  "${t.canonical_name_lt}"`);
    }
    const missingTxt = genuinelyMissing.map(t => `${t.id}\t${t.canonical_name_lt}`).join('\n') + '\n';
    writeFileSync('scripts/genuinely-missing-tests.txt', missingTxt);
    console.log(`\nWritten to scripts/genuinely-missing-tests.txt`);
  }

  if (noEmbedding.length > 0) {
    console.log(`\n=== No embedding (cannot vector-search) ===`);
    for (const t of noEmbedding) {
      console.log(`  id=${t.id}  "${t.canonical_name_lt}"`);
    }
  }

  // ── Safe-to-delete summary ───────────────────────────────────────────────
  const deleteIds = [
    ...byClass.A.map(t => t.id),
    ...byClass.B1.map(t => t.id),
    ...byClass.B2.map(t => t.id),
    ...byClass.B3.map(t => t.id),
  ];

  // Verify none have mappings pointing at them
  if (deleteIds.length > 0) {
    const mappingCheck = await sql<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt FROM test_name_mappings WHERE canonical_test_id IN (${deleteIds.join(',')})`
    );
    const jobCheck = await sql<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt FROM mapping_review_queue WHERE ai_suggestion_id IN (${deleteIds.join(',')})`
    );
    console.log(`\n=== Safe-to-delete (A + B1 + B2 + B3): ${deleteIds.length} canonicals ===`);
    console.log(`  test_name_mappings pointing at them: ${mappingCheck[0].cnt} ${mappingCheck[0].cnt === 0 ? '✓' : '⚠ STOP — fix before deleting'}`);
    console.log(`  mapping_review_queue pointing at them: ${jobCheck[0].cnt} ${jobCheck[0].cnt === 0 ? '✓' : '⚠ STOP — fix before deleting'}`);
  }
}

main().catch(console.error);
