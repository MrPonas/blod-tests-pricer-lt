import { normalizeTestName } from './normalize';

export type HardRuleResult = 'create_new' | 'safe_to_merge' | 'needs_ai';

// ── Extractors ────────────────────────────────────────────────────────────────

const IG_CLASSES = ['IgG', 'IgM', 'IgA', 'IgE', 'IgD'] as const;

function extractIgClass(name: string): string | null {
  // Match standard IgX suffix: "Candida IgG", "Anti-IgE"
  const igMatch = IG_CLASSES.find(ig => name.includes(ig));
  if (igMatch) return igMatch.slice(2); // 'IgG' → 'G'
  // Match "Imunoglobulinas G" (nominative) and "Imunoglobulino G" (genitive)
  const m = name.match(/\bImunoglobulin[ao]s?\s+([A-Z])\b/);
  return m ? m[1] : null;
}

function extractPathogenCount(name: string): number | null {
  // "7-ių sukėlėjų", "10-es sukėlėjų", "4 sukėlėjų"
  // sukėlėjų ends with ų (U+0173) not ū — must include in charset
  const m = name.match(/(\d+)[^\s]*\s+suk[eė]l[eė]j[uūų]/i);
  return m ? parseInt(m[1], 10) : null;
}

// Maps lowercase keyword → normalized type label
const SAMPLE_KEYWORDS: Record<string, string> = {
  'šlapime':  'urine',
  'šlapimo':  'urine',
  'serume':   'serum',
  'plazmoje': 'plasma',
  'nuogrand': 'swab',    // covers nuograndų, nuograndos
};

function extractSampleType(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [kw, type] of Object.entries(SAMPLE_KEYWORDS)) {
    if (lower.includes(kw)) return type;
  }
  return null;
}

// Pairs of normalized type labels that always mean clinically different tests
const INCOMPATIBLE_SAMPLE_PAIRS = new Set([
  'urine|serum',  'serum|urine',
  'urine|plasma', 'plasma|urine',
  'serum|plasma', 'plasma|serum',
  'swab|urine',   'urine|swab',
]);

function extractVitaminB(name: string): string | null {
  // "Vitaminas B12", "B12 vitaminas", "Vit. B6", "vitB12"
  const m = name.match(/\bvitamin[ao]s?\s+b\s*(\d+)\b/i)
          ?? name.match(/\bvit\s*b\s*(\d+)\b/i)
          ?? name.match(/\bB(\d{1,2})\b/);
  return m ? m[1] : null;
}

function extractChildCount(name: string): number | null {
  // "2 vaikai", "3 vaiko", "tėvystės testas 3 vaikai"
  const m = name.match(/(\d+)\s*vaik[aoiū]/i);
  return m ? parseInt(m[1], 10) : null;
}

// Maps lowercase qualifier → normalized label
const POSITIONAL_QUALIFIERS: Record<string, string> = {
  'stovint':         'standing',
  'gulint':          'lying',
  'ramybėje':       'rest',
  'judant':          'moving',
  'rytinis':         'morning',
  'vakarinis':       'evening',
  'po apkrovos':     'post_load',
  'po provokacijos': 'post_provocation',
  'nevalgius':       'fasting',
  'po valgio':       'post_meal',
  'paros':           'diurnal',
  'kapiliarinis':    'capillary',
};

function extractPositionalQualifier(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [kw, label] of Object.entries(POSITIONAL_QUALIFIERS)) {
    if (lower.includes(kw)) return label;
  }
  return null;
}

function isLpiPanel(name: string): boolean {
  return /\blpi\b|\blpl\b/i.test(name) || /\d+[^\s]*\s+suk[eė]l[eė]j[uūų]/i.test(name);
}

// ── Rule 12 helpers ───────────────────────────────────────────────────────────

const GENUS_SPECIES_RE = /\b(Mycoplasma|Chlamydia|Ureaplasma|Neisseria|Trichomonas|Gardnerella)\s+(\w+)\b/gi;

function extractGenusSpecies(name: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const m of name.matchAll(GENUS_SPECIES_RE)) {
    result.set(m[1].toLowerCase(), m[2].toLowerCase());
  }
  return result;
}

// ── Rule 11 helpers ───────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = new Array<number>(n + 1);
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[n];
}

const STOP_WORDS = new Set(['pries', 'ir', 'su', 'be']);
// Normalized (diacritic-stripped) sample/qualifier tokens — used to guard Rule 11
// so it doesn't silently merge tests that differ by specimen type
const SAMPLE_TYPE_TOKENS = new Set([
  'slapime', 'slapimo', 'slapimu', 'serume', 'serumas', 'plazmoje', 'nuogrand',
]);

