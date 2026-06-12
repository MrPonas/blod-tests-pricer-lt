import { fetchPage } from '../scrapers/lib/firecrawl';
import fs from 'fs';

async function main() {
  const rezus = await fetchPage('https://rezus.lt/visi-tyrimai');
  
  // Find price lines that don't have a **Prekės kodas:** before them
  const lines = rezus.split('\n');
  let missed = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const priceMatch = line.match(/^([\d]+[,.][\d]+)€$/);
    if (!priceMatch) continue;
    
    // Look back for Prekės kodas
    let hasPrekesKodas = false;
    for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
      if (lines[j].includes('Prekės kodas')) { hasPrekesKodas = true; break; }
    }
    
    if (!hasPrekesKodas) {
      missed++;
      // Print context
      const start = Math.max(0, i - 5);
      const ctx = lines.slice(start, i + 2).map((l, idx) => `${start+idx}: ${l}`).join('\n');
      if (missed <= 5) console.log(`\n=== MISSED #${missed} ===\n${ctx}`);
    }
  }
  console.log(`\nTotal missed price entries: ${missed}`);
}
main().catch(console.error);
