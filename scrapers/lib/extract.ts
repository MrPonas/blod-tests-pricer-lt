import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedTest } from '@/lib/types';

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_EXTRACTION });
}

const labPromptHints: Record<string, string> = {
  synlab: 'Prices are shown in a table or list format.',
  anteja: `The page is an OpenCart product listing. Ignore the long cookie consent section at the top.
The actual tests are in a table with columns: "Tyrimų ID | Pavadinimas | Kaina".
Each row has a test ID number, a test name (Lithuanian), and a price like "11.00€".
Some rows show two prices like "19.00€ 42.00€" — use the FIRST (lower) price, it is the current price.
Extract every test name and its current price.`,
  affidea: 'Extract all tests and EUR prices visible on the page.',
  meliva:  'Extract all tests and EUR prices visible on the page.',
  rezus: `The page lists blood tests organized by sections (e.g. "Mikroskopiniai tyrimai", "Hormonai", etc.).
Each test has a Lithuanian name and a price in the format "12,00€" (comma as decimal separator).
Convert comma decimals to dot decimals in price_eur (e.g. "12,00€" → 12.00).
Extract every test name and its price. Ignore "Rinkiniai į namus" (home kits) if present.`,
};

export async function extractPrices(
  pageMarkdown: string,
  labSlug: string
): Promise<ExtractedTest[]> {
  const hint = labPromptHints[labSlug] ?? 'Extract all tests and prices on the page.';

  const prompt = `You are extracting blood test prices from a Lithuanian laboratory website.

${hint}

From the page content below, extract ALL blood tests and their prices.

Return ONLY valid JSON — no explanation, no markdown fences:
{"tests":[{"name":"Vitaminas D (25-OH)","price_eur":12.50,"url":null}]}

Rules:
- price_eur must be a number, not a string
- url is the direct link to this test if visible, otherwise null
- Skip tests with no listed price
- If you see prices with and without VAT, use the final price including VAT

Page content:
${pageMarkdown}`;

  // Chunk large pages to avoid hitting output token limits
  const MAX_INPUT_CHARS = 80000;
  if (pageMarkdown.length > MAX_INPUT_CHARS) {
    const chunks = [];
    for (let i = 0; i < pageMarkdown.length; i += MAX_INPUT_CHARS) {
      chunks.push(pageMarkdown.slice(i, i + MAX_INPUT_CHARS));
    }
    const allTests: ExtractedTest[] = [];
    for (const chunk of chunks) {
      const chunkResults = await extractPrices(chunk, labSlug);
      allTests.push(...chunkResults);
    }
    return allTests;
  }

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    return JSON.parse(text).tests ?? [];
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]).tests ?? [];
    throw new Error(`Failed to parse Claude response: ${text.substring(0, 300)}`);
  }
}
