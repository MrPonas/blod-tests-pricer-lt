/**
 * Returns a clean display name for a test, stripping lab-code prefixes
 * like "VitD 25-OH …", "|KL39| …", "IKL …" when a cleaner alias exists
 * or when the prefix can be stripped to reveal the real Lithuanian name.
 */
export function getDisplayName(nameLt: string, aliases?: string[]): string {
  // Strip |CODE| or IKL-style bracketed prefixes: "|KL39| Foo" → "Foo"
  const pipeMatch = nameLt.match(/^\|[A-Z0-9]+\|\s*(.*)/);
  if (pipeMatch) {
    const rest = pipeMatch[1].trim();
    return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : nameLt;
  }

  // Detect mixed-case vitamin/code prefixes like "VitD", "vitB12", "IKL"
  const hasCodePrefix =
    /^[Vv]it[A-Z]\d*\s/.test(nameLt) ||       // VitD, VitB, vitB12
    /^[A-Z]{2,5}\d+\s/.test(nameLt) ||          // IKL39, HE4 (but NOT BKT which is a proper name)
    /^[a-z]{2,4}[A-Z][a-z]*\d*\s/.test(nameLt); // vitB12

  if (hasCodePrefix) {
    // Prefer a clean alias: starts with a Lithuanian capital, no code prefix
    if (aliases?.length) {
      const clean = aliases.find(
        a => a !== nameLt && /^[A-ZĄČĘĖĮŠŲŪŽ]/.test(a) && !/^[Vv]it[A-Z]/.test(a) && !/^\|/.test(a)
      );
      if (clean) return clean;
    }
    // Strip the leading code token (e.g. "VitD " → remove first word)
    const stripped = nameLt.replace(/^\S+\s+/, '');
    if (stripped && stripped !== nameLt) {
      return stripped.charAt(0).toUpperCase() + stripped.slice(1);
    }
  }

  return nameLt;
}

/** Keywords that identify non-blood-test entries (procedures, packages, etc.) */
export const PROCEDURE_KEYWORDS = [
  'injekcija', 'infuzija', 'procedūra', 'procedurų', 'konsultacija',
  'programa', 'paketas', 'masažas', 'masažų',
];

export function isProcedure(nameLt: string): boolean {
  const lower = nameLt.toLowerCase();
  return PROCEDURE_KEYWORDS.some(kw => lower.includes(kw));
}
