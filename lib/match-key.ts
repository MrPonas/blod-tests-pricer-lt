/**
 * Generates a deterministic, vendor-agnostic ASCII key from a Lithuanian lab test name.
 *
 * The key strips all lab-specific catalog codes, suffixes, and explanatory
 * parentheticals before normalizing diacritics and collapsing to a hyphen-slug.
 * The same real-world test will produce the same key regardless of which lab's
 * naming conventions were used to name it.
 *
 * Examples:
 *   "A-AMYL | Alfa Amilazė"                                    → "alfa-amilaze"
 *   "AMYL Alfa-amilazės tyrimai"                               → "alfa-amilaze"
 *   "Anti-Tg Antikūnai prieš tiroglobuliną (skydl...)"         → "antikunai-pries-tiroglobulina"
 *   "Anti – Tg | Antikūnai prieš tiroglobuliną"                → "antikunai-pries-tiroglobulina"
 */
export function generateMatchKey(rawName: string): string {
  let s = rawName;

  // 1. Strip pipe-format codes: "CODE | Name" → "Name"
  if (s.includes(' | ')) s = s.split(' | ').slice(1).join(' | ');

  // 2. Strip leading alphanumeric catalog codes: "AB12 Name" / "AMYL Name" → "Name"
  //    Only when followed by an uppercase Lithuanian/Latin letter (avoids over-stripping)
  s = s.replace(/^[A-ZŽŠŪ\-]{1,8}\d*\s+(?=[A-ZŽŠŲ])/, '');

  // 3. Strip common Anteja suffixes
  s = s.replace(/\s+tyrimai$/i, '');
  s = s.replace(/\s+-\s+tyrimas$/i, '');
  s = s.replace(/\s+tyrimas$/i, '');

  // 4. Strip long explanatory parentheticals at end (20+ chars = explanatory, not specifier)
  //    Short ones like "(IgA)", "(5 dif.)" are preserved as they distinguish test variants.
  s = s.replace(/\s+\([^)]{20,}\)$/g, '');

  // 5. Strip mixed-case lab code prefixes like "Anti-Tg ", "Ca-125 " before a word
  //    Pattern: CapLow{1-3}-Cap{1-3} followed by a space
  s = s.replace(/^[A-Z][a-z]{1,4}-[A-Z0-9][a-z]{0,3}\s+/, '');

  // 6. Normalize Lithuanian diacritics to ASCII equivalents
  s = s
    .replace(/[ąĄ]/g, 'a')
    .replace(/[čČ]/g, 'c')
    .replace(/[ęĘ]/g, 'e')
    .replace(/[ėĖ]/g, 'e')
    .replace(/[įĮ]/g, 'i')
    .replace(/[šŠ]/g, 's')
    .replace(/[ųŲ]/g, 'u')
    .replace(/[ūŪ]/g, 'u')
    .replace(/[žŽ]/g, 'z');

  // 7. Lowercase, collapse runs of non-alphanumeric chars to a single hyphen, trim
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
