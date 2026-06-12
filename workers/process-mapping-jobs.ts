import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';
import { embedText, embedBatch } from '@/scrapers/lib/embed';
import { normalizeTestName } from '@/scrapers/lib/normalize';
import { runMappingAgent, JobContext, MappingDecision, AgentResult } from '@/scrapers/lib/mapping-agent';
import { applyHardRules } from '@/scrapers/lib/hard-rules';

const DRY_RUN = process.env.DRY_RUN === 'true';
const MAX_JOBS = process.env.MAX_JOBS ? parseInt(process.env.MAX_JOBS, 10) : undefined;
const EMBED_CHUNK = 100;
const VECTOR_AUTO_THRESHOLD = 0.94;

// ── Cost estimation ───────────────────────────────────────────────────────────

const COST_PER_TOKEN = {
  haiku:  { in: 0.80 / 1e6, out: 4.00 / 1e6 },
  sonnet: { in: 3.00 / 1e6, out: 15.00 / 1e6 },
};

function estimateCost(result: AgentResult): number {
  const finalModel = result.path;
  // Approximate: rephrase call (if any) is always haiku; final call is haiku or sonnet.
  // Split tokens evenly across round trips for a rough estimate.
  const tokensPerCall = result.roundTrips > 0 ? {
    in: result.inputTokens / result.roundTrips,
    out: result.outputTokens / result.roundTrips,
  } : { in: 0, out: 0 };

  let cost = 0;
  for (let i = 0; i < result.roundTrips; i++) {
    const model = (i === result.roundTrips - 1) ? finalModel : 'haiku';
    cost += tokensPerCall.in * COST_PER_TOKEN[model].in + tokensPerCall.out * COST_PER_TOKEN[model].out;
  }
  return cost;
}

