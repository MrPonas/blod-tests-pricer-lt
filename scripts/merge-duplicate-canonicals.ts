import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN!;

async function sql(query: string): Promise<unknown[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data as unknown[];
}

// keep_id survives, delete_id is absorbed and removed
const MERGES: Array<{ keep: number; delete: number; note: string }> = [
  // 10 identical-name pairs (0.98–1.0)
  { keep: 2121, delete: 2469, note: 'Vitaminas B1 (Tiaminas)' },
  { keep: 2122, delete: 2468, note: 'Vitaminas B2 (Riboflavinas)' },
  { keep: 2436, delete: 2443, note: 'Candida IgG antikūnai' },
  { keep: 2450, delete: 2457, note: 'Antikūnų prieš audinių transglutaminazę' },
  { keep: 2451, delete: 2460, note: 'Kačių įdrėskimo liga (Bartonella) IgM' },
  { keep: 2452, delete: 2459, note: 'Tymų Viruso IgG antikūnai' },
  { keep: 2453, delete: 2463, note: 'Laimo ligos (borrelia burgdorferi) IgG' },
  { keep: 2454, delete: 2461, note: 'Laimo boreliozės IgG imunoblotingo nustatymas' },
  { keep: 2455, delete: 2462, note: 'Erkinio Encefalito IgG antikūnai' },
  { keep: 2456, delete: 2458, note: 'IgG kiekybinis antikūnų nustatymas' },
  // Yersinia IgG — same test, different phrasing
  { keep: 2140, delete: 2442, note: 'Yersinia spp. IgG antikūnai' },
  // LPI 4 sukėlėjų — same test, different formatting
  { keep: 1825, delete: 2477, note: 'LPI 4 sukėlėjų DNR nustatymas' },
];

async function merge(keep: number, del: number, note: string) {
  // 1. Redirect test_name_mappings
  await sql(`UPDATE test_name_mappings SET canonical_test_id = ${keep} WHERE canonical_test_id = ${del}`);

  // 2. Redirect mapping_review_queue suggestions
  await sql(`UPDATE mapping_review_queue SET ai_suggestion_id = ${keep} WHERE ai_suggestion_id = ${del}`);

  // 3. For prices: where keep already has that lab, drop the duplicate from the
  //    KEEP side first, then redirect the losing side's rows.
  //    NOTE: We drop the KEEP side's conflicting rows, not the DEL side's —
  //    this avoids accidentally keeping stale bootstrap rows over fresh ones.
  //    However, if both sides are stale the next step resets all to fresh.
  await sql(`
    DELETE FROM prices
    WHERE test_id = ${keep}
      AND lab_id IN (SELECT lab_id FROM prices WHERE test_id = ${del})
  `);
  await sql(`UPDATE prices SET test_id = ${keep} WHERE test_id = ${del}`);

  // 4. Bootstrap rows may be stale — always reset to false on merge.
  //    We just promoted rows from the losing canonical; their is_stale status
  //    reflects the original scrape, not the current mapping state.
  await sql(`UPDATE prices SET is_stale = false WHERE test_id = ${keep}`);

  // 5. Delete the duplicate canonical
  await sql(`DELETE FROM tests WHERE id = ${del}`);
}

async function main() {
  console.log(`Merging ${MERGES.length} duplicate pairs...\n`);

  let ok = 0;
  let fail = 0;

  for (const { keep, delete: del, note } of MERGES) {
    try {
      await merge(keep, del, note);
      console.log(`  ✓  keep=${keep} ← absorbed=${del}  "${note}"`);
      ok++;
    } catch (err) {
      console.error(`  ✗  keep=${keep} ← absorbed=${del}  "${note}": ${err}`);
      fail++;
    }
  }

  console.log(`\n${ok} merged, ${fail} failed\n`);

  // ── Verify: re-run similarity query ────────────────────────────────────────
  console.log('Verifying — re-running similarity query (threshold 0.98)...');
  const remaining = await sql(`
    SELECT t1.id as id1, t1.canonical_name_lt as name1,
           t2.id as id2, t2.canonical_name_lt as name2,
           round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) as similarity
    FROM tests t1 JOIN tests t2 ON t1.id < t2.id
    WHERE 1 - (t1.embedding <=> t2.embedding) > 0.98
    ORDER BY similarity DESC
  `) as Array<{ id1: number; name1: string; id2: number; name2: string; similarity: number }>;

  if (remaining.length === 0) {
    console.log('  ✓ No pairs above 0.98 similarity remain');
  } else {
    console.log(`  ⚠ ${remaining.length} pairs still above 0.98:`);
    for (const r of remaining) {
      console.log(`    [${r.similarity}] id=${r.id1} "${r.name1}" ↔ id=${r.id2} "${r.name2}"`);
    }
  }

  // ── Spot-check: Vitaminas B2 prices ───────────────────────────────────────
  console.log('\nSpot-check: Vitaminas B2 (id=2122) prices...');
  const prices = await sql(`
    SELECT p.price_eur, p.lab_test_name, l.name as lab
    FROM prices p JOIN labs l ON p.lab_id = l.id
    WHERE p.test_id = 2122
    ORDER BY l.name
  `) as Array<{ price_eur: string; lab_test_name: string; lab: string }>;

  if (prices.length === 0) {
    console.log('  (no prices found)');
  } else {
    for (const p of prices) {
      console.log(`  ${p.lab}: €${p.price_eur}  ("${p.lab_test_name}")`);
    }
  }
}

main().catch(console.error);
