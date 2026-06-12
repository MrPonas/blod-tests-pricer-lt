import { fetchPage } from '../scrapers/lib/firecrawl';
import { parseDeterministic } from '../scrapers/lib/parse';

async function main() {
  console.log('--- Anteja ---');
  const anteja = await fetchPage('https://anteja.lt/tyrimai/kraujo-tyrimai/bendrieji-kraujo-tyrimai');
  const antejaTests = parseDeterministic(anteja, 'anteja');
  console.log(`Parsed: ${antejaTests?.length} tests`);
  console.log('Sample:', antejaTests?.slice(0, 3));

  console.log('\n--- Rezus ---');
  const rezus = await fetchPage('https://rezus.lt/visi-tyrimai');
  const rezusTests = parseDeterministic(rezus, 'rezus');
  console.log(`Parsed: ${rezusTests?.length} tests`);
  console.log('Sample:', rezusTests?.slice(0, 3));
}
main().catch(console.error);
