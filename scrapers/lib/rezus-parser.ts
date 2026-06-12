/**
 * Zero-cost parser for individual Rezus product pages.
 *
 * Each page has a consistent structure:
 *
 *   [optional] Kraujo paėmimo mokestis 5,00€   ← blood draw fee — ignore
 *   [image]
 *
 *   Test Name                                    ← setext H1
 *   =========
 *
 *   30,00€                                       ← test price
 *
 *   **Prekės kodas:** 18965                      ← product code (optional)
 *
 * Returns null for 404 pages, pages missing a price, or pages where the
 * name/price pattern is absent (triggers Haiku fallback in the scraper).
 */

export interface RezusParseResult {
  name: string;
  priceEur: number;
  productCode?: string;
}

// Matches "30,00€" or "15,50€" — European decimal comma, no thousands separator
const PRICE_RE = /^(\d{1,5},\d{2})€\s*$/m;

// Setext H1: a non-empty line followed by a line of ===
// The name line may contain " | " (Rezus pipe format, e.g. "BKT | Bendras kraujo tyrimas")
const H1_SETEXT_RE = /^([^\n\r]+)\n={3,}\s*\n/m;

// Product code for deduplication — optional
const PRODUCT_CODE_RE = /\*\*Prekės kodas:\*\*\s*(\d+)/;

export function parseRezusPage(markdown: string): RezusParseResult | null {
  // ── 404 detection ────────────────────────────────────────────────────────
  if (/\n404\n={3,}/.test(markdown) || /^404\n={3,}/.test(markdown)) {
    return null;
  }

  // ── Find H1 (setext style) ────────────────────────────────────────────────
  const h1Match = H1_SETEXT_RE.exec(markdown);
  if (!h1Match) return null;

  const name = h1Match[1].trim();
  const afterH1 = markdown.slice(h1Match.index + h1Match[0].length);

  // ── Find price — first standalone "XX,XX€" line after the H1 ─────────────
  // Scan at most the next ~500 chars to avoid picking up prices in descriptions
  const priceMatch = PRICE_RE.exec(afterH1.slice(0, 500));
  if (!priceMatch) return null;

  const priceStr = priceMatch[1].replace(',', '.');
  const priceEur = parseFloat(priceStr);
  if (isNaN(priceEur) || priceEur <= 0) return null;

  // ── Product code (optional) ───────────────────────────────────────────────
  const codeMatch = PRODUCT_CODE_RE.exec(afterH1.slice(0, 300));
  const productCode = codeMatch?.[1];

  return { name, priceEur, productCode };
}
