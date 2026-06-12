import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { labs as labConfigs } from './config/labs';
import { fetchPage } from './lib/firecrawl';
import { extractPrices } from './lib/extract';
import { parseDeterministic } from './lib/parse';
import { mapAndUpsertTests } from './lib/mapper';
import {
  getLabId, insertScrapeRun, updateScrapeRun, markLabPricesStale,
} from './lib/db';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrapeLab(labConfig: (typeof labConfigs)[0]) {
  console.log(`\n=== ${labConfig.name} ===`);

  const labId = await getLabId(labConfig.slug);
  if (!labId) { console.error(`Lab not found in DB: ${labConfig.slug}`); return; }

  const runId = await insertScrapeRun(labId);

  try {
    const urls = [labConfig.priceListUrl, ...(labConfig.additionalUrls ?? [])];
    let allExtracted: Awaited<ReturnType<typeof extractPrices>> = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (i > 0) await sleep(3000 + Math.random() * 2000);
      console.log(`Fetching ${url}`);
      const markdown = await fetchPage(url);
      console.log(`Got ${markdown.length} chars`);
      let extracted = parseDeterministic(markdown, labConfig.slug);
      if (extracted !== null && extracted.length > 0) {
        console.log(`Parsed ${extracted.length} tests (deterministic)`);
      } else {
        if (extracted !== null) console.warn(`Deterministic parser returned 0 results, falling back to Claude`);
        extracted = await extractPrices(markdown, labConfig.slug);
        console.log(`Extracted ${extracted.length} tests (Claude)`);
      }
      allExtracted = [...allExtracted, ...extracted];
    }

    await markLabPricesStale(labId);

    const { matched, queued } = await mapAndUpsertTests(
      allExtracted,
      { id: labId, name: labConfig.name, slug: labConfig.slug }
    );

    await updateScrapeRun(runId, {
      status: 'success',
      testsUpdated: matched,
    });

    console.log(`Done: ${matched} matched, ${queued} queued for mapping`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed: ${msg}`);
    await updateScrapeRun(runId, { status: 'failed', errorMessage: msg });
  }
}

async function main() {
  console.log('Starting scrape run...');
  for (const lab of labConfigs) {
    await scrapeLab(lab);
    await sleep(3000);
  }
  console.log('\nAll done.');
}

main().catch(console.error);
