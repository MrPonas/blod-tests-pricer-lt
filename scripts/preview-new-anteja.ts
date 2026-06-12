import { fetchPage } from '../scrapers/lib/firecrawl';
import { parseDeterministic } from '../scrapers/lib/parse';

const URLS = [
  'https://anteja.lt/tyrimai/kraujo-tyrimai/alergologiniai-tyrimai-ir-alergenu-programos',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/imunologiniai-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/inkstu-funkcijos-tyrimai',
];

async function main() {
  for (const url of URLS) {
    const md = await fetchPage(url);
    const tests = parseDeterministic(md, 'anteja');
    const slug = url.split('/').pop();
    console.log(`\n${slug}: ${tests?.length ?? 0} tests`);
    tests?.slice(0, 3).forEach(t => console.log(`  €${t.price_eur} – ${t.name}`));
    await new Promise(r => setTimeout(r, 1500));
  }
}
main().catch(console.error);
