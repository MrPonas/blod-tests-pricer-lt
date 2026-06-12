/**
 * Discovers all Anteja blood test subcategory URLs using a real browser.
 * Run periodically to detect new categories added by Anteja.
 * Usage: npx tsx scripts/discover-anteja-browser.ts
 */
import { chromium } from 'playwright';
import { labs } from '../scrapers/config/labs';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://anteja.lt/tyrimai/kraujo-tyrimai', { waitUntil: 'networkidle', timeout: 20000 });
  await page.locator('button:has-text("Leisti visus"), button:has-text("Sutikti")').first().click().catch(() => {});
  await page.waitForTimeout(500);

  const found: string[] = await page.$$eval('a[href*="/tyrimai/kraujo-tyrimai/"]', (els) =>
    [...new Set(els.map((el) => (el as HTMLAnchorElement).href))]
      .filter((href) => href.match(/\/tyrimai\/kraujo-tyrimai\/[a-z0-9-]+\/?$/))
      .map((href) => href.replace(/\/$/, '').replace('www.anteja.lt', 'anteja.lt'))
      .sort()
  );

  await browser.close();

  const anteja = labs.find((l) => l.slug === 'anteja')!;
  const configured = new Set([anteja.priceListUrl, ...(anteja.additionalUrls ?? [])]);

  const newUrls = found.filter((u) => !configured.has(u));
  const removedUrls = [...configured].filter((u) => !found.includes(u));

  if (newUrls.length === 0 && removedUrls.length === 0) {
    console.log(`All ${found.length} categories already configured. Nothing to update.`);
  } else {
    if (newUrls.length > 0) {
      console.log(`\n+++ ${newUrls.length} NEW categories found (add to labs.ts):`);
      newUrls.forEach((u) => console.log(`  '${u}',`));
    }
    if (removedUrls.length > 0) {
      console.log(`\n--- ${removedUrls.length} categories no longer on site:`);
      removedUrls.forEach((u) => console.log(`  ${u}`));
    }
  }
}
main().catch(console.error);