function formatDecision(d: MappingDecision): string {
  if (d.action === 'map') return `map_to_existing(id=${d.canonicalId}, conf=${d.confidence.toFixed(2)})`;
  if (d.action === 'create') return `create_new("${d.nameLt}")`;
  return `flagged("${d.reason.slice(0, 60)}")`;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

type RawJob = {
  id: number;
  raw_name: string;
  price_eur: number;
  lab_test_url: string | null;
  labs: { id: number; name: string; slug: string };
};

type Candidate = { id: number; canonical_name_lt: string; similarity: number };

async function commitMapping(
  job: RawJob,
  canonicalId: number,
  method: string,
  confidence: number,
  reasoning: string,
) {
  const norm = normalizeTestName(job.raw_name);
  await supabaseAdmin.from('test_name_mappings').upsert({
    lab_id: job.labs.id,
    raw_name: job.raw_name,
    raw_name_normalized: norm,
    canonical_test_id: canonicalId,
    match_method: method,
    match_confidence: confidence,
    ai_reasoning: reasoning,
    verified_by_human: false,
  }, { onConflict: 'lab_id,raw_name_normalized' });

  await supabaseAdmin.from('prices').upsert({
    test_id: canonicalId,
    lab_id: job.labs.id,
    price_eur: job.price_eur,
    lab_test_name: job.raw_name,
    lab_test_url: job.lab_test_url ?? null,
    scraped_at: new Date().toISOString(),
    is_stale: false,
  }, { onConflict: 'test_id,lab_id' });

  await supabaseAdmin.from('mapping_jobs')
    .update({ status: 'done', finished_at: new Date().toISOString() })
    .eq('id', job.id);
}

async function createNewCanonical(job: RawJob, decision: Extract<MappingDecision, { action: 'create' }>) {
  const embedding = await embedText(decision.nameLt);
  const { data: newTest, error } = await supabaseAdmin
    .from('tests')
    .insert({
      canonical_name_lt: decision.nameLt,
      canonical_name_en: decision.nameEn ?? null,
      aliases: [job.raw_name],
      embedding,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create canonical test: ${error.message}`);

  const norm = normalizeTestName(job.raw_name);
  await supabaseAdmin.from('test_name_mappings').upsert({
    lab_id: job.labs.id,
    raw_name: job.raw_name,
    raw_name_normalized: norm,
    canonical_test_id: newTest.id,
    match_method: 'ai_created',
    match_confidence: decision.confidence,
    ai_reasoning: `AI created new canonical: ${decision.nameLt}`,
    verified_by_human: false,
  }, { onConflict: 'lab_id,raw_name_normalized' });

  await supabaseAdmin.from('prices').upsert({
    test_id: newTest.id,
    lab_id: job.labs.id,
    price_eur: job.price_eur,
    lab_test_name: job.raw_name,
    lab_test_url: job.lab_test_url ?? null,
    scraped_at: new Date().toISOString(),
    is_stale: false,
  }, { onConflict: 'test_id,lab_id' });

  await supabaseAdmin.from('mapping_jobs')
    .update({ status: 'done', finished_at: new Date().toISOString() })
    .eq('id', job.id);
}

async function flagForHuman(job: RawJob, candidateIds: number[], reason: string) {
  await supabaseAdmin.from('mapping_review_queue').insert({
    lab_id: job.labs.id,
    raw_name: job.raw_name,
    price_eur: job.price_eur,
    ai_suggestion_id: candidateIds[0] ?? null,
    ai_confidence: 0,
    ai_reasoning: reason,
    status: 'pending',
  });
  await supabaseAdmin.from('mapping_jobs')
    .update({ status: 'done', finished_at: new Date().toISOString() })
    .eq('id', job.id);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('*** DRY RUN MODE — no DB writes, no paid API calls ***\n');
  console.log('Mapping worker started');

  // 1. Fetch all pending jobs
  let query = supabaseAdmin
    .from('mapping_jobs')
    .select('id, raw_name, price_eur, lab_test_url, labs(id, name, slug)')
    .eq('status', 'pending');

  if (MAX_JOBS) query = query.limit(MAX_JOBS);

  const { data: rawJobs, error } = await query;
  if (error) { console.error('Failed to fetch jobs:', error.message); return; }
  if (!rawJobs?.length) { console.log('No pending jobs.'); return; }

  const jobs = rawJobs as unknown as RawJob[];
  console.log(`Found ${jobs.length} pending jobs`);

  // 2. Cross-lab cache check
  const normalizedNames = jobs.map(j => normalizeTestName(j.raw_name));
  const uniqueNorms = [...new Set(normalizedNames)];

  const { data: cachedMappings } = await supabaseAdmin
    .from('test_name_mappings')
    .select('raw_name_normalized, canonical_test_id, match_confidence, ai_reasoning')
    .in('raw_name_normalized', uniqueNorms)
    .not('canonical_test_id', 'is', null);

  const cacheMap = new Map(
    (cachedMappings ?? []).map(m => [
      m.raw_name_normalized,
      m as { raw_name_normalized: string; canonical_test_id: number; match_confidence: number; ai_reasoning: string },
    ])
  );

  const cacheHits: RawJob[] = [];
  const cacheMisses: RawJob[] = [];
  jobs.forEach((job, i) => {
    if (cacheMap.has(normalizedNames[i])) cacheHits.push(job);
    else cacheMisses.push(job);
  });

  console.log(`Cross-lab cache: ${cacheHits.length} hits, ${cacheMisses.length} misses`);

  // 3. Resolve cache hits
  for (const job of cacheHits) {
    const mapping = cacheMap.get(normalizeTestName(job.raw_name))!;
    if (DRY_RUN) {
      console.log(`  [DRY cache] "${job.raw_name}" → canonical_id=${mapping.canonical_test_id}`);
    } else {
      await commitMapping(job, mapping.canonical_test_id, 'cross_lab_cache', mapping.match_confidence,
        `Cross-lab cache: ${mapping.ai_reasoning ?? ''}`);
      console.log(`  [cache ✓] ${job.raw_name}`);
    }
  }

  if (cacheMisses.length === 0) { console.log('All resolved via cache!'); return; }

  // 4. DRY_RUN: estimate and exit
  if (DRY_RUN) {
    console.log(`\n[DRY] Would embed ${cacheMisses.length} names in ${Math.ceil(cacheMisses.length / EMBED_CHUNK)} Voyage batches`);
    console.log(`[DRY] Vector search → auto-resolve ≥${(VECTOR_AUTO_THRESHOLD * 100).toFixed(0)}% hits, rest → tiered AI (Haiku rephrase + Haiku/Sonnet decision)`);
    return;
  }

  // 5. Batch embed all cache misses
  console.log(`\nEmbedding ${cacheMisses.length} names...`);
  const embeddings: number[][] = [];
  for (let i = 0; i < cacheMisses.length; i += EMBED_CHUNK) {
    const chunk = cacheMisses.slice(i, i + EMBED_CHUNK).map(j => j.raw_name);
    const vecs = await embedBatch(chunk);
    embeddings.push(...vecs);
    process.stdout.write(`  embedded ${Math.min(i + EMBED_CHUNK, cacheMisses.length)}/${cacheMisses.length}\r`);
  }
  console.log('');

  // 6. Vector search for each
  console.log('Running vector searches...');
  const candidatesPerJob: Candidate[][] = [];
  for (let i = 0; i < cacheMisses.length; i++) {
    const { data } = await supabaseAdmin.rpc('match_tests', {
      query_embedding: embeddings[i],
      match_threshold: 0.65,
      match_count: 5,
    });
    candidatesPerJob.push((data ?? []) as Candidate[]);
    if ((i + 1) % 100 === 0) process.stdout.write(`  searched ${i + 1}/${cacheMisses.length}\r`);
  }
  console.log('');

  // 7. Auto-resolve high-similarity hits
  const needsAI: RawJob[] = [];
  const needsAICandidates: Candidate[][] = [];
  let vectorResolved = 0;

  for (let i = 0; i < cacheMisses.length; i++) {
    const job = cacheMisses[i];
    const top = candidatesPerJob[i][0];
    if (top && top.similarity >= VECTOR_AUTO_THRESHOLD) {
      await commitMapping(job, top.id, 'vector_auto', top.similarity,
        `Vector ${(top.similarity * 100).toFixed(1)}% match to "${top.canonical_name_lt}"`);
      console.log(`  [vector ✓] ${job.raw_name} → ${top.canonical_name_lt} (${(top.similarity * 100).toFixed(0)}%)`);
      vectorResolved++;
    } else {
      needsAI.push(job);
      needsAICandidates.push(candidatesPerJob[i]);
    }
  }
  console.log(`\nVector auto-resolved: ${vectorResolved}  |  AI needed: ${needsAI.length}\n`);

  // 8. Tiered AI pipeline per job
  const total = jobs.length;
  let jobIndex = cacheHits.length + vectorResolved + 1;
  let totalCost = 0;

  for (let i = 0; i < needsAI.length; i++) {
    const job = needsAI[i];
    const candidates = needsAICandidates[i];

    let result: AgentResult;
    try {
      result = await runMappingAgent(
        { labId: job.labs.id, labName: job.labs.name, rawName: job.raw_name,
          priceEur: job.price_eur, labTestUrl: job.lab_test_url } satisfies JobContext,
        candidates,
      );
    } catch (err) {
      console.error(`  [✗] Job ${jobIndex}/${total} "${job.raw_name}": ${err}`);
      await supabaseAdmin.from('mapping_jobs')
        .update({ status: 'failed', error: String(err), finished_at: new Date().toISOString() })
        .eq('id', job.id);
      jobIndex++;
      continue;
    }

    // Duplicate safety net for 'create': verify the proposed new canonical
    // isn't actually an existing test under a different name.
    if (result.decision.action === 'create') {
      const dupEmbed = await embedText(result.decision.nameLt);
      const { data: dupHits } = await supabaseAdmin.rpc('match_tests', {
        query_embedding: dupEmbed,
        match_threshold: 0.88,
        match_count: 1,
      });
      if (dupHits?.length) {
        const dupName = (dupHits[0] as Candidate).canonical_name_lt;
        // Hard rules determine whether the proposed name and the near-duplicate
        // are genuinely different tests or the same test.
        const rule = applyHardRules(result.decision.nameLt, dupName);
        if (rule !== 'create_new') {
          // Rules say they could be the same — flag for human review
          result.decision = {
            action: 'flag',
            candidateIds: [(dupHits[0] as Candidate).id],
            reason: `Possible duplicate of "${dupName}"`,
          };
        }
        // else: hard rule confirms they're different (e.g. different IgClass,
        // pathogen count, sample type) → let create proceed
      }
    }

    // Execute decision
    try {
      if (result.decision.action === 'map') {
        await commitMapping(job, result.decision.canonicalId, 'ai_agent', result.decision.confidence, '');
      } else if (result.decision.action === 'create') {
        await createNewCanonical(job, result.decision);
      } else {
        await flagForHuman(job, result.decision.candidateIds, result.decision.reason);
      }
    } catch (err) {
      console.error(`  [✗] DB write failed for "${job.raw_name}": ${err}`);
      await supabaseAdmin.from('mapping_jobs')
        .update({ status: 'failed', error: String(err), finished_at: new Date().toISOString() })
        .eq('id', job.id);
      jobIndex++;
      continue;
    }

    const topMatch = candidates[0];
    const costUsd = estimateCost(result);
    totalCost += costUsd;

    console.log([
      `[Job ${jobIndex++}/${total}] "${job.raw_name}" (${job.labs.name})`,
      `  → vector top: ${topMatch ? `"${topMatch.canonical_name_lt}" at ${topMatch.similarity.toFixed(2)}` : 'none'}`,
      `  → path: ${result.path}  |  model calls: ${result.roundTrips} (${result.models.join(', ')})`,
      `  → tokens: ${result.inputTokens} in / ${result.outputTokens} out`,
      `  → decision: ${formatDecision(result.decision)}`,
      `  → est. cost: $${costUsd.toFixed(5)}`,
    ].join('\n'));
  }

  console.log(`\nDone. AI jobs: ${needsAI.length}, est. AI cost: $${totalCost.toFixed(4)}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
