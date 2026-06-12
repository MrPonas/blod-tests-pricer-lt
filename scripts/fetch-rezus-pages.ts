import dotenv from 'dotenv';
import FirecrawlApp from '@mendable/firecrawl-js';
dotenv.config({ path: '.env.local' });

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY ?? 'mylocalsecret123',
  apiUrl: process.env.FIRECRAWL_API_URL ?? 'http://localhost:3002',
});

const PAGES = [
  'https://www.rezus.lt/androstendionas',
  'https://www.rezus.lt/vitamino-d-tyrimas',
  'https://www.rezus.lt/bkt-bendras-kraujo-tyrimas',
  'https://www.rezus.lt/tsh-tireotropinas',
  'https://www.rezus.lt/kreatininas',
];

async function main() {
  for (const url of PAGES) {
    const r = await (firecrawl as any).v1.scrapeUrl(url, { formats: ['markdown'], timeout: 30000 });
    const slug = url.split('/').at(-1);
    console.log('\n' + '='.repeat(70));
    console.log('PAGE: ' + slug);
    console.log('='.repeat(70));
    if (!r.success) { console.log('FAILED'); continue; }
    console.log(r.markdown ?? '(empty)');
  }
}
main().catch(console.error);
