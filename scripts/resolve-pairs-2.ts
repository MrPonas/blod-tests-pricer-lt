import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';
import { normalizeTestName } from '@/scrapers/lib/normalize';
import { embedText } from '@/scrapers/lib/embed';

const PAIRS: Array<{ ids: [number, number]; note: string }> = [
  { ids: [54,  106], note: 'Bakterinės vaginozės ir kandidozės PGR' },
  { ids: [64,  135], note: '7 LPL ir 7 Kandidozių šlapime paletė' },
  { ids: [65,  136], note: '7 LPL ir 7 Kandidozių paletė' },
  { ids: [68,  140], note: '14 LPL šlapime paletė' },
  { ids: [69,  141], note: '14 LPL paletė' },
  { ids: [70,  142], note: '21 LPL paletė šlapime' },
  { ids: [71,  143], note: '21 LPL paletė' },
];

type QueueRow = {
  id: number;
  lab_id: number;
  raw_name: string;
  price_eur: number;
};

async function main() {
  const allIds = PAIRS.flatMap(p => p.ids);

  const { data: rows, error } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id, lab_id, raw_name, price_eur')
    .in('id', allIds);

  if (error) { console.error('Fetch failed:', error.message); return; }

  const byId = new Map((rows as QueueRow[]).map(r => [r.id, r]));

  let ok = 0, fail = 0;

  for (const { ids, note } of PAIRS) {
    try {
      const [anchorId, otherId] = ids;
      const anchor = byId.get(anchorId);
      const other  = byId.get(otherId);

      if (!anchor) { console.error(`  ✗ id=${anchorId} not found`); fail++; continue; }
      if (!other)  { console.error(`  ✗ id=${otherId} not found`);  fail++; continue; }

      const canonicalName = anchor.raw_name.trim();
      const embedding = await embedText(canonicalName);

      const { data: newTest, error: insertErr } = await supabaseAdmin
        .from('tests')
        .insert({ canonical_name_lt: canonicalName, aliases: [anchor.raw_name, other.raw_name], embedding })
        .select('id')
        .single();

      if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);
      const canonicalId = newTest.id;

      for (const item of [anchor, other]) {
        const norm = normalizeTestName(item.raw_name);

        await supabaseAdmin.from('test_name_mappings').upsert({
          lab_id: item.lab_id,
          raw_name: item.raw_name,
          raw_name_normalized: norm,
          canonical_test_id: canonicalId,
          match_method: 'human_created',
          match_confidence: 1.0,
          verified_by_human: true,
        }, { onConflict: 'lab_id,raw_name_normalized' });

        await supabaseAdmin.from('prices').upsert({
          test_id: canonicalId,
          lab_id: item.lab_id,
          price_eur: item.price_eur,
          lab_test_name: item.raw_name,
          lab_test_url: null,
          scraped_at: new Date().toISOString(),
          is_stale: false,
        }, { onConflict: 'test_id,lab_id' });

        await supabaseAdmin.from('mapping_review_queue')
          .update({ status: 'new_test', reviewed_at: new Date().toISOString() })
          .eq('id', item.id);
      }

      console.log(`  ✓  [${anchorId}+${otherId}] canonical id=${canonicalId}  "${canonicalName.slice(0, 60)}"`);
      ok++;
    } catch (e) {
      console.error(`  ✗  ${ids}: ${e}`);
      fail++;
    }
  }

  console.log(`\n${ok} pairs created, ${fail} failed`);

  const { count } = await supabaseAdmin
    .from('mapping_review_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log(`Pending remaining: ${count}`);
}

main().catch(console.error);
