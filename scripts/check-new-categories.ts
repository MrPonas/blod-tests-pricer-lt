import { fetchPage } from '../scrapers/lib/firecrawl';
import { parseDeterministic } from '../scrapers/lib/parse';

const NEW_SLUGS = [
  'biocheminiai-tyrimai',
  'celiakijos-tyrimai',
  'covid-19-tyrimai',
  'erkiu-pernesamu-ligu-tyrimai',
  'genetiniai-tyrimai',
  'gliukozes-tyrimai',
  'hepatitu-zymenu-tyrimai',
  'infekciju-tyrimai',
  'jautrumo-maistui-tyrimai',
  'kasos-funkcijos-tyrimai',
  'kraujo-kresejimo-tyrimai',
  'kvepavimo-taku-infekcijos',
  'mazakraujystes-tyrimai',
  'nipt-tyrimai',
  'riebalu-apykaitos-tyrimai',
  'virusiniu-ligu-tyrimai',
  'ziv-tyrimai',
];

async function main() {
  for (const slug of NEW_SLUGS) {
    const url = `https://anteja.lt/tyrimai/kraujo-tyrimai/${slug}`;
    try {
      const md = await fetchPage(url);
      const tests = parseDeterministic(md, 'anteja') ?? [];
      const is404 = md.includes('nerastas') && md.length < 2000;
      if (is404) {
        console.log(`✗ ${slug}`);
      } else {
        console.log(`✓ ${slug}: ${tests.length} tests${tests.length > 0 ? ' — e.g. ' + tests[0].name.substring(0, 40) : ''}`);
      }
    } catch {
      console.log(`✗ ${slug} (error)`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}
main().catch(console.error);
