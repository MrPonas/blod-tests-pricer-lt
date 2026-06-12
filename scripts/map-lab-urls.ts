/**
 * Maps Rezus and Anteja sites via Firecrawl and cross-references
 * against lab_test_url values already in the prices table.
 * Reports coverage gap counts per lab. Does NOT scrape anything.
 */

import dotenv from 'dotenv';
import FirecrawlApp from '@mendable/firecrawl-js';

dotenv.config({ path: '.env.local' });

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY ?? 'mylocalsecret123',
  apiUrl: process.env.FIRECRAWL_API_URL ?? 'http://localhost:3002',
});

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('https://', '').split('.')[0];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN!;

async function sql<T = Record<string, unknown>>(q: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data as T[];
}

// Rezus: individual test pages are https://rezus.lt/<slug>
// Exclude these path prefixes / patterns
const REZUS_EXCLUDE = new Set([
  '/visi-tyrimai', '/kontaktai', '/apie-mus', '/naujienos',
  '/gydytojai', '/akcijos', '/nuolaidos', '/prisijungimas',
  '/registracija', '/duk', '/karjera', '/es-projektai',
  '/index.php', '/wp-', '/wp-content', '/wp-admin',
]);

function isRezusTestUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('rezus')) return false;
    if (u.hash) return false;
    const path = u.pathname;
    // Must be exactly one path segment: /slug
    const segments = path.split('/').filter(Boolean);
    if (segments.length !== 1) return false;
    const slug = '/' + segments[0];
    // Exclude known non-test paths
    for (const excl of REZUS_EXCLUDE) {
      if (slug.startsWith(excl)) return false;
    }
    // Exclude query strings
    if (u.search) return false;
    return true;
  } catch {
    return false;
  }
}

// Anteja: individual test pages are https://anteja.lt/tyrimai/<category>/<slug>
// Category list pages are depth 2: /tyrimai/<category>
// Product pages are depth 3: /tyrimai/<category>/<product>
function isAntejaTestUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('anteja')) return false;
    if (u.hash || u.search) return false;
    const segments = u.pathname.split('/').filter(Boolean);
    // Exactly 3 segments: tyrimai / category / product-slug
    return segments.length === 3 && segments[0] === 'tyrimai';
  } catch {
    return false;
  }
}

async function analyzelab(
  labName: string,
  labSlug: string,
  rootUrl: string,
  isTestUrl: (url: string) => boolean,
): Promise<void> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${labName} — mapping ${rootUrl}`);
  console.log('─'.repeat(60));

  // Get lab ID and existing URLs from DB
  const [labRow] = await sql<{ id: number }>(`SELECT id FROM labs WHERE slug = '${labSlug}'`);
  if (!labRow) { console.log(`Lab '${labSlug}' not found in DB`); return; }
  const labId = labRow.id;

  const dbUrls = await sql<{ url: string; test_name: string }>(
    `SELECT DISTINCT p.lab_test_url AS url, p.lab_test_name AS test_name
     FROM prices p WHERE p.lab_id = ${labId} AND p.lab_test_url IS NOT NULL AND p.is_stale = false`
  );
  const dbUrlSet = new Set(dbUrls.map(r => r.url.replace(/\/$/, '').toLowerCase()));
  console.log(`DB: ${dbUrls.length} prices with lab_test_url`);

  // Sample a few DB URLs to understand structure
  console.log('Sample DB URLs:');
  dbUrls.slice(0, 5).forEach(r => console.log(`  ${r.url}  "${r.test_name}"`));

  // Map the site
  console.log(`\nCalling Firecrawl mapUrl (limit 2000)...`);
  let mapResult: any;
  try {
    mapResult = await (firecrawl as any).v1.mapUrl(rootUrl, { limit: 2000 });
  } catch (err) {
    console.error(`mapUrl failed: ${err}`);
    return;
  }

  const allUrls: string[] = mapResult.links ?? mapResult.urls ?? [];
  console.log(`Firecrawl returned ${allUrls.length} total URLs`);

  // Filter to test product URLs
  const testUrls = allUrls.filter(isTestUrl);
  console.log(`After filtering: ${testUrls.length} test/product URLs`);

  // Cross-reference
  const inDb = testUrls.filter(u => dbUrlSet.has(u.replace(/\/$/, '').toLowerCase()));
  const missing = testUrls.filter(u => !dbUrlSet.has(u.replace(/\/$/, '').toLowerCase()));

  console.log(`\nCoverage:`);
  console.log(`  In DB:   ${inDb.length} / ${testUrls.length} (${testUrls.length > 0 ? Math.round(inDb.length / testUrls.length * 100) : 0}%)`);
  console.log(`  Missing: ${missing.length}`);

  if (missing.length > 0 && missing.length <= 30) {
    console.log('\nMissing URLs:');
    missing.forEach(u => console.log(`  ${u}`));
  } else if (missing.length > 30) {
    console.log('\nFirst 30 missing URLs:');
    missing.slice(0, 30).forEach(u => console.log(`  ${u}`));
    console.log(`  ... and ${missing.length - 30} more`);
  }
}

async function main() {
  await analyzelab('Rezus', 'rezus', 'https://www.rezus.lt', isRezusTestUrl);
  await analyzelab('Anteja', 'anteja', 'https://anteja.lt', isAntejaTestUrl);
}

main().catch(console.error);
