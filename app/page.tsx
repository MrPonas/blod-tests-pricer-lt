import { getCategories, getLabs, getAllTests } from '@/lib/db';
import HomeClient, { type TestUI, type LabUI, type CategoryUI } from './components/HomeClient';
import { getDisplayName, isProcedure } from '@/lib/utils';

export const revalidate = 86400;

const SAMPLING_FEES: Record<string, number> = {
  anteja: 2.50, synlab: 3.00, affidea: 2.80, meliva: 2.20, rezus: 2.00,
};

const LAB_COLORS: Record<string, string> = {
  anteja: '#059669', synlab: '#2563eb', affidea: '#6366f1', meliva: '#0d9488', rezus: '#0284c7',
};

const LAB_DESCRIPTIONS: Record<string, string> = {
  anteja: 'Viena didžiausių laboratorijų Lietuvoje su daugiau nei 30 metų patirtimi.',
  synlab: 'Tarptautinė Vokietijos kapitalo laboratorija, veikianti daugiau nei 40 šalių.',
  affidea: 'Modernus diagnostikos centras su plačia tyrimų ir vaizdinės diagnostikos paslauga.',
  meliva: 'Kokybiškas medicinos centras su aukštos klasės laboratorinės diagnostikos paslaugomis.',
  rezus: 'Greitai augantis laboratorijų tinklas, siūlantis konkurencingas kainas visoje Lietuvoje.',
};

function makeCode(nameLt: string, nameEn: string | null): string {
  if (nameEn) {
    const caps = nameEn.replace(/[^A-Z]/g, '');
    if (caps.length >= 2 && caps.length <= 6) return caps;
  }
  const words = nameLt.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 3).map(w => w[0]?.toUpperCase() ?? '').join('');
  return nameLt.slice(0, 3).toUpperCase();
}

export default async function HomePage() {
  let labs: Awaited<ReturnType<typeof getLabs>> = [];
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  let allTests: Awaited<ReturnType<typeof getAllTests>> = [];

  try {
    [labs, categories, allTests] = await Promise.all([getLabs(), getCategories(), getAllTests()]);
  } catch {
    // DB not yet seeded
  }

  const labsUI: LabUI[] = labs.map(lab => ({
    id: lab.slug,
    name: lab.name,
    samplingFee: SAMPLING_FEES[lab.slug] ?? 2.50,
    bookingUrl: lab.booking_url,
    description: LAB_DESCRIPTIONS[lab.slug] ?? '',
    color: LAB_COLORS[lab.slug] ?? '#8a8a82',
  }));

  // Count tests per category slug so we can filter to those with meaningful content
  const testCountByCategory: Record<string, number> = {};
  for (const test of allTests) {
    const slug = test.category?.slug ?? 'kita';
    testCountByCategory[slug] = (testCountByCategory[slug] ?? 0) + 1;
  }

  const categoriesUI: CategoryUI[] = [
    { id: 'all', name: 'Visi tyrimai' },
    ...categories
      .filter(c => (testCountByCategory[c.slug] ?? 0) >= 5)
      .map(c => ({ id: c.slug, name: c.name_lt, icon: c.icon })),
  ];

  const testsUI: TestUI[] = allTests.filter(test => !isProcedure(test.canonical_name_lt)).map(test => {
    const prices: Record<string, number> = {};
    const bookingUrls: Record<string, string | null> = {};

    // Stale prices first, then overwrite with fresh — fresh wins
    for (const p of test.prices) {
      if (!p.lab?.slug || Number(p.price_eur) <= 0) continue;
      prices[p.lab.slug] = Number(p.price_eur);
      bookingUrls[p.lab.slug] = p.lab_test_url ?? null;
    }
    for (const p of test.prices) {
      if (!p.lab?.slug || p.is_stale || Number(p.price_eur) <= 0) continue;
      prices[p.lab.slug] = Number(p.price_eur);
      bookingUrls[p.lab.slug] = p.lab_test_url ?? null;
    }

    const isStale = test.prices.length > 0 && test.prices.every(p => p.is_stale);
    const latestDate = test.prices.map(p => p.scraped_at).filter(Boolean).sort().at(-1);
    const updateDate = latestDate ? new Date(latestDate).toLocaleDateString('lt-LT') : '';

    return {
      id: String(test.id),
      name: getDisplayName(test.canonical_name_lt, test.aliases),
      latinName: test.canonical_name_en,
      code: makeCode(test.canonical_name_lt, test.canonical_name_en),
      category: test.category?.slug ?? 'kita',
      prices,
      bookingUrls,
      isStale,
      updateDate,
    };
  });

  const totalTests = allTests.length;
  const latestScraped = allTests
    .flatMap(t => t.prices.map(p => p.scraped_at))
    .filter(Boolean)
    .sort()
    .at(-1);
  const lastUpdated = latestScraped ? new Date(latestScraped).toLocaleDateString('lt-LT') : '';

  return (
    <HomeClient
      tests={testsUI}
      labs={labsUI}
      categories={categoriesUI}
      totalTests={totalTests}
      lastUpdated={lastUpdated}
    />
  );
}
