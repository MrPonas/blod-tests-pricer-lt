import { searchTests, getLabs, getCategories } from '@/lib/db';
import Link from 'next/link';
import SearchBar from '../components/SearchBar';
import SortableTestList from '../components/SortableTestList';
import type { SortKey } from '../components/FilterBar';

interface PageProps {
  searchParams: Promise<{ q?: string; labs?: string; sort?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q, labs: labsParam, sort: sortParam } = await searchParams;
  const query = q?.trim() ?? '';

  const initialLabs = labsParam ? labsParam.split(',').filter(Boolean) : [];
  const initialSort: SortKey =
    sortParam === 'price_desc' ? 'price_desc' : sortParam === 'name_asc' ? 'name_asc' : 'price_asc';

  const [tests, labs, categories] = await Promise.all([
    query ? searchTests(query) : Promise.resolve([]),
    getLabs(),
    query ? Promise.resolve([]) : getCategories(),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <SearchBar initialValue={query} />
      </div>

      {query ? (
        <>
          {tests.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">🔍</p>
              <p className="text-[#1a1a1a] font-medium mb-1">
                Nerasta tyrimų pagal „{query}"
              </p>
              <p className="font-mono text-[11px] text-[#8a8a82] uppercase tracking-wider mb-6">Patikrinkite rašybą arba bandykite kitą pavadinimą</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href="/tests"
                  className="px-4 py-2 rounded-none border border-[#e5e5e0] bg-[#f4f4f0] font-mono text-[11px] uppercase tracking-wider text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
                >
                  Visi tyrimai →
                </Link>
                <Link
                  href="/"
                  className="px-4 py-2 rounded-none border border-[#e5e5e0] bg-[#f4f4f0] font-mono text-[11px] uppercase tracking-wider text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
                >
                  Grįžti į pradžią
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="font-mono text-[11px] text-[#8a8a82] uppercase tracking-wider mb-5">
                {tests.length} tyrima{tests.length === 1 ? 's' : tests.length < 10 ? 'i' : 'ų'} pagal „{query}"
              </p>
              <SortableTestList
                tests={tests}
                labs={labs}
                initialLabs={initialLabs}
                initialSort={initialSort}
                preserveParams={{ q: query }}
              />
            </>
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">🔬</p>
          <p className="text-[#8a8a82] mb-8 text-sm">Įveskite tyrimo pavadinimą paieškos laukelyje</p>
          {categories.length > 0 && (
            <div>
              <p className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#8a8a82] mb-3">Arba naršykite kategorijas</p>
              <div className="flex flex-wrap justify-center gap-2">
                {categories.slice(0, 6).map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    className="px-4 py-2 rounded-none border border-[#e5e5e0] bg-[#f4f4f0] font-mono text-[11px] uppercase tracking-wider text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
                  >
                    {cat.icon} {cat.name_lt}
                  </Link>
                ))}
                <Link
                  href="/tests"
                  className="px-4 py-2 rounded-none border border-[#e5e5e0] bg-[#f4f4f0] font-mono text-[11px] uppercase tracking-wider text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
                >
                  Visi tyrimai →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
