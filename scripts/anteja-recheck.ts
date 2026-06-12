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
  const data = await res.json();
  return data as T[];
}

const ANTEJA_EXCLUDE = new Set([
  '/tyrimai', '/kontaktai', '/apie-mus', '/naujienos', '/gydytojai',
  '/akcijos', '/nuolaidos', '/prisijungimas', '/registracija',
  '/duk', '/karjera', '/es-projektai', '/index.php', '/paketai',
  '/kaina', '/kainos', '/privatumo-politika', '/slapuku-politika',
  '/sitemap', '/cart', '/checkout', '/my-account', '/wp-',
]);

function isAntejaTestUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('anteja')) return false;
    if (u.hash || u.search) return false;
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) return false;
    const slug = '/' + segments[0];
    for (const excl of ANTEJA_EXCLUDE) {
      if (slug.startsWith(excl)) return false;
    }
    return true;
  } catch { return false; }
}

async function main() {
  const [labRow] = await sql<{ id: number }>(`SELECT id FROM labs WHERE slug = 'anteja'`);
  const labId = labRow.id;

  const dbUrls = await sql<{ url: string }>(
    `SELECT DISTINCT p.lab_test_url AS url FROM prices p WHERE p.lab_id = ${labId} AND p.lab_test_url IS NOT NULL AND p.is_stale = false`
  );
  const dbUrlSet = new Set(dbUrls.map(r => r.url.replace(/\/$/, '').toLowerCase()));
  console.log(`DB: ${dbUrls.length} Anteja prices with lab_test_url`);

  console.log('Calling Firecrawl mapUrl for Anteja...');
  const mapResult: any = await (firecrawl as any).v1.mapUrl('https://anteja.lt', { limit: 2000 });
  const allUrls: string[] = mapResult.links ?? mapResult.urls ?? [];
  console.log(`Firecrawl returned ${allUrls.length} total URLs`);

  const testUrls = allUrls.filter(isAntejaTestUrl);
  console.log(`After filtering (1-segment, non-nav): ${testUrls.length} candidate test URLs`);

  const inDb   = testUrls.filter(u => dbUrlSet.has(u.replace(/\/$/, '').toLowerCase()));
  const missing = testUrls.filter(u => !dbUrlSet.has(u.replace(/\/$/, '').toLowerCase()));

  console.log(`\nAnteja coverage:`);
  console.log(`  In DB:   ${inDb.length} / ${testUrls.length} (${testUrls.length > 0 ? Math.round(inDb.length / testUrls.length * 100) : 0}%)`);
  console.log(`  Missing: ${missing.length}`);

  console.log('\nFirst 20 passing URLs (sanity check):');
  testUrls.slice(0, 20).forEach(u => console.log('  ' + u));

  if (missing.length > 0) {
    console.log(`\nFirst 40 missing:`);
    missing.slice(0, 40).forEach(u => console.log('  ' + u));
    if (missing.length > 40) console.log(`  ... and ${missing.length - 40} more`);
  }
}

main().catch(console.error);
