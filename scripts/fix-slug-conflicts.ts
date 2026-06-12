/**
 * Two things:
 * 1. Fixes canonical names broken by the code-cleanup script that stripped
 *    meaningful distinguishing info (IgA/IgG, RPR/TPHA, total vs HDL cholesterol).
 * 2. Merges canonical tests that have the same URL slug from different labs
 *    (URL slug is a 100%-reliable cross-lab identity signal).
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const DRY_RUN = !process.argv.includes('--apply');

function getSlug(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).pathname.replace(/^\//, '').replace(/\/$/, ''); }
  catch { return null; }
}

async function rename(id: number, newName: string) {
  const { data: t } = await db.from('tests').select('canonical_name_lt, aliases').eq('id', id).single();
  if (!t) return;
  console.log(`  RENAME [${id}] "${t.canonical_name_lt}" → "${newName}"`);
  if (!DRY_RUN) {
    const aliases = [...new Set([...t.aliases, t.canonical_name_lt])];
    await db.from('tests').update({ canonical_name_lt: newName, aliases }).eq('id', id);
  }
}

async function merge(winnerId: number, loserId: number) {
  const { data: winner } = await db.from('tests').select('*').eq('id', winnerId).single();
  const { data: loser } = await db.from('tests').select('*').eq('id', loserId).single();
  if (!winner || !loser) { console.log(`  [${winnerId} or ${loserId}] not found`); return; }

  console.log(`  MERGE [${loserId}] "${loser.canonical_name_lt}"`);
  console.log(`    → into [${winnerId}] "${winner.canonical_name_lt}"`);

  if (!DRY_RUN) {
    const { data: loserPrices } = await db.from('prices').select('*').eq('test_id', loserId);
    for (const p of loserPrices ?? []) {
      const { data: existing } = await db.from('prices').select('id')
        .eq('test_id', winnerId).eq('lab_id', p.lab_id).single();
      if (!existing) {
        await db.from('prices').update({ test_id: winnerId }).eq('id', p.id);
        console.log(`    moved price lab_id=${p.lab_id} €${p.price_eur}`);
      } else {
        await db.from('prices').delete().eq('id', p.id);
        console.log(`    dropped duplicate price lab_id=${p.lab_id}`);
      }
    }
    await db.from('pending_review').update({ resolved_test_id: winnerId }).eq('resolved_test_id', loserId);
    const aliases = [...new Set([...winner.aliases, ...loser.aliases, loser.canonical_name_lt])];
    await db.from('tests').update({ aliases }).eq('id', winnerId);
    await db.from('tests').delete().eq('id', loserId);
    console.log(`    deleted [${loserId}]`);
  }
}

async function main() {
  if (DRY_RUN) console.log('--- DRY RUN (pass --apply to execute) ---\n');

  // === Part 1: Fix names broken by the code cleanup ===
  console.log('=== Fixing broken canonical names ===\n');

  // [128]+[129]: Anti-tTG IgA vs IgG — both became identical after code strip. Restore subtype.
  await rename(128, 'Antikūnų prieš audinių transglutaminazę IgA (suaugusiems dėl celiakinės ligos ištyrimo)');
  await rename(129, 'Antikūnų prieš audinių transglutaminazę IgG (suaugusiems dėl celiakinės ligos ištyrimo)');

  // [575]+[1014]: RPR vs TPHA syphilis — both became "Sifilio nustatymas". Restore method.
  await rename(575, 'Sifilio antikūnai (RPR)');
  await rename(1014, 'Sifilio antikūnai (TPHA)');

  // [254]: "DTL Cholesterolis" stripped to "Cholesterolis" — conflicts with [211] total cholesterol.
  // [253] "Didelio tankio lipoproteinų cholesterolis" is the correct Rezus name for HDL.
  // Merge [254] (Anteja HDL) into [253] (Rezus HDL) by URL slug.
  // Actually check prices first — [254] is Anteja, [253] is Rezus
  // → merge [254] into [253] is handled below as a slug conflict

  // === Part 2: Merge URL slug conflicts ===
  console.log('\n=== Merging URL slug conflicts ===\n');

  const { data: prices } = await db.from('prices')
    .select('test_id, lab_id, lab_test_name, lab_test_url, price_eur')
    .eq('is_stale', false)
    .not('lab_test_url', 'is', null);

  const bySlug = new Map<string, Array<{lab_id: number, test_id: number, name: string}>>();
  for (const p of prices ?? []) {
    const slug = getSlug(p.lab_test_url);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug)!.push({ lab_id: p.lab_id, test_id: p.test_id, name: p.lab_test_name });
  }

  let mergeCount = 0;
  for (const [slug, entries] of bySlug) {
    const testIds = [...new Set(entries.map(e => e.test_id))];
    if (testIds.length <= 1) continue;

    // Determine winner: most prices, else lowest id
    const counts = await Promise.all(testIds.map(async id => {
      const { count } = await db.from('prices').select('*', { count: 'exact', head: true }).eq('test_id', id);
      return { id, count: count ?? 0 };
    }));
    counts.sort((a, b) => b.count - a.count || a.id - b.id);
    const winner = counts[0];
    const losers = counts.slice(1);

    console.log(`Slug /${slug}:`);
    for (const loser of losers) {
      await merge(winner.id, loser.id);
      mergeCount++;
    }
  }

  console.log(`\nSummary: ${mergeCount} URL slug merges${DRY_RUN ? ' (dry run)' : ''}`);
}
main();
