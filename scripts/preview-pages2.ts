import { fetchPage } from '../scrapers/lib/firecrawl';
import fs from 'fs';

async function main() {
  console.log('Fetching Anteja...');
  const anteja = await fetchPage('https://anteja.lt/tyrimai/kraujo-tyrimai/bendrieji-kraujo-tyrimai');
  // Skip the cookie section, grab after it
  const antejaIdx = anteja.indexOf('Tyrimų');
  fs.writeFileSync('/tmp/anteja-tests.md', anteja.substring(antejaIdx, antejaIdx + 3000));
  
  console.log('Fetching Rezus...');
  const rezus = await fetchPage('https://rezus.lt/visi-tyrimai');
  // Find where actual tests start
  const rezusIdx = rezus.indexOf('€');
  fs.writeFileSync('/tmp/rezus-tests.md', rezus.substring(Math.max(0, rezusIdx - 200), rezusIdx + 3000));
  
  console.log('Done');
  console.log('Anteja test section starts at:', antejaIdx);
  console.log('Rezus first price at:', rezusIdx);
}
main().catch(console.error);
