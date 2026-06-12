import { fetchPage } from '../scrapers/lib/firecrawl';
import fs from 'fs';

async function main() {
  console.log('Fetching Anteja...');
  const anteja = await fetchPage('https://anteja.lt/tyrimai/kraujo-tyrimai/bendrieji-kraujo-tyrimai');
  fs.writeFileSync('/tmp/anteja-sample.md', anteja.substring(0, 4000));
  
  console.log('Fetching Rezus...');
  const rezus = await fetchPage('https://rezus.lt/visi-tyrimai');
  fs.writeFileSync('/tmp/rezus-sample.md', rezus.substring(0, 4000));
  
  console.log('Done');
}
main().catch(console.error);
