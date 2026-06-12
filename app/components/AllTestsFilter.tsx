'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { TestWithPrices, Category } from '@/lib/types';
import { useSearchIndex, type SearchEntry } from '@/app/hooks/useSearchIndex';

interface Props {
  tests: TestWithPrices[];
  categories: Category[];
}

export default function AllTestsFilter({ tests, categories }: Props) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { search, ready } = useSearchIndex();

  const searchResults = useMemo<SearchEntry[]>(() => {
    if (!query.trim() || !ready) return [];
    const results = search(query.trim(), 200);
    return activeCategory ? results.filter(r => r.category === activeCategory) : results;
  }, [query, ready, search, activeCategory]);

  const filteredByCategory = useMemo(() => {
    return activeCategory ? tests.filter(t => t.category?.slug === activeCategory) : tests;
  }, [tests, activeCategory]);

  const showGrouped = !query.trim();

  const byLetter = useMemo(() => {
    const map: Record<string, typeof filteredByCategory> = {};
    filteredByCategory.forEach((t) => {
      const letter = t.canonical_name_lt[0].toUpperCase();
      if (!map[letter]) map[letter] = [];
      map[letter].push(t);
    });
    return map;
  }, [filteredByCategory]);

  const letters = Object.keys(byLetter).sort();

  const totalWithPrices = tests.filter((t) =>
    t.prices.some((p) => !p.is_stale && Number(p.price_eur) > 0)
  ).length;

  const displayCount = query.trim() ? searchResults.length : filteredByCategory.length;

  return (
    <>
      {/* Search + category filters */}
      <div className="mb-6 space-y-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ieškoti sąraše..."
          aria-label="Ieškoti tyrimo"
          className="w-full sm:w-80 px-4 py-2 rounded-none border border-[#e5e5e0] bg-[#f4f4f0] text-sm text-[#1a1a1a] placeholder-[#8a8a82] focus:outline-none focus:border-[#1a1a1a] focus:bg-white"
        />

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1 rounded-none font-mono text-[11px] font-bold uppercase tracking-widest border transition-colors ${
                activeCategory === null
                  ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white'
                  : 'border-[#e5e5e0] bg-[#f4f4f0] text-[#8a8a82] hover:border-[#1a1a1a] hover:text-[#1a1a1a]'
              }`}
            >
              Visi
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug === activeCategory ? null : cat.slug)}
                className={`px-3 py-1 rounded-none font-mono text-[11px] font-bold uppercase tracking-widest border transition-colors ${
                  activeCategory === cat.slug
                    ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white'
                    : 'border-[#e5e5e0] bg-[#f4f4f0] text-[#8a8a82] hover:border-[#1a1a1a] hover:text-[#1a1a1a]'
                }`}
              >
                {cat.icon} {cat.name_lt}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="font-mono text-[11px] text-[#8a8a82] uppercase tracking-wider mb-4">
        {displayCount !== tests.length
          ? `${displayCount} iš ${tests.length} tyrimų`
          : `${tests.length} tyrimų · ${totalWithPrices} su kainomis`
        }
      </p>

      {displayCount === 0 ? (
        <div className="text-center py-14 text-[#8a8a82]">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-sm text-[#1a1a1a]">Nerasta tyrimų pagal paiešką</p>
        </div>
      ) : !showGrouped ? (
        <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] divide-y divide-[#e5e5e0]">
          {searchResults.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <Link href={`/test/${entry.id}`} className="text-sm text-[#1a1a1a] hover:text-[#8a8a82] transition-colors">
                  {entry.name_lt}
                </Link>
                {entry.name_en && (
                  <span className="ml-2 font-mono text-[10px] text-[#8a8a82]">{entry.name_en}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {entry.category && (
                  <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-[#8a8a82] bg-[#f4f4f0] border border-[#e5e5e0] px-2 py-0.5">
                    {entry.category}
                  </span>
                )}
                {entry.lab_count >= 2 && (
                  <span className="font-mono text-[10px] text-[#8a8a82] tabular-nums">{entry.lab_count} lab.</span>
                )}
                {entry.min_price !== null ? (
                  <span className="font-mono font-bold text-[#059669] tabular-nums w-16 text-right text-sm">
                    €{entry.min_price.toFixed(2)}
                  </span>
                ) : (
                  <span className="font-mono text-[#8a8a82] w-16 text-right text-xs">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Letter index */}
          <div className="flex flex-wrap gap-1.5 mb-8">
            {letters.map((letter) => (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="w-8 h-8 flex items-center justify-center rounded-none border border-[#e5e5e0] bg-[#f4f4f0] font-mono font-bold text-[11px] text-[#8a8a82] hover:border-[#1a1a1a] hover:text-[#1a1a1a] transition-colors"
              >
                {letter}
              </a>
            ))}
          </div>

          <div className="space-y-8">
            {letters.map((letter) => (
              <div key={letter} id={`letter-${letter}`}>
                <div className="sticky top-14 bg-[#fdfdfc] py-1.5 mb-2 border-b border-[#e5e5e0]">
                  <span className="font-mono font-bold text-[#8a8a82] uppercase text-[11px] tracking-widest">{letter}</span>
                </div>
                <TestRows tests={byLetter[letter]} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function TestRows({ tests }: { tests: TestWithPrices[] }) {
  return (
    <div className="divide-y divide-[#e5e5e0]">
      {tests.map((test) => {
        const activePrices = test.prices.filter((p) => !p.is_stale && Number(p.price_eur) > 0);
        const minPrice = activePrices.length > 0
          ? Math.min(...activePrices.map((p) => Number(p.price_eur)))
          : null;
        return (
          <div key={test.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <Link href={`/test/${test.id}`} className="text-sm text-[#1a1a1a] hover:text-[#8a8a82] transition-colors">
                {test.canonical_name_lt}
              </Link>
              {test.canonical_name_en && (
                <span className="ml-2 font-mono text-[10px] text-[#8a8a82]">{test.canonical_name_en}</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {test.category && (
                <Link
                  href={`/category/${test.category.slug}`}
                  className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-[#8a8a82] hover:text-[#1a1a1a] bg-[#f4f4f0] border border-[#e5e5e0] hover:border-[#1a1a1a] px-2 py-0.5"
                >
                  {test.category.icon} {test.category.name_lt}
                </Link>
              )}
              {activePrices.length >= 2 && (
                <span className="font-mono text-[10px] text-[#8a8a82] tabular-nums">{activePrices.length} lab.</span>
              )}
              {minPrice !== null ? (
                <span className="font-mono font-bold text-[#059669] tabular-nums w-16 text-right text-sm">
                  €{minPrice.toFixed(2)}
                </span>
              ) : (
                <span className="font-mono text-[#8a8a82] w-16 text-right text-xs">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
