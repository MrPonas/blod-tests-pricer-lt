import FirecrawlApp from '@mendable/firecrawl-js';

const app = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY ?? 'mylocalsecret123',
  apiUrl: process.env.FIRECRAWL_API_URL ?? 'http://localhost:3002',
});

export async function fetchPage(url: string): Promise<string> {
  const result = await app.v1.scrapeUrl(url, { formats: ['markdown'], timeout: 60000 });

  if (!result.success) {
    throw new Error(`Firecrawl failed for ${url}`);
  }

  return result.markdown ?? '';
}
