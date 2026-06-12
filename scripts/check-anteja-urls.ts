import { fetchPage } from '../scrapers/lib/firecrawl';

const CANDIDATE_URLS = [
  'https://anteja.lt/tyrimai/kraujo-tyrimai/alergologiniai-tyrimai-ir-alergenu-programos',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/imunologiniai-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/koaguliacijos-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/narkotiku-ir-medikamentu-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/autoimuniniai-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/inkstu-funkcijos-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/cukraus-apykaitos-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/lipidu-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/anemijos-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/specifiniai-infekciniu-ligu-tyrimai',
];

async function main() {
  for (const url of CANDIDATE_URLS) {
    try {
      const md = await fetchPage(url);
      // Check if it has test data (numeric ID pattern)
      const hasTests = /^\d{3,6}$/m.test(md);
      const testCount = (md.match(/^\d{3,6}$/gm) || []).length;
      console.log(`✓ ${url.split('/').pop()} — ${testCount} tests`);
    } catch {
      console.log(`✗ ${url.split('/').pop()} — not found`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}
main().catch(console.error);
