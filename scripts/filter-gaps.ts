import { readFileSync } from 'fs';
import { applyHardRules } from '../scrapers/lib/hard-rules';

const csv = readFileSync('coverage-gaps.csv', 'utf8').trim().split('\n').slice(1);

interface Row { similarity: number; id1: number; name1: string; labs1: string; id2: number; name2: string; labs2: string; }

function parseRow(line: string): Row {
  const m = line.match(/^([\d.]+),(\d+),"([^"]*)",(?:"([^"]*)")?,(\d+),"([^"]*)",(?:"([^"]*)")?/);
  if (!m) throw new Error(`Parse fail: ${line}`);
  return { similarity: parseFloat(m[1]), id1: parseInt(m[2]), name1: m[3], labs1: m[4] ?? '', id2: parseInt(m[5]), name2: m[6], labs2: m[7] ?? '' };
}

const pairs = csv.map(parseRow);

const blocked: { p: Row }[] = [];
const autoMerge: Row[] = [];
const humanReview: Row[] = [];

for (const p of pairs) {
  const result = applyHardRules(p.name1, p.name2);
  if (result === 'create_new') {
    blocked.push({ p });
  } else if (result === 'safe_to_merge') {
    autoMerge.push(p);
  } else {
    humanReview.push(p);
  }
}

console.log(`\n=== HARD RULES BREAKDOWN (${pairs.length} total pairs) ===\n`);
console.log(`Blocked (create_new): ${blocked.length}`);
console.log(`Auto-merge (safe_to_merge): ${autoMerge.length}`);
console.log(`Human review (needs_ai): ${humanReview.length}`);

console.log(`\n--- Blocked pairs ---`);
for (const { p } of blocked) {
  console.log(`  [${p.similarity}] "${p.name1}" vs "${p.name2}"`);
}

if (autoMerge.length > 0) {
  console.log(`\n--- Auto-merge pairs ---`);
  for (const p of autoMerge) {
    console.log(`  [${p.similarity}] id=${p.id1} "${p.name1}" ← id=${p.id2} "${p.name2}"`);
  }
}

console.log(`\n--- Human review pairs (${humanReview.length}) sorted by similarity ---`);
humanReview.sort((a, b) => b.similarity - a.similarity);
for (const p of humanReview) {
  console.log(`  [${p.similarity}] id=${p.id1} "${p.name1}" (${p.labs1}) ↔ id=${p.id2} "${p.name2}" (${p.labs2})`);
}
