import Anthropic from '@anthropic-ai/sdk';
import { Langfuse } from 'langfuse';
import { supabaseAdmin } from '@/lib/db';
import { embedText } from './embed';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobContext {
  labId: number;
  labName: string;
  rawName: string;
  priceEur: number;
  labTestUrl?: string | null;
}

type Candidate = { id: number; canonical_name_lt: string; similarity: number };

export type MappingDecision =
  | { action: 'map';    canonicalId: number; confidence: number }
  | { action: 'create'; nameLt: string; nameEn?: string; category: string; confidence: number }
  | { action: 'flag';   candidateIds: number[]; reason: string };

export interface AgentResult {
  decision: MappingDecision;
  path: 'haiku' | 'sonnet';
  roundTrips: number;
  inputTokens: number;
  outputTokens: number;
  models: string[];
}

// ── Prompts ───────────────────────────────────────────────────────────────────

const REPHRASE_SYSTEM = `Return only valid JSON: {"queries":["...","..."]}
Generate 2 alternative search queries for this Lithuanian medical test name.
Use: abbreviation expansion, English synonym, LOINC term, or different word order.
No explanation — JSON only.`;

const DECISION_SYSTEM = `You are a Lithuanian medical lab test classifier.
Return only valid JSON, one of:
{"action":"map","canonical_id":N,"confidence":0.95}
{"action":"create","canonical_name_lt":"...","canonical_name_en":"...","category":"hormones|vitamins|biochemistry|haematology|infections|allergy|tumour_markers|urinalysis|other","confidence":0.85}
{"action":"flag","candidate_ids":[N],"reason":"..."}

Rules:
- map = same analyte + same sample type as a candidate
- create = no candidate matches after considering all options
- flag = sample type ambiguous, or quantitative vs qualitative distinction unclear
- "serume" and "šlapime" are clinically DIFFERENT — flag if ambiguous
- Lithuanian: TSH=Tireotropinas, OAM=šlapimo bendroji analizė, KLA=kraujo bendroji analizė, CRB=C reaktyvusis baltymas
No explanation — JSON only.`;

// ── Step 1: Rephrase ──────────────────────────────────────────────────────────

async function getRephrasedQueries(
  anthropic: Anthropic,
  rawName: string,
  labName: string,
  candidates: Candidate[],
): Promise<{ queries: string[]; inputTokens: number; outputTokens: number }> {
  const topNames = candidates.slice(0, 3).map(c => `"${c.canonical_name_lt}"`).join(', ');
  const userMsg = `Lab: ${labName}\nTest name: "${rawName}"\nCurrent top candidates: ${topNames || 'none'}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    system: REPHRASE_SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });

  const text = response.content.find(b => b.type === 'text')?.text ?? '{}';
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { queries?: string[] };
    return {
      queries: parsed.queries ?? [],
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch {
    return { queries: [], inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  }
}

// ── Step 3: Final decision ────────────────────────────────────────────────────

async function decideFinal(
  anthropic: Anthropic,
  rawName: string,
  labName: string,
  candidates: Candidate[],
  useSonnet: boolean,
): Promise<{ decision: MappingDecision; inputTokens: number; outputTokens: number }> {
  const model = useSonnet ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';

  const candidateList = candidates.length > 0
    ? candidates.slice(0, 3).map((c, i) =>
        `${i + 1}. ID ${c.id}: "${c.canonical_name_lt}" (${(c.similarity * 100).toFixed(0)}%)`
      ).join('\n')
    : '(no candidates found)';

  const userMsg = `Lab: ${labName}\nRaw test name: "${rawName}"\n\nTop candidates:\n${candidateList}\n\nDecide.`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 150,
    system: DECISION_SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });

  const text = response.content.find(b => b.type === 'text')?.text ?? '{}';
  const raw = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as {
    action?: string;
    canonical_id?: number;
    confidence?: number;
    canonical_name_lt?: string;
    canonical_name_en?: string;
    category?: string;
    candidate_ids?: number[];
    reason?: string;
  };

  let decision: MappingDecision;
  if (raw.action === 'map' && raw.canonical_id) {
    decision = { action: 'map', canonicalId: raw.canonical_id, confidence: raw.confidence ?? 0.8 };
  } else if (raw.action === 'create' && raw.canonical_name_lt) {
    decision = { action: 'create', nameLt: raw.canonical_name_lt, nameEn: raw.canonical_name_en, category: raw.category ?? 'other', confidence: raw.confidence ?? 0.85 };
  } else {
    decision = { action: 'flag', candidateIds: raw.candidate_ids ?? [], reason: raw.reason ?? 'No clear decision from model' };
  }

  return { decision, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export async function runMappingAgent(
  ctx: JobContext,
  initialCandidates: Candidate[],
): Promise<AgentResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_MAPPING });
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
  });

  const trace = langfuse.trace({
    name: 'mapping-agent',
    input: { raw_name: ctx.rawName, lab: ctx.labName },
    metadata: { lab_id: ctx.labId },
  });

  let totalInput = 0;
  let totalOutput = 0;
  let roundTrips = 0;
  const models: string[] = [];

  try {
    // ── Step 1 & 2: Rephrase + extra vector searches ──────────────────────────
    let merged = [...initialCandidates];

    if (initialCandidates.length > 0) {
      const { queries, inputTokens, outputTokens } = await getRephrasedQueries(
        anthropic, ctx.rawName, ctx.labName, initialCandidates
      );
      totalInput += inputTokens;
      totalOutput += outputTokens;
      roundTrips++;
      models.push('haiku');

      if (queries.length > 0) {
        const extraResults = await Promise.all(
          queries.map(async q => {
            const embedding = await embedText(q);
            const { data } = await supabaseAdmin.rpc('match_tests', {
              query_embedding: embedding,
              match_threshold: 0.65,
              match_count: 3,
            });
            return (data ?? []) as Candidate[];
          })
        );

        const seen = new Set(initialCandidates.map(c => c.id));
        for (const batch of extraResults) {
          for (const c of batch) {
            if (!seen.has(c.id)) {
              seen.add(c.id);
              merged.push(c);
            }
          }
        }
        merged.sort((a, b) => b.similarity - a.similarity);
        merged = merged.slice(0, 3);
      }
    }

    // ── Step 3: Final decision ────────────────────────────────────────────────
    const bestSimilarity = merged[0]?.similarity ?? 0;
    const useSonnet = bestSimilarity < 0.80;

    const { decision, inputTokens, outputTokens } = await decideFinal(
      anthropic, ctx.rawName, ctx.labName, merged, useSonnet
    );
    totalInput += inputTokens;
    totalOutput += outputTokens;
    roundTrips++;
    models.push(useSonnet ? 'sonnet' : 'haiku');

    const result: AgentResult = {
      decision,
      path: useSonnet ? 'sonnet' : 'haiku',
      roundTrips,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      models,
    };

    trace.update({ output: { status: 'done', action: decision.action, path: result.path } });
    return result;

  } catch (err) {
    trace.update({ output: { status: 'error', error: String(err) } });
    throw err;
  } finally {
    await langfuse.flushAsync();
  }
}
