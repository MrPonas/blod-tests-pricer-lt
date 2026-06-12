import { chromium } from 'playwright';

const SLUGS = [
  'koaguliacijos-tyrimai',
  'narkotiku-ir-medikamentu-tyrimai',
  'autoimuniniai-tyrimai',
  'cukraus-apykaitos-tyrimai',
  'lipidu-tyrimai',
  'anemijos-tyrimai',
  'specifiniai-infekciniu-ligu-tyrimai',
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 700 });

  for (const slug of SLUGS) {
    const url = `https://anteja.lt/tyrimai/kraujo-tyrimai/${slug}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.screenshot({
      path: `test-results/anteja-${slug}.png`,
      clip: { x: 0, y: 0, width: 1280, height: 700 },
    });
    const is404 = (await page.locator('text=nerastas').count()) > 0;
    const productCount = await page.locator('.product-layout, .product-list').count();
    console.log(`${slug}: 404=${is404} products=${productCount}`);
  }

  await browser.close();
}
main().catch(console.error);
