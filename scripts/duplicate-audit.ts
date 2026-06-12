import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN!;

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

type Pair = {
  id1: number; name1: string;
  id2: number; name2: string;
  similarity: number;
};

type PriceCount = { test_id: number; cnt: number };

async function merge(keep: number, del: number) {
  await sql(`UPDATE test_name_mappings SET canonical_test_id = ${keep} WHERE canonical_test_id = ${del}`);
  await sql(`UPDATE mapping_review_queue SET ai_suggestion_id = ${keep} WHERE ai_suggestion_id = ${del}`);
  await sql(`UPDATE pending_review SET resolved_test_id = ${keep} WHERE resolved_test_id = ${del}`);
  await sql(`
    DELETE FROM prices
    WHERE test_id = ${keep}
      AND lab_id IN (SELECT lab_id FROM prices WHERE test_id = ${del})
  `);
  await sql(`UPDATE prices SET test_id = ${keep} WHERE test_id = ${del}`);
  await sql(`UPDATE prices SET is_stale = false WHERE test_id = ${keep}`);
  await sql(`DELETE FROM tests WHERE id = ${del}`);
}

async function main() {
  // ── Step 1: Fetch all pairs above 0.92 ──────────────────────────────────────
  console.log('Fetching all pairs with similarity > 0.92...');
  console.log('(This may take 30–60 seconds on 2490 vectors)\n');

  const pairs = await sql<Pair>(`
    SELECT
      t1.id as id1, t1.canonical_name_lt as name1,
      t2.id as id2, t2.canonical_name_lt as name2,
      round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) as similarity
    FROM tests t1
    JOIN tests t2 ON t1.id < t2.id
    WHERE 1 - (t1.embedding <=> t2.embedding) > 0.92
    ORDER BY similarity DESC
  `);

  const tier1 = pairs.filter(p => p.similarity >= 0.98); // auto-merge
  const tier2 = pairs.filter(p => p.similarity >= 0.95 && p.similarity < 0.98);
  const tier3 = pairs.filter(p => p.similarity >= 0.92 && p.similarity < 0.95);

  // ── Step 2: Tier counts ──────────────────────────────────────────────────────
  console.log('=== Step 2: Pair counts by tier ===');
  console.log(`  0.98–1.00  (auto-merge):  ${tier1.length} pairs`);
  console.log(`  0.95–0.98  (review):      ${tier2.length} pairs`);
  console.log(`  0.92–0.95  (review):      ${tier3.length} pairs`);
  console.log(`  Total:                    ${pairs.length} pairs\n`);

  // ── Step 3: Auto-merge 0.98–1.0 tier ────────────────────────────────────────
  if (tier1.length === 0) {
    console.log('=== Step 3: No pairs in 0.98–1.0 tier — nothing to auto-merge ===\n');
  } else {
    console.log(`=== Step 3: Auto-merging ${tier1.length} pairs (0.98–1.0) ===`);

    // Get price counts for all involved IDs in one query
    const allIds = [...new Set(tier1.flatMap(p => [p.id1, p.id2]))];
    const priceCounts = await sql<PriceCount>(`
      SELECT test_id, COUNT(*)::int as cnt
      FROM prices
      WHERE test_id IN (${allIds.join(',')})
      GROUP BY test_id
    `);
    const priceMap = new Map(priceCounts.map(r => [r.test_id, r.cnt]));

    // Track which IDs have already been merged (absorbed) to handle chains
    const absorbed = new Set<number>();
    let ok = 0;
    let fail = 0;

    for (const pair of tier1) {
      // Skip if one side was already absorbed in a prior step of this run
      if (absorbed.has(pair.id1) || absorbed.has(pair.id2)) {
        console.log(`  [skip] id=${pair.id1} ↔ id=${pair.id2} — one already absorbed`);
        continue;
      }

      const cnt1 = priceMap.get(pair.id1) ?? 0;
      const cnt2 = priceMap.get(pair.id2) ?? 0;
      // Keep whichever has more prices; on tie keep lower id (bootstrap canonical)
      const keep = (cnt1 >= cnt2) ? pair.id1 : pair.id2;
      const del  = (keep === pair.id1) ? pair.id2 : pair.id1;

      try {
        await merge(keep, del);
        absorbed.add(del);
        console.log(`  ✓ [${pair.similarity}] keep=${keep}(${priceMap.get(keep) ?? 0}px) ← del=${del}(${priceMap.get(del) ?? 0}px)`);
        console.log(`      "${pair.name1}" / "${pair.name2}"`);
        ok++;
      } catch (err) {
        console.error(`  ✗ keep=${keep} ← del=${del}: ${err}`);
        fail++;
      }
    }
    console.log(`\nMerged: ${ok}  Failed: ${fail}\n`);
  }

  // ── Step 4: List 0.92–0.98 pairs for review ──────────────────────────────────
  const reviewPairs = [...tier2, ...tier3];
  if (reviewPairs.length === 0) {
    console.log('=== Step 4: No pairs in 0.92–0.98 range ===');
    return;
  }

  // Get price counts for review pairs too
  const reviewIds = [...new Set(reviewPairs.flatMap(p => [p.id1, p.id2]))];
  const reviewCounts = await sql<PriceCount>(`
    SELECT test_id, COUNT(*)::int as cnt
    FROM prices
    WHERE test_id IN (${reviewIds.join(',')})
    GROUP BY test_id
  `);
  const reviewMap = new Map(reviewCounts.map(r => [r.test_id, r.cnt]));

  console.log('=== Step 4: Pairs 0.95–0.98 (review before merging) ===');
  if (tier2.length === 0) {
    console.log('  (none)\n');
  } else {
    for (const p of tier2) {
      const px1 = reviewMap.get(p.id1) ?? 0;
      const px2 = reviewMap.get(p.id2) ?? 0;
      console.log(`  [${p.similarity}] id=${p.id1}(${px1}px) ↔ id=${p.id2}(${px2}px)`);
      console.log(`    "${p.name1}"`);
      console.log(`    "${p.name2}"`);
    }
  }

  console.log('\n=== Step 4: Pairs 0.92–0.95 (review before merging) ===');
  if (tier3.length === 0) {
    console.log('  (none)\n');
  } else {
    for (const p of tier3) {
      const px1 = reviewMap.get(p.id1) ?? 0;
      const px2 = reviewMap.get(p.id2) ?? 0;
      console.log(`  [${p.similarity}] id=${p.id1}(${px1}px) ↔ id=${p.id2}(${px2}px)`);
      console.log(`    "${p.name1}"`);
      console.log(`    "${p.name2}"`);
    }
  }
}

main().catch(console.error);
