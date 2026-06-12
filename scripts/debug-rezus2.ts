import { fetchPage } from '../scrapers/lib/firecrawl';
import { parseDeterministic } from '../scrapers/lib/parse';

async function main() {
  const rezus = await fetchPage('https://rezus.lt/visi-tyrimai');
  const parsed = parseDeterministic(rezus, 'rezus')!;
  const parsedNames = new Set(parsed.map(t => t.name));
  
  const lines = rezus.split('\n');
  let missed = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const priceMatch = line.match(/^([\d]+[,.][\d]+)€$/);
    if (!priceMatch) continue;
    
    // Check what link came before this price
    for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
      const l = lines[j].trim();
      if (l.includes('krepšelį') || l.includes('Plačiau')) break;
      const linkMatch = l.match(/\[([^\]]+)\]/);
      if (linkMatch) {
        const name = linkMatch[1].replace(/\*\*Prekės kodas:\*\*.*/, '').replace(/\s*\\\s*$/, '').trim();
        if (!parsedNames.has(name) && name.length > 5) {
          missed++;
          if (missed <= 10) console.log(`MISSED: "${name}" → ${priceMatch[1]}€`);
          const ctx = lines.slice(Math.max(0, j-1), i+2).join('\n');
          if (missed <= 3) console.log('Context:\n' + ctx + '\n---');
        }
        break;
      }
    }
  }
  console.log(`Total still missed: ${missed}`);
}
main().catch(console.error);
