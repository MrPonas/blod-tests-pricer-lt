/**
 * Discovers all Anteja blood test subcategory URLs without using Claude.
 * Fetches the parent category page and extracts all subcategory links.
 */
import { fetchPage } from '../scrapers/lib/firecrawl';

const KNOWN_URLS = new Set([
  'https://anteja.lt/tyrimai/kraujo-tyrimai/bendrieji-kraujo-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/skydliaukes-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/kepenu-funkcijos-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/prostatos-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/hormonu-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/lytiskai-plintancios-ligos',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/vezio-zymenys',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/sirdies-ir-kraujagysliu-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/vitaminu-tyrimai',
  'https://anteja.lt/tyrimai/kraujo-tyrimai/elektrolitu-ir-mikroelementu-tyrimai',
]);

async function main() {
  console.log('Fetching Anteja blood test category page...');
  const md = await fetchPage('https://anteja.lt/tyrimai/kraujo-tyrimai');

  // Extract all links matching /tyrimai/kraujo-tyrimai/<slug>
  const re = /\((https?:\/\/(?:www\.)?anteja\.lt\/tyrimai\/kraujo-tyrimai\/[a-z0-9-]+)\)/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const url = m[1].replace('www.anteja.lt', 'anteja.lt');
    // Only subcategory pages (not the parent itself)
    if (url !== 'https://anteja.lt/tyrimai/kraujo-tyrimai') {
      found.add(url);
    }
  }

  console.log(`\nFound ${found.size} subcategory URLs total:`);
  const missing: string[] = [];
  for (const url of [...found].sort()) {
    const isKnown = KNOWN_URLS.has(url);
    console.log(`  ${isKnown ? '✓' : '+ NEW'} ${url}`);
    if (!isKnown) missing.push(url);
  }

  if (missing.length === 0) {
    console.log('\nAll subcategories already covered!');
  } else {
    console.log(`\n${missing.length} NEW subcategories to add to labs.ts:`);
    missing.forEach(u => console.log(`  '${u}',`));
  }

  // Also check the info page the user linked
  console.log('\nChecking informacija page for additional categories...');
  const infoMd = await fetchPage('https://www.anteja.lt/informacija-apie-tyrimu-atlikimo-eiga');
  const infoRe = /\((https?:\/\/(?:www\.)?anteja\.lt\/tyrimai\/kraujo-tyrimai\/[a-z0-9-]+)\)/g;
  const infoFound = new Set<string>();
  let m2: RegExpExecArray | null;
  while ((m2 = infoRe.exec(infoMd)) !== null) {
    const url = m2[1].replace('www.anteja.lt', 'anteja.lt');
    if (!found.has(url) && url !== 'https://anteja.lt/tyrimai/kraujo-tyrimai') {
      infoFound.add(url);
    }
  }
  if (infoFound.size > 0) {
    console.log(`Found ${infoFound.size} additional URLs from info page:`);
    infoFound.forEach(u => console.log(`  + ${u}`));
  } else {
    console.log('No additional URLs from info page.');
  }
}

main().catch(console.error);
