import Link from 'next/link';
import { getCategories, getLabs, getAllTests } from '@/lib/db';
import SearchBar from './components/SearchBar';

export const revalidate = 3600;

const LAB_COLORS: Record<string, string> = {
  synlab:  'bg-blue-50  border-blue-200  text-blue-700',
  anteja:  'bg-teal-50  border-teal-200  text-teal-700',
  affidea: 'bg-purple-50 border-purple-200 text-purple-700',
  meliva:  'bg-orange-50 border-orange-200 text-orange-700',
  rezus:   'bg-rose-50  border-rose-200  text-rose-700',
};

export default async function HomePage() {
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  let labs: Awaited<ReturnType<typeof getLabs>> = [];
  let allTests: Awaited<ReturnType<typeof getAllTests>> = [];

  try {
    [categories, labs, allTests] = await Promise.all([getCategories(), getLabs(), getAllTests()]);
  } catch {
    // DB not yet seeded
  }

  const totalTests = allTests.length;
  const testsWithPrices = allTests.filter((t) =>
    t.prices.some((p) => !p.is_stale && Number(p.price_eur) > 0)
  ).length;

  // Popular tests: most lab coverage (highest number of active prices)
  const popular = [...allTests]
    .map((t) => ({
      ...t,
      activeCount: t.prices.filter((p) => !p.is_stale && Number(p.price_eur) > 0).length,
      minPrice: Math.min(
        ...t.prices.filter((p) => !p.is_stale && Number(p.price_eur) > 0).map((p) => Number(p.price_eur)),
        Infinity
      ),
    }))
    .filter((t) => t.activeCount >= 2)
    .sort((a, b) => b.activeCount - a.activeCount || a.minPrice - b.minPrice)
    .slice(0, 6);

  // Min price per category
  const categoryMinPrices = new Map<number, number>();
  allTests.forEach((t) => {
    if (!t.category_id) return;
    const prices = t.prices.filter((p) => !p.is_stale && Number(p.price_eur) > 0).map((p) => Number(p.price_eur));
    if (prices.length === 0) return;
    const min = Math.min(...prices);
    const existing = categoryMinPrices.get(t.category_id);
    if (existing === undefined || min < existing) categoryMinPrices.set(t.category_id, min);
  });

  return (
    <div>
      {/* Hero */}
      <section className="bg-white border-b border-gray-200 py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            Palyginkite kraujo tyrimų kainas
          </h1>
          <p className="text-gray-500 mb-8 text-sm sm:text-base">
            Ieškokite tyrimo ir iškart pamatykite kainas visose laboratorijose — vienoje vietoje
          </p>
          <SearchBar />

          {/* Stats */}
          {labs.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
                <span className="text-green-500 font-bold">✓</span>
                {labs.length} laboratorijos
              </span>
              {totalTests > 0 && (
                <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
                  <span className="text-blue-500 font-bold">🔬</span>
                  {testsWithPrices}+ tyrimų su kainomis
                </span>
              )}
              <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
                <span className="text-orange-500 font-bold">↻</span>
                Atnaujinama kasdien
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Popular tests */}
      {popular.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 pt-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Populiariausi tyrimai
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {popular.map((test) => (
              <Link
                key={test.id}
                href={`/test/${test.id}`}
                className="flex items-center justify-between gap-2 px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <span className="text-sm text-gray-700 group-hover:text-blue-700 transition-colors leading-snug truncate">
                  {test.canonical_name_lt}
                </span>
                {test.minPrice < Infinity && (
                  <span className="text-sm font-bold text-green-700 tabular-nums shrink-0">
                    €{test.minPrice.toFixed(2)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
          Naršyti pagal kategoriją
        </h2>
        {categories.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {categories.map((cat) => {
                const minPrice = categoryMinPrices.get(cat.id);
                return (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    className="flex flex-col items-center gap-2 p-5 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-center group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                    <span className="text-sm font-medium text-gray-800 leading-tight">{cat.name_lt}</span>
                    {minPrice !== undefined && (
                      <span className="text-xs text-green-600 font-medium">nuo €{minPrice.toFixed(2)}</span>
                    )}
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 text-center">
              <Link href="/tests" className="text-sm text-blue-600 hover:text-blue-800 transition-colors">
                Peržiūrėti visų tyrimų sąrašą →
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-400 text-sm">
            <p>Kategorijos bus rodomos po pirmojo scrape paleidimo.</p>
            <p className="mt-1">Pirma įvykdykite SQL schemą Supabase dashboard.</p>
          </div>
        )}
      </section>

      {/* Labs */}
      {labs.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Kainų duomenys iš
          </h2>
          <div className="flex flex-wrap gap-2">
            {labs.map((lab) => {
              const colorClass = LAB_COLORS[lab.slug] ?? 'bg-gray-50 border-gray-200 text-gray-600';
              return (
                <span
                  key={lab.id}
                  className={`px-4 py-2 border rounded-full text-sm font-medium ${colorClass}`}
                >
                  {lab.name}
                </span>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
