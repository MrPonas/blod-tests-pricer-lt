/**
 * Merges confirmed same-test pairs from the 0.70-0.85 similarity review.
 * Applies hard rules before each merge and checks for urine variants where needed.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { applyHardRules } from '../scrapers/lib/hard-rules';

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
  console.log(`  ✓ keep=${keep} ← absorbed=${del}  "${label}"`);
}

async function checkForUrineVariant(analyte: string): Promise<{ id: number; name: string; lab: string }[]> {
  return sql<{ id: number; name: string; lab: string }>(`
    SELECT t.id, t.canonical_name_lt AS name, l.name AS lab
    FROM tests t
    JOIN prices p ON p.test_id = t.id
    JOIN labs l ON l.id = p.lab_id
    WHERE p.is_stale = false
      AND (t.canonical_name_lt ILIKE '%${analyte}%šlapime%'
        OR t.canonical_name_lt ILIKE '%${analyte}%šlapimo%'
        OR t.canonical_name_lt ILIKE '%šlapime%${analyte}%'
        OR t.canonical_name_lt ILIKE '%šlapimo%${analyte}%')
  `);
}

async function main() {
  // ── Pair definitions: [keep, del, name1, name2, label] ───────────────────────
  const candidates: [number, number, string, string, string][] = [
    [2227, 2431, 'Alfa-fetaproteinas (AFP)',         'AFP (Alfa fetoproteinas)',               'Alfa-fetaproteinas (AFP)'],
    [1817, 2198, 'T4 Tiroksinas (bendrasis)',         'T4 Tiroksinas',                         'T4 Tiroksinas (bendrasis)'],
    [232,  233,  'C reaktyvus baltymas',              'C-reaktyvinis baltymas (plataus spektro)', 'C reaktyvus baltymas'],
    [1856, 2206, 'Geležis (Fe)',                      'Geležis (Fe) serume',                   'Geležis (Fe)'],
    [1821, 2190, 'Imunoglobulinas G (IgG)',           'Imunoglobulinas G (IgG) serume',        'Imunoglobulinas G (IgG)'],
  ];

  // ── Pre-flight: hard rules + urine checks ────────────────────────────────────
  console.log('=== Pre-flight hard rule checks ===\n');

  for (const [keep, del, n1, n2, label] of candidates) {
    const rule = applyHardRules(n1, n2);
    console.log(`  [${keep}↔${del}] "${n1}" / "${n2}"`);
    console.log(`    hard rule → ${rule}`);
    if (rule === 'create_new') {
      console.log(`    ⛔ BLOCKED by hard rules — skipping`);
    }
  }

  // ── Special checks: urine variants for Rule 3b pairs ────────────────────────
  console.log('\n=== Urine variant checks (Rule 3b pairs) ===\n');

  const feUrine = await checkForUrineVariant('geležis');
  console.log(`Geležis urine variants: ${feUrine.length === 0 ? 'none ✓' : JSON.stringify(feUrine)}`);

  const iggUrine = await checkForUrineVariant('imunoglobulinas g');
  console.log(`IgG urine variants: ${iggUrine.length === 0 ? 'none ✓' : JSON.stringify(iggUrine)}`);

  // ── CRP special note ─────────────────────────────────────────────────────────
  console.log(`\n⚠  CRP pair (232↔233): "plataus spektro" (wide-range) qualifier may indicate`);
  console.log(`   hsCRP vs standard CRP — clinically different tests. Manual decision needed.`);
  console.log(`   Skipping this pair.`);

  // ── Proceed with merges ──────────────────────────────────────────────────────
  const toMerge: [number, number, string, string, string][] = [];

  for (const pair of candidates) {
    const [keep, del, n1, n2] = pair;
    const rule = applyHardRules(n1, n2);
    if (rule === 'create_new') continue;
    if (keep === 232 || del === 233) continue; // CRP — skip

    // Rule 3b pairs: only merge if no urine variant exists
    if (keep === 1856 && feUrine.length > 0) {
      console.log(`  ⛔ Geležis urine variant exists — keeping separate`);
      continue;
    }
    if (keep === 1821 && iggUrine.length > 0) {
      console.log(`  ⛔ IgG urine variant exists — keeping separate`);
      continue;
    }
    toMerge.push(pair);
  }

  console.log(`\n=== Merging ${toMerge.length} confirmed pairs ===\n`);

  for (const [keep, del, , , label] of toMerge) {
    await merge(keep, del, label);
  }

  // ── Final checks ─────────────────────────────────────────────────────────────
  const [{ stale_count }] = await sql<{ stale_count: number }>(
    `SELECT COUNT(*)::int AS stale_count FROM prices WHERE is_stale = true`
  );
  console.log(`\nis_stale = true: ${stale_count} ${stale_count === 0 ? '✓' : '⚠'}`);

  const highSim = await sql<{ id1: number; id2: number; sim: number }>(
    `SELECT t1.id AS id1, t2.id AS id2,
            round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) AS sim
     FROM tests t1 JOIN tests t2 ON t2.id > t1.id
     WHERE (1 - (t1.embedding <=> t2.embedding)) >= 0.98`
  );
  if (highSim.length === 0) {
    console.log('Pairs ≥ 0.98: 0 ✓');
  } else {
    highSim.forEach(r => console.log(`  ⚠ [${r.sim}] id=${r.id1} ↔ id=${r.id2}`));
  }
}

main().catch(console.error);
