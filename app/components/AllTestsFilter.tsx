'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { TestWithPrices, Category } from '@/lib/types';

interface Props {
  tests: TestWithPrices[];
  categories: Category[];
}

export default function AllTestsFilter({ tests, categories }: Props) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = tests;
    if (activeCategory) {
      result = result.filter((t) => t.category?.slug === activeCategory);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.canonical_name_lt.toLowerCase().includes(q) ||
          (t.canonical_name_en ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [tests, query, activeCategory]);

  // Group by first letter only when not filtering by text
  const showGrouped = !query.trim();

  const byLetter = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    filtered.forEach((t) => {
      const letter = t.canonical_name_lt[0].toUpperCase();
      if (!map[letter]) map[letter] = [];
      map[letter].push(t);
    });
    return map;
  }, [filtered]);

  const letters = Object.keys(byLetter).sort();

  const totalWithPrices = tests.filter((t) =>
    t.prices.some((p) => !p.is_stale && Number(p.price_eur) > 0)
  ).length;

  return (
    <>
      {/* Search + category filters */}
      <div className="mb-6 space-y-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ieškoti sąraše..."
          className="w-full sm:w-80 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
        />

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeCategory === null
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              Visi
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug === activeCategory ? null : cat.slug)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeCategory === cat.slug
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {cat.icon} {cat.name_lt}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-sm text-gray-400 mb-4">
        {filtered.length !== tests.length
          ? `${filtered.length} iš ${tests.length} tyrimų`
          : `${tests.length} tyrimų · ${totalWithPrices} su kainomis`
        }
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-sm">Nerasta tyrimų pagal paiešką</p>
        </div>
      ) : showGrouped ? (
        <>
          {/* Letter index */}
          <div className="flex flex-wrap gap-1.5 mb-8">
            {letters.map((letter) => (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                {letter}
              </a>
            ))}
          </div>

          <div className="space-y-8">
            {letters.map((letter) => (
              <div key={letter} id={`letter-${letter}`}>
                <div className="sticky top-14 bg-gray-50 py-1.5 mb-2 border-b border-gray-200">
                  <span className="text-sm font-bold text-gray-400 uppercase">{letter}</span>
                </div>
                <TestRows tests={byLetter[letter]} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {filtered.map((test) => {
            const activePrices = test.prices.filter((p) => !p.is_stale && Number(p.price_eur) > 0);
            const minPrice = activePrices.length > 0
              ? Math.min(...activePrices.map((p) => Number(p.price_eur)))
              : null;
            return (
              <div key={test.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/test/${test.id}`} className="text-sm text-gray-800 hover:text-blue-600 transition-colors">
                    {test.canonical_name_lt}
                  </Link>
                  {test.canonical_name_en && (
                    <span className="ml-2 text-xs text-gray-400">{test.canonical_name_en}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {test.category && (
                    <span className="hidden sm:inline text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {test.category.icon} {test.category.name_lt}
                    </span>
                  )}
                  {minPrice !== null ? (
                    <span className="text-sm font-semibold text-green-700 tabular-nums w-16 text-right">
                      €{minPrice.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300 w-16 text-right">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function TestRows({ tests }: { tests: TestWithPrices[] }) {
  return (
    <div className="divide-y divide-gray-100">
      {tests.map((test) => {
        const activePrices = test.prices.filter((p) => !p.is_stale && Number(p.price_eur) > 0);
        const minPrice = activePrices.length > 0
          ? Math.min(...activePrices.map((p) => Number(p.price_eur)))
          : null;
        return (
          <div key={test.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <Link href={`/test/${test.id}`} className="text-sm text-gray-800 hover:text-blue-600 transition-colors">
                {test.canonical_name_lt}
              </Link>
              {test.canonical_name_en && (
                <span className="ml-2 text-xs text-gray-400">{test.canonical_name_en}</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {test.category && (
                <Link
                  href={`/category/${test.category.slug}`}
                  className="hidden sm:inline text-xs text-gray-400 hover:text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full"
                >
                  {test.category.icon} {test.category.name_lt}
                </Link>
              )}
              {activePrices.length >= 2 && (
                <span className="text-xs text-gray-400 tabular-nums">{activePrices.length} lab.</span>
              )}
              {minPrice !== null ? (
                <span className="text-sm font-semibold text-green-700 tabular-nums w-16 text-right">
                  €{minPrice.toFixed(2)}
                </span>
              ) : (
                <span className="text-xs text-gray-300 w-16 text-right">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
