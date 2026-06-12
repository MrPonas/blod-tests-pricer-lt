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

async function merge(keep: number, del: number, label: string) {
  await sql(`UPDATE test_name_mappings SET canonical_test_id = ${keep} WHERE canonical_test_id = ${del}`);
  await sql(`UPDATE mapping_review_queue SET ai_suggestion_id = ${keep} WHERE ai_suggestion_id = ${del}`);
  await sql(`UPDATE pending_review SET resolved_test_id = ${keep} WHERE resolved_test_id = ${del}`);
  await sql(`DELETE FROM prices WHERE test_id = ${keep} AND lab_id IN (SELECT lab_id FROM prices WHERE test_id = ${del})`);
  await sql(`UPDATE prices SET test_id = ${keep} WHERE test_id = ${del}`);
  await sql(`UPDATE prices SET is_stale = false WHERE test_id = ${keep}`);
  await sql(`DELETE FROM tests WHERE id = ${del}`);
  console.log(`  ✓ keep=${keep} ← del=${del}  ${label}`);
}

async function main() {
  // ── Group B: keep canonical WITHOUT "serume" qualifier ──────────────────────
  console.log('\n=== Group B — serume qualifier merges ===');

  // Pairs where keep/del are unambiguous (keep = no qualifier)
  const groupBExplicit: [number, number, string][] = [
    [1077, 2140, 'Yersinia IgG vs Yersinia IgG serume'],
    [1439, 1925, 'HBe antigenas vs HBe antigenas serume'],
    [1010, 2103, 'Toxoplasma Gondii IgG vs Toxoplasma gondii IgG (serumas)'],
    [1068, 2127, 'Vitaminas K (Filochinonas) vs (Filochinonas) serume'],
    [131,  1877, 'Anti-GAD vs Anti-GAD, serumas'],
    [2388, 2119, 'Varis (Cu) vs Varis (Cu) serume'],   // keep 2388 (no "serume")
    [559,  560,  'PSA vs PSA serume'],
  ];

  // CMV IgG — different naming, no "serume"; pick by price count
  // id=226 "Citomegalo viruso IgG antikūnai" vs id=1376 "Antikūnai IgG prieš Citomegalo virusą"
  const cmvIgGCounts = await sql<{ id: number; cnt: number }>(
    `SELECT test_id AS id, COUNT(*)::int AS cnt FROM prices WHERE is_stale = false AND test_id IN (226, 1376) GROUP BY test_id`
  );
  const cmvMap = new Map(cmvIgGCounts.map(r => [r.id, r.cnt]));
  const cmvKeep = (cmvMap.get(226) ?? 0) >= (cmvMap.get(1376) ?? 0) ? 226 : 1376;
  const cmvDel  = cmvKeep === 226 ? 1376 : 226;

  // Fosforas — both have qualifiers; pick by price count
  const fosCounts = await sql<{ id: number; cnt: number }>(
    `SELECT test_id AS id, COUNT(*)::int AS cnt FROM prices WHERE is_stale = false AND test_id IN (1764, 2118) GROUP BY test_id`
  );
  const fosMap = new Map(fosCounts.map(r => [r.id, r.cnt]));
  const fosKeep = (fosMap.get(1764) ?? 0) >= (fosMap.get(2118) ?? 0) ? 1764 : 2118;
  const fosDel  = fosKeep === 1764 ? 2118 : 1764;

  const absorbed = new Set<number>();

  for (const [keep, del, label] of groupBExplicit) {
    if (absorbed.has(keep) || absorbed.has(del)) { console.log(`  [skip] ${keep}↔${del} already absorbed`); continue; }
    await merge(keep, del, label);
    absorbed.add(del);
  }
  await merge(cmvKeep, cmvDel, `Citomegalo viruso IgG (${cmvMap.get(226) ?? 0} vs ${cmvMap.get(1376) ?? 0} prices)`);
  absorbed.add(cmvDel);
  await merge(fosKeep, fosDel, `Fosforas (${fosMap.get(1764) ?? 0} vs ${fosMap.get(2118) ?? 0} prices)`);
  absorbed.add(fosDel);

  // ── Group C: same test, different lab naming ────────────────────────────────
  console.log('\n=== Group C — cross-lab naming merges ===');

  // Anti-dsDNA: merge ids 1370 and 1869 into id=120 (user explicit)
  if (!absorbed.has(1370) && !absorbed.has(120)) {
    await merge(120, 1370, 'Anti-dsDNA: AntidsDNR → Antikūnų prieš dvispiralę DNR tyrimas');
    absorbed.add(1370);
  }
  if (!absorbed.has(1869) && !absorbed.has(120)) {
    await merge(120, 1869, 'Anti-dsDNA: anti-dsDNR → Antikūnų prieš dvispiralę DNR tyrimas');
    absorbed.add(1869);
  }

  // Gliukozė plazmoje: keep 307 (user explicit)
  if (!absorbed.has(307) && !absorbed.has(1953)) {
    await merge(307, 1953, 'Gliukozė plazmoje: long name → short name');
    absorbed.add(1953);
  }

  // Remaining Group C pairs — decide by price count
  const groupCPricePairs: [number, number, string][] = [
    [2016, 2100, 'CMV IgM antikūnai'],
    [1049, 1755, 'fBHCG Laisvas beta chorioninis gonadotropinas'],
    [1360, 2084, 'Anti-AGA-IgG prieš gliadiną'],
    [331,  1958, 'Hepatito A viruso IgM antikūnai'],
    [575,  2150, 'Sifilio RPR antikūnai'],
  ];

  const pairIds = groupCPricePairs.flatMap(([a, b]) => [a, b]);
  const priceCounts = await sql<{ id: number; cnt: number }>(
    `SELECT test_id AS id, COUNT(*)::int AS cnt FROM prices WHERE is_stale = false AND test_id IN (${pairIds.join(',')}) GROUP BY test_id`
  );
  const priceMap = new Map(priceCounts.map(r => [r.id, r.cnt]));

  for (const [a, b, label] of groupCPricePairs) {
    if (absorbed.has(a) || absorbed.has(b)) { console.log(`  [skip] ${a}↔${b} already absorbed`); continue; }
    const ca = priceMap.get(a) ?? 0;
    const cb = priceMap.get(b) ?? 0;
    const keep = ca >= cb ? a : b;
    const del  = keep === a ? b : a;
    await merge(keep, del, `${label} (${ca} vs ${cb} prices)`);
    absorbed.add(del);
  }

  // ── Verify ──────────────────────────────────────────────────────────────────
  console.log('\n=== Verification ===');
  const [{ stale }] = await sql<{ stale: number }>(
    `SELECT COUNT(*)::int as stale FROM prices WHERE is_stale = true`
  );
  console.log(`is_stale = true: ${stale} ${stale === 0 ? '✓' : '⚠'}`);

  const highSim = await sql<{ id1: number; name1: string; id2: number; name2: string; sim: number }>(
    `SELECT t1.id AS id1, t1.canonical_name_lt AS name1, t2.id AS id2, t2.canonical_name_lt AS name2,
            round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) AS sim
     FROM tests t1 JOIN tests t2 ON t1.id < t2.id
     WHERE t1.embedding IS NOT NULL AND t2.embedding IS NOT NULL
       AND 1 - (t1.embedding <=> t2.embedding) > 0.98
     ORDER BY sim DESC LIMIT 20`
  );
  if (highSim.length === 0) {
    console.log('Pairs above 0.98 similarity: 0 ✓');
  } else {
    console.log(`⚠ ${highSim.length} pairs still above 0.98:`);
    for (const r of highSim) console.log(`  [${r.sim}] id=${r.id1} "${r.name1}" ↔ id=${r.id2} "${r.name2}"`);
  }
}

main().catch(console.error);