function meaningfulTokens(normalized: string): Set<string> {
  return new Set(
    normalized.split(/\s+/).filter(t => t.length >= 2 && !STOP_WORDS.has(t))
  );
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Apply deterministic hard rules that decide whether two test names refer to
 * the same test or different ones — without AI involvement.
 *
 * @param rawName       The incoming lab name to classify
 * @param candidateName The existing canonical name being compared against
 * @param similarity    Optional cosine similarity score (required for rule 8)
 *
 * Returns:
 *   'create_new'    — definitively different tests; skip AI, create new canonical
 *   'safe_to_merge' — definitively same test; skip AI, commit mapping directly
 *   'needs_ai'      — ambiguous; proceed with existing AI pipeline
 *
 * Rules run in order; first match wins.
 */
export function applyHardRules(
  rawName: string,
  candidateName: string,
  similarity?: number,
): HardRuleResult {

  // Rule 9: Exact normalized name match — unambiguously the same test
  if (normalizeTestName(rawName) === normalizeTestName(candidateName)) {
    return 'safe_to_merge';
  }

  // Rule 8: Rezus pipe-format "LAB | TestName" with high vector similarity
  // These are always the same test with a lab prefix stripped
  if (rawName.includes(' | ') && similarity !== undefined && similarity >= 0.85) {
    return 'safe_to_merge';
  }

  // Rule 1: Antibody class mismatch — IgG/IgM/IgA/IgE/IgD differ → distinct tests
  // Prevents false duplicate flags (e.g. Candida IgG vs Candida IgM)
  const rawIg = extractIgClass(rawName);
  const candIg = extractIgClass(candidateName);
  if (rawIg && candIg && rawIg !== candIg) {
    return 'create_new';
  }

  // Rule 2: Pathogen count mismatch — "7 sukėlėjų" vs "4 sukėlėjų" → different panels
  const rawCount = extractPathogenCount(rawName);
  const candCount = extractPathogenCount(candidateName);
  if (rawCount !== null && candCount !== null && rawCount !== candCount) {
    return 'create_new';
  }

  // Rule 7: LPI/LPL panel — urine (šlapime) vs non-urine specimen → different tests
  // Checked before generic Rule 3 because panels without šlapime default to swab/genital
  if (isLpiPanel(rawName) && isLpiPanel(candidateName)) {
    const rawUrine  = /šlapim/i.test(rawName);
    const candUrine = /šlapim/i.test(candidateName);
    if (rawUrine !== candUrine) return 'create_new';
  }

  // Rule 3: Incompatible explicit sample types (šlapime↔serume, šlapime↔plazmoje, etc.)
  const rawSample  = extractSampleType(rawName);
  const candSample = extractSampleType(candidateName);
  if (rawSample && candSample && rawSample !== candSample) {
    if (INCOMPATIBLE_SAMPLE_PAIRS.has(`${rawSample}|${candSample}`)) {
      return 'create_new';
    }
  }
  // Rule 3b: One name has an explicit sample type qualifier, the other doesn't.
  // Cannot safely auto-map — could be serum vs urine variant of same analyte.
  // Catches: "Mycoplasma DNR (PGR) šlapime" vs "Mycoplasma DNR (PGR)"
  if ((rawSample && !candSample) || (!rawSample && candSample)) {
    return 'needs_ai';
  }

  // Rule 4: Vitamin B number mismatch — B1/B2/B6/B12 etc. → different vitamins
  const rawVitB  = extractVitaminB(rawName);
  const candVitB = extractVitaminB(candidateName);
  if (rawVitB !== null && candVitB !== null && rawVitB !== candVitB) {
    return 'create_new';
  }

  // Rule 5: Parent/child DNA panel size — "3 vaikai" vs "2 vaikai" → different products
  const rawChildren  = extractChildCount(rawName);
  const candChildren = extractChildCount(candidateName);
  if (rawChildren !== null && candChildren !== null && rawChildren !== candChildren) {
    return 'create_new';
  }

  // Rule 6: Both names have positional qualifiers that differ → distinct conditions
  const rawPos  = extractPositionalQualifier(rawName);
  const candPos = extractPositionalQualifier(candidateName);
  if (rawPos && candPos && rawPos !== candPos) {
    return 'create_new';
  }

  // Rule 10: Raw name has NO positional qualifier but candidate does.
  // Cannot determine which variant is correct without the lab's full description.
  // Incident: "ALD Aldosteronas" was auto-mapped to "Aldosteronas (stovint)" instead
  // of "Aldosteronas (ramybėje)". Must go to human review, never auto-commit.
  if (!rawPos && candPos) {
    return 'needs_ai';
  }

  // Rule 12: Pathogen species mismatch — same genus, different species → distinct tests
  // e.g. Mycoplasma hominis vs Mycoplasma genitalium, Chlamydia trachomatis vs Chlamydia pneumoniae
  const rawGenSpec  = extractGenusSpecies(rawName);
  const candGenSpec = extractGenusSpecies(candidateName);
  for (const [genus, rawSpecies] of rawGenSpec) {
    const candSpecies = candGenSpec.get(genus);
    if (candSpecies && rawSpecies !== candSpecies) {
      return 'create_new';
    }
  }

  // Rule 11: Typo or word-order variant — safe to auto-merge
  const normRaw  = normalizeTestName(rawName);
  const normCand = normalizeTestName(candidateName);

  // 11a: Tiny edit distance after normalization (catches Toxocora→Toxocara, etc.)
  if (Math.abs(normRaw.length - normCand.length) <= 2) {
    if (levenshtein(normRaw, normCand) <= 2) {
      return 'safe_to_merge';
    }
  }

  // 11b: Same meaningful token set or one is a strict subset — word-order and redundant prefix variants
  const tokRaw  = meaningfulTokens(normRaw);
  const tokCand = meaningfulTokens(normCand);
  if (tokRaw.size > 0 && tokCand.size > 0) {
    const setsEqual = tokRaw.size === tokCand.size && [...tokRaw].every(t => tokCand.has(t));
    if (setsEqual) return 'safe_to_merge';

    const [smaller, larger] = tokRaw.size <= tokCand.size ? [tokRaw, tokCand] : [tokCand, tokRaw];
    if ([...smaller].every(t => larger.has(t))) {
      const extra = [...larger].filter(t => !smaller.has(t));
      if (!extra.some(t => SAMPLE_TYPE_TOKENS.has(t)) && extra.length <= 2) {
        return 'safe_to_merge';
      }
    }
  }

  return 'needs_ai';
}
