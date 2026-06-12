/**
 * audit-coverage-gaps.ts
 *
 * Finds canonicals that are cross-lab duplicates (same test mapped to different
 * canonical IDs at different labs). Run after adding a new vendor.
 *
 * Output:
 *  - Auto-merges pairs with similarity ≥ 0.98 that pass hard rules
 *  - Writes coverage-gaps.csv for pairs in the 0.85–0.98 range
 */

import dotenv from 'dotenv';
import { writeFileSync } from 'fs';
import { applyHardRules } from '../scrapers/lib/hard-rules';

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

async function merge(keep: number, del: number) {
  await sql(`UPDATE test_name_mappings SET canonical_test_id = ${keep} WHERE canonical_test_id = ${del}`);
  await sql(`UPDATE mapping_review_queue SET ai_suggestion_id = ${keep} WHERE ai_suggestion_id = ${del}`);
  await sql(`UPDATE pending_review SET resolved_test_id = ${keep} WHERE resolved_test_id = ${del}`);
  await sql(`DELETE FROM prices WHERE test_id = ${keep} AND lab_id IN (SELECT lab_id FROM prices WHERE test_id = ${del})`);
  await sql(`UPDATE prices SET test_id = ${keep} WHERE test_id = ${del}`);
  await sql(`UPDATE prices SET is_stale = false WHERE test_id = ${keep}`);
  await sql(`DELETE FROM tests WHERE id = ${del}`);
}

interface GapPair {
  id1: number;
  name1: string;
  labs1: string;
  price_count1: number;
  id2: number;
  name2: string;
  labs2: string;
  price_count2: number;
  similarity: number;
}

