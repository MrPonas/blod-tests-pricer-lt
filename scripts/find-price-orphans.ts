/**
 * Finds canonical tests with zero prices that have a name-similar sibling
 * with prices. The "(serumas)", "(šlapimas)", "(Au serume)" pattern.
 *
 * Strategy: for every zero-price test, strip parenthetical suffixes from
 * both sides and compare normalised base names. Flag pairs where the
 * normalised names match closely.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/** Strip parenthetical/bracketed suffixes and normalise */
function baseName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)/g, '')   // remove (...)
    .replace(/\s*\[[^\]]*\]/g, '')   // remove [...]
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function main() {
  const { data: allTests } = await db
    .from('tests')
    .select('id, canonical_name_lt, category_id');

  if (!allTests) { console.log('No tests'); return; }

  // Get all test_ids with fresh prices — paginate in 1000-row steps (Supabase hard cap)
  const allPriceRows: { test_id: number }[] = [];
  for (let start = 0; ; start += 1000) {
    const { data } = await db.from('prices').select('test_id').eq('is_stale', false).gt('price_eur', 0).range(start, start + 999);
    if (!data?.length) break;
    allPriceRows.push(...data);
    if (data.length < 1000) break;
  }
  const priceCounts = allPriceRows;

  const testsWithPrices = new Set((priceCounts ?? []).map(p => p.test_id));

  const zeroPriceTests = allTests.filter(t => !testsWithPrices.has(t.id));
  const withPriceTests = allTests.filter(t => testsWithPrices.has(t.id));

  console.log(`Tests with prices: ${testsWithPrices.size}`);
  console.log(`Tests with zero prices: ${zeroPriceTests.length}`);
  console.log('');

  // Build base-name index for priced tests
  const priceIndex = new Map<string, typeof withPriceTests>();
  for (const t of withPriceTests) {
    const base = baseName(t.canonical_name_lt);
    if (!priceIndex.has(base)) priceIndex.set(base, []);
    priceIndex.get(base)!.push(t);
  }

  // Check each zero-price test
  const pairs: Array<{ zero: typeof allTests[0]; match: typeof allTests[0]; reason: string }> = [];

  for (const zero of zeroPriceTests) {
    const zeroBase = baseName(zero.canonical_name_lt);

    // Exact base match
    const exact = priceIndex.get(zeroBase);
    if (exact?.length) {
      for (const m of exact) {
        pairs.push({ zero, match: m, reason: 'exact base match' });
      }
      continue;
    }

    // Prefix match: zero's base is prefix of a priced test's base (or vice versa)
    for (const [priceBase, tests] of priceIndex) {
      if (priceBase.startsWith(zeroBase) || zeroBase.startsWith(priceBase)) {
        // Only if the shorter string is ≥5 chars and bases differ only by suffix
        const shorter = zeroBase.length < priceBase.length ? zeroBase : priceBase;
        const longer  = zeroBase.length < priceBase.length ? priceBase : zeroBase;
        if (shorter.length >= 5 && longer.startsWith(shorter)) {
          for (const m of tests) {
            pairs.push({ zero, match: m, reason: `prefix: "${shorter}" in "${longer}"` });
          }
        }
      }
    }
  }

  // Deduplicate by zero-test id
  const seen = new Set<number>();
  const unique = pairs.filter(p => {
    if (seen.has(p.zero.id)) return false;
    seen.add(p.zero.id);
    return true;
  });

  console.log(`=== ${unique.length} zero-price tests with a priced near-match ===\n`);
  for (const { zero, match, reason } of unique) {
    console.log(`  [${reason}]`);
    console.log(`    ZERO  id=${zero.id}  "${zero.canonical_name_lt}"`);
    console.log(`    HAS$  id=${match.id}  "${match.canonical_name_lt}"`);
  }

  // Also: tests where ALL prices are stale (effectively no live price)
  const { data: stalePrices } = await db
    .from('tests')
    .select('id, canonical_name_lt')
    .not('id', 'in', `(${[...testsWithPrices].join(',')})`)
    .limit(5);
  // (above is just a sanity check — the main output is pairs above)
}
main().catch(e => { console.error(e); process.exit(1); });
