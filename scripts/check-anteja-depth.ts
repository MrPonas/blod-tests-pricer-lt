import { fetchPage } from '../scrapers/lib/firecrawl';

const ZERO_PAGES = [
  'https://anteja.lt/tyrimai/kraujo-tyrimai/koaguliacijos-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/autoimuniniai-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/cukraus-apykaitos-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/lipidu-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/anemijos-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/alergologiniai-tyrimai-ir-alergenu-programos',
];

async function main() {
  for (const url of ZERO_PAGES) {
    const md = await fetchPage(url);
    // Look for sub-subcategory links
    const subLinks = [...md.matchAll(/\(https?:\/\/(?:www\.)?anteja\.lt\/tyrimai\/kraujo-tyrimai\/[a-z0-9-]+\/[a-z0-9-]+\)/g)]
      .map(m => m[0].slice(1, -1).replace('www.anteja.lt', 'anteja.lt'));
    const directTests = (md.match(/^\d{3,6}$/gm) || []).length;
    const slug = url.split('/').pop();
    if (subLinks.length > 0) {
      console.log(`${slug}: ${subLinks.length} sub-pages, ${directTests} direct tests`);
      subLinks.slice(0, 5).forEach(l => console.log(`  → ${l}`));
    } else {
      console.log(`${slug}: ${directTests} tests, no sub-pages`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}
main().catch(console.error);
