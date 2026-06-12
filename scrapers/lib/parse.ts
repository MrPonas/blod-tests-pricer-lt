import type { ExtractedTest } from '@/lib/types';

/**
 * Anteja: OpenCart product listing.
 * Each entry: standalone numeric ID → [Name](url) → price line like "11.00€" or "19.00€ 42.00€"
 */
function parseAnteja(markdown: string): ExtractedTest[] {
  const results: ExtractedTest[] = [];
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length - 3; i++) {
    const line = lines[i].trim();
    if (!/^\d{3,6}$/.test(line)) continue;

    let name = '';
    let url: string | null = null;
    let price: number | null = null;

    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const l = lines[j].trim();

      if (!name) {
        const m = l.match(/^\[([^\]]+)\]\(([^\s)]+)/);
        if (m) { name = m[1]; url = m[2]; }
      }

      if (!price) {
        const m = l.match(/(\d+[.,]\d+)€/);
        if (m) { price = parseFloat(m[1].replace(',', '.')); }
      }

      if (name && price !== null) break;
    }

    if (name && price !== null) {
      results.push({ name, price_eur: price, url });
    }
  }

  return results;
}

/**
 * Rezus: two link formats.
 * Standard tests: [Name  \<newline>**Prekės kodas:** NNNNN](url) → price like "12,00€"
 * Package bundles: [Name](url) (single-line, no Prekės kodas) → price
 */
function parseRezus(markdown: string): ExtractedTest[] {
  const results: ExtractedTest[] = [];
  const seen = new Set<string>();

  // Standard individual tests
  const reStandard = /\[([^\n\]]+?)\s*\\\s*\n\*\*Prekės kodas:\*\*[^\]]*\]\((https?:\/\/[^\s)]+)[^)]*\)[^\n]*\n+\s*([\d]+[,.][\d]+)€/g;
  let m: RegExpExecArray | null;
  while ((m = reStandard.exec(markdown)) !== null) {
    const name = m[1].trim();
    seen.add(name);
    results.push({ name, price_eur: parseFloat(m[3].replace(',', '.')), url: m[2] });
  }

  // Package/bundle entries: standalone [Name](url) line → price
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length - 2; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('[') || line.includes('Plačiau') || line.includes('krepšelį')) continue;

    // Match URL up to first space/quote; accept if line ends with ) — handles titles with parentheses
    const linkMatch = line.match(/^\[([^\]]+)\]\((https?:\/\/[^\s"']+)/);
    if (!linkMatch || !line.trimEnd().endsWith(')')) continue;

    const name = linkMatch[1].trim();
    if (seen.has(name)) continue;

    // Look ahead for price, skipping badge labels (Akcija, Naujiena, Top)
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const l = lines[j].trim();
      const priceMatch = l.match(/^([\d]+[,.][\d]+)€$/);
      if (priceMatch) {
        seen.add(name);
        results.push({ name, price_eur: parseFloat(priceMatch[1].replace(',', '.')), url: linkMatch[2] });
        break;
      }
      if (l.startsWith('[') && !l.includes('Plačiau')) break;
    }
  }

  return results;
}

const parsers: Record<string, (md: string) => ExtractedTest[]> = {
  anteja: parseAnteja,
  rezus: parseRezus,
};

/**
 * Returns parsed tests if a deterministic parser exists for this lab, otherwise null.
 * Caller should fall back to Claude when null or when result is empty.
 */
export function parseDeterministic(markdown: string, labSlug: string): ExtractedTest[] | null {
  const parser = parsers[labSlug];
  if (!parser) return null;
  return parser(markdown);
}
