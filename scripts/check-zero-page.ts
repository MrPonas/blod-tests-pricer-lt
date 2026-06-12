import { fetchPage } from '../scrapers/lib/firecrawl';

async function main() {
  const md = await fetchPage('https://anteja.lt/tyrimai/kraujo-tyrimai/koaguliacijos-tyrimai');
  // Find the section after cookie consent
  const idx = Math.max(md.indexOf('Tyrimų'), md.indexOf('€'), md.indexOf('krepšelį'));
  if (idx > 0) {
    console.log('Content after cookie section:\n');
    console.log(md.substring(idx, idx + 2000));
  } else {
    console.log('Total chars:', md.length);
    console.log('Last 1000 chars:', md.slice(-1000));
  }
}
main().catch(console.error);