async function main() {
  console.log('Scanning for cross-lab coverage gaps (similarity ≥ 0.85)...\n');

  const pairs = await sql<GapPair>(`
    SELECT
      t1.id AS id1,
      t1.canonical_name_lt AS name1,
      (SELECT string_agg(DISTINCT l.name, ', ' ORDER BY l.name)
       FROM prices p JOIN labs l ON l.id = p.lab_id
       WHERE p.test_id = t1.id AND p.is_stale = false) AS labs1,
      (SELECT COUNT(*)::int FROM prices WHERE test_id = t1.id AND is_stale = false) AS price_count1,
      t2.id AS id2,
      t2.canonical_name_lt AS name2,
      (SELECT string_agg(DISTINCT l.name, ', ' ORDER BY l.name)
       FROM prices p JOIN labs l ON l.id = p.lab_id
       WHERE p.test_id = t2.id AND p.is_stale = false) AS labs2,
      (SELECT COUNT(*)::int FROM prices WHERE test_id = t2.id AND is_stale = false) AS price_count2,
      round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) AS similarity
    FROM tests t1
    JOIN tests t2 ON t1.id < t2.id
    WHERE t1.embedding IS NOT NULL
      AND t2.embedding IS NOT NULL
      AND 1 - (t1.embedding <=> t2.embedding) > 0.85
      AND EXISTS (
        SELECT 1 FROM prices p1
        JOIN prices p2 ON p1.lab_id != p2.lab_id
        WHERE p1.test_id = t1.id AND p2.test_id = t2.id
          AND p1.is_stale = false AND p2.is_stale = false
      )
    ORDER BY similarity DESC
  `);

  if (pairs.length === 0) {
    console.log('No cross-lab gap pairs found above 0.85. ✓');
    return;
  }

  console.log(`Found ${pairs.length} cross-lab pairs above 0.85 similarity.\n`);

  const t1 = pairs.filter(p => p.similarity >= 0.98).length;
  const t2 = pairs.filter(p => p.similarity >= 0.92 && p.similarity < 0.98).length;
  const t3 = pairs.filter(p => p.similarity >= 0.85 && p.similarity < 0.92).length;
  console.log(`  0.98–1.00: ${t1}  0.92–0.98: ${t2}  0.85–0.92: ${t3}\n`);

  // ── Auto-merge 0.98+ tier ─────────────────────────────────────────────────
  const autoMerge = pairs.filter(p => p.similarity >= 0.98);
  let merged = 0;
  let skipped = 0;
  const absorbed = new Set<number>();

  if (autoMerge.length > 0) {
    console.log(`=== Auto-merging ${autoMerge.length} pairs at ≥ 0.98 ===`);

    for (const p of autoMerge) {
      if (absorbed.has(p.id1) || absorbed.has(p.id2)) {
        console.log(`  [skip] ${p.id1} ↔ ${p.id2} — already absorbed`);
        skipped++;
        continue;
      }

      const rule = applyHardRules(p.name1, p.name2);
      if (rule === 'create_new') {
        console.log(`  [hard-rule: create_new] ${p.id1} ↔ ${p.id2}  "${p.name1}" / "${p.name2}"`);
        skipped++;
        continue;
      }

      // Keep the one with more prices; tie → lower id
      const keep = p.price_count1 >= p.price_count2 ? p.id1 : p.id2;
      const del  = keep === p.id1 ? p.id2 : p.id1;

      try {
        await merge(keep, del);
        absorbed.add(del);
        console.log(`  ✓ keep=${keep} ← del=${del}  [${p.similarity}]  "${p.name1}" / "${p.name2}"`);
        merged++;
      } catch (err) {
        console.error(`  ✗ keep=${keep} ← del=${del}: ${err}`);
        skipped++;
      }
    }

    console.log(`\nAuto-merged: ${merged}  Skipped: ${skipped}\n`);
  }

  // ── Write CSV for review tier (0.85–0.98) ────────────────────────────────
  const reviewPairs = pairs.filter(p => p.similarity < 0.98 && !absorbed.has(p.id1) && !absorbed.has(p.id2));

  if (reviewPairs.length > 0) {
    const csvLines = [
      'similarity,id1,name1,labs1,id2,name2,labs2',
      ...reviewPairs.map(p =>
        [p.similarity, p.id1, `"${p.name1.replace(/"/g, '""')}"`, `"${p.labs1 ?? ''}"`,
         p.id2, `"${p.name2.replace(/"/g, '""')}"`, `"${p.labs2 ?? ''}"`].join(',')
      ),
    ];
    const csvPath = 'coverage-gaps.csv';
    writeFileSync(csvPath, csvLines.join('\n') + '\n');
    console.log(`=== ${reviewPairs.length} pairs written to ${csvPath} ===`);
    console.log('Open in a spreadsheet and review — then run targeted merge scripts for confirmed pairs.\n');

    // Also show the top 20 in console
    for (const p of reviewPairs.slice(0, 20)) {
      console.log(`  [${p.similarity}] ${p.id1} (${p.labs1 ?? 'no price'}) ↔ ${p.id2} (${p.labs2 ?? 'no price'})`);
      console.log(`    "${p.name1}"`);
      console.log(`    "${p.name2}"`);
    }
    if (reviewPairs.length > 20) console.log(`  ... and ${reviewPairs.length - 20} more in CSV`);
  } else {
    console.log('No pairs in review range (0.85–0.98). ✓');
  }

  // ── Low-similarity second pass (0.70–0.85) ───────────────────────────────
  // Only surfaces pairs where the first significant word matches OR both names
  // share a known medical abbreviation — catches the Alfa-amilazė pattern.

  const KNOWN_ABBREVS = new Set([
    'amyl', 'bkt', 'bst', 'tsh', 'fsh', 'lh', 'psa', 'hba1c', 'crb', 'esr',
    'eng', 'inr', 'pt', 'aptt', 'ldl', 'hdl', 'ast', 'alt', 'ggt', 'alp',
    'ck', 'ldh', 'tpo', 'tg', 'ft3', 'ft4', 't3', 't4', 'igf', 'acr', 'ama',
    'ana', 'anca', 'aslo', 'crp', 'ecp', 'pct', 'prl', 'dhea', 'shbg',
  ]);

  function extractAbbrev(name: string): string | null {
    const m = name.match(/\b([A-Z][A-Z0-9\-]{1,6})\b/);
    return m ? m[1].toLowerCase() : null;
  }

  function firstSignificantWord(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-ząčęėįšųūž\s]/gi, '')
      .trim()
      .split(/\s+/)
      .find(w => w.length > 2) ?? '';
  }

  function namesAreRelated(n1: string, n2: string): boolean {
    // Same first meaningful word
    if (firstSignificantWord(n1) === firstSignificantWord(n2)) return true;
    // Both contain the same known abbreviation
    const a1 = extractAbbrev(n1);
    const a2 = extractAbbrev(n2);
    if (a1 && a2 && a1 === a2 && KNOWN_ABBREVS.has(a1)) return true;
    return false;
  }

  const lowSimPairs = await sql<GapPair>(`
    SELECT
      t1.id AS id1, t1.canonical_name_lt AS name1,
      (SELECT string_agg(DISTINCT l.name, ', ' ORDER BY l.name)
       FROM prices p JOIN labs l ON l.id = p.lab_id
       WHERE p.test_id = t1.id AND p.is_stale = false) AS labs1,
      (SELECT COUNT(*)::int FROM prices WHERE test_id = t1.id AND is_stale = false) AS price_count1,
      t2.id AS id2, t2.canonical_name_lt AS name2,
      (SELECT string_agg(DISTINCT l.name, ', ' ORDER BY l.name)
       FROM prices p JOIN labs l ON l.id = p.lab_id
       WHERE p.test_id = t2.id AND p.is_stale = false) AS labs2,
      (SELECT COUNT(*)::int FROM prices WHERE test_id = t2.id AND is_stale = false) AS price_count2,
      round((1 - (t1.embedding <=> t2.embedding))::numeric, 4) AS similarity
    FROM tests t1
    JOIN tests t2 ON t1.id < t2.id
    WHERE t1.embedding IS NOT NULL
      AND t2.embedding IS NOT NULL
      AND 1 - (t1.embedding <=> t2.embedding) BETWEEN 0.70 AND 0.85
      AND EXISTS (
        SELECT 1 FROM prices p1
        JOIN prices p2 ON p1.lab_id != p2.lab_id
        WHERE p1.test_id = t1.id AND p2.test_id = t2.id
          AND p1.is_stale = false AND p2.is_stale = false
      )
    ORDER BY similarity DESC
    LIMIT 200
  `);

  const relatedLow = lowSimPairs.filter(p => namesAreRelated(p.name1, p.name2));

  if (relatedLow.length > 0) {
    console.log(`\n=== Low-similarity pass (0.70–0.85, name-related): ${relatedLow.length} pairs ===`);
    for (const p of relatedLow) {
      console.log(`  [${p.similarity}] ${p.id1} (${p.labs1 ?? ''}) ↔ ${p.id2} (${p.labs2 ?? ''})`);
      console.log(`    "${p.name1}"`);
      console.log(`    "${p.name2}"`);
    }
  } else {
    console.log('\nLow-similarity pass (0.70–0.85, name-related): 0 pairs ✓');
  }

  // ── Final checks ──────────────────────────────────────────────────────────
  const [{ stale_count }] = await sql<{ stale_count: number }>(
    `SELECT COUNT(*)::int as stale_count FROM prices WHERE is_stale = true`
  );
  console.log(`\nis_stale = true: ${stale_count} ${stale_count === 0 ? '✓' : '⚠'}`);

  // CI exit code — non-zero if actionable pairs exist above 0.85
  const actionable = reviewPairs.filter(p => p.similarity >= 0.85).length + relatedLow.filter(p => p.similarity >= 0.85).length;
  if (actionable > 0) process.exit(1);
}

main().catch(console.error);
