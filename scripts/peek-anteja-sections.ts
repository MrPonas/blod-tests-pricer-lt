import dotenv from 'dotenv';
import FirecrawlApp from '@mendable/firecrawl-js';

dotenv.config({ path: '.env.local' });

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY ?? 'mylocalsecret123',
  apiUrl: process.env.FIRECRAWL_API_URL ?? 'http://localhost:3002',
});

const SECTIONS = [
  'https://www.anteja.lt/tyrimai/kiti-tyrimai/mikrobiologijos-tyrimai',
  'https://www.anteja.lt/tyrimai/kiti-tyrimai/molekuline-diagnostika-pgr-metodas',
  'https://www.anteja.lt/tyrimai/kiti-tyrimai/onkocitologiniai-tyrimai',
  'https://www.anteja.lt/tyrimai/kiti-tyrimai/tevystes-giminystes-nustatymai',
  'https://www.anteja.lt/tyrimai/slapimo-tyrimai',
  'https://www.anteja.lt/tyrimai/koprologiniai-tyrimai',
  'https://www.anteja.lt/tyrimai/genetiniai-onkologiniai-ir-nevaisingumo-tyrimai',
];

async function main() {
  let totalEstimate = 0;

  for (const url of SECTIONS) {
    const r = await (firecrawl as any).v1.scrapeUrl(url, { formats: ['markdown'], timeout: 30000 });
    if (!r.success) { console.log(url + ': FAILED'); continue; }
    const md: string = r.markdown ?? '';
    // Count price lines — lines with '€' symbol
    const priceLines = md.split('\n').filter(l => l.includes('€'));
    const section = url.split('/').at(-1) ?? url;
    console.log(`\n[${section}] ~${priceLines.length} tests`);
    priceLines.slice(0, 5).forEach(l => console.log('  ' + l.trim().slice(0, 100)));
    if (priceLines.length > 5) console.log(`  ... and ${priceLines.length - 5} more`);
    totalEstimate += priceLines.length;
  }

  console.log(`\nTotal Anteja missing section estimate: ~${totalEstimate} tests`);
  console.log('\n--- Cost estimate ---');
  // Haiku extraction: ~800 input tokens per page (markdown + prompt), ~200 output
  // Each section page = 1 Haiku call
  const PAGES = SECTIONS.length;
  const INPUT_PER_PAGE = 1200;  // markdown of ~200 tests + system prompt
  const OUTPUT_PER_PAGE = 600;  // JSON array of tests
  const HAIKU_IN  = 0.80 / 1e6;   // $ per input token
  const HAIKU_OUT = 4.00 / 1e6;   // $ per output token
  const extractCost = PAGES * (INPUT_PER_PAGE * HAIKU_IN + OUTPUT_PER_PAGE * HAIKU_OUT);
  console.log(`Anteja extraction (${PAGES} pages × Haiku): $${extractCost.toFixed(4)}`);
  console.log(`Anteja mapping jobs (${totalEstimate} new tests, ~70% cache miss → ~${Math.round(totalEstimate * 0.7)} AI calls):`);
  console.log(`  Haiku mapping: ~$${(totalEstimate * 0.7 * 0.002).toFixed(2)}`);
}

main().catch(console.error);
