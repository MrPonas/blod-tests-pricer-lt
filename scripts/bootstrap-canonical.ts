import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';
import { embedBatch, embedText } from '@/scrapers/lib/embed';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface RawScrapedTest {
  id: number;
  lab_id: number;
  lab_name: string;
  name: string;
  price_eur: number;
  embedding?: number[];
}

function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (magA * magB);
}

function clusterBySimilarity(
  tests: RawScrapedTest[],
  threshold: number
): RawScrapedTest[][] {
  const used = new Set<number>();
  const clusters: RawScrapedTest[][] = [];

  for (let i = 0; i < tests.length; i++) {
    if (used.has(i)) continue;
    const cluster: RawScrapedTest[] = [tests[i]];
    used.add(i);

    for (let j = i + 1; j < tests.length; j++) {
      if (used.has(j)) continue;
      if (!tests[i].embedding || !tests[j].embedding) continue;

      const sim = cosineSim(tests[i].embedding!, tests[j].embedding!);
      if (sim >= threshold) {
        cluster.push(tests[j]);
        used.add(j);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

async function main() {
  console.log('Bootstrap: collecting all raw scraped test names...');

  const { data: allRaw } = await supabaseAdmin
    .from('raw_scraped_tests')
    .select('id, lab_id, labs(name), name, price_eur');

  const tests: RawScrapedTest[] = ((allRaw ?? []) as unknown[]).map((r: unknown) => {
    const row = r as { id: number; lab_id: number; labs: { name: string } | null; name: string; price_eur: number };
    return {
      id: row.id,
      lab_id: row.lab_id,
      lab_name: row.labs?.name ?? 'Unknown',
      name: row.name,
      price_eur: row.price_eur,
    };
  });

  console.log(`Found ${tests.length} raw test names. Embedding...`);

  const CHUNK = 100;
  for (let i = 0; i < tests.length; i += CHUNK) {
    const chunk = tests.slice(i, i + CHUNK);
    const embeddings = await embedBatch(chunk.map(t => t.name));
    chunk.forEach((t, j) => { t.embedding = embeddings[j]; });
    console.log(`  Embedded ${Math.min(i + CHUNK, tests.length)}/${tests.length}`);
  }

  console.log('Clustering...');
  const clusters = clusterBySimilarity(tests, 0.88);
  console.log(`Found ${clusters.length} candidate canonical tests`);

  let created = 0;
  let queued = 0;

  for (const cluster of clusters) {
    if (cluster.length === 1) {
      await supabaseAdmin.from('mapping_review_queue').insert({
        lab_id: cluster[0].lab_id,
        raw_name: cluster[0].name,
        price_eur: cluster[0].price_eur,
        ai_reasoning: 'Single occurrence — no cross-lab confirmation',
        status: 'pending',
      });
      queued++;
      continue;
    }

    const memberList = cluster
      .map(m => `  - "${m.name}" (${m.lab_name})`)
      .join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `
You are a Lithuanian medical laboratory expert.
These test names from different labs were clustered as likely the same test:

${memberList}

1. Are all of these truly the same test (same analyte + same sample type)?
   If some should be split, list their indices (0-based).
2. Standard Lithuanian canonical name
3. Standard English canonical name
4. Category: hormones | vitamins | biochemistry | haematology | infections | allergy | tumour_markers | urinalysis | other
5. Aliases list (all variants above)

Return ONLY valid JSON:
{
  "is_single_test": true,
  "split_indices": [],
  "canonical_name_lt": "Vitaminas D (25-OH)",
  "canonical_name_en": "Vitamin D (25-hydroxyvitamin D)",
  "category": "vitamins",
  "aliases": ["Vit. D 25-OH", "25-hidroksi vitaminas D"]
}
        `.trim(),
      }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const canonical = JSON.parse(raw.replace(/```json|```/g, '').trim()) as {
        is_single_test: boolean;
        split_indices: number[];
        canonical_name_lt: string;
        canonical_name_en?: string;
        category: string;
        aliases?: string[];
      };

      if (!canonical.is_single_test) {
        for (const member of cluster) {
          await supabaseAdmin.from('mapping_review_queue').insert({
            lab_id: member.lab_id,
            raw_name: member.name,
            price_eur: member.price_eur,
            ai_reasoning: `Cluster needs splitting: ${JSON.stringify(canonical.split_indices)}`,
            status: 'pending',
          });
        }
        queued += cluster.length;
        continue;
      }

      const embedding = await embedText(canonical.canonical_name_lt);
      const { data: newTest } = await supabaseAdmin.from('tests').insert({
        canonical_name_lt: canonical.canonical_name_lt,
        canonical_name_en: canonical.canonical_name_en ?? null,
        aliases: canonical.aliases ?? [],
        embedding,
      }).select().single();

      const { normalizeTestName } = await import('@/scrapers/lib/normalize');
      for (const member of cluster) {
        await supabaseAdmin.from('test_name_mappings').upsert({
          lab_id: member.lab_id,
          raw_name: member.name,
          raw_name_normalized: normalizeTestName(member.name),
          canonical_test_id: newTest!.id,
          match_method: 'bootstrap_cluster',
          match_confidence: 0.95,
          verified_by_human: false,
        }, { onConflict: 'lab_id,raw_name_normalized' });
      }

      created++;
      if (created % 20 === 0) console.log(`  Created ${created} canonical tests...`);

    } catch (err) {
      console.error(`Failed to process cluster:`, cluster[0].name, err);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`Bootstrap complete: ${created} canonical tests created, ${queued} queued for review`);
}

main().catch(console.error);
