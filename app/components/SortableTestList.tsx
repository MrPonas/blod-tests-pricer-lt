'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import PriceTable from './PriceTable';
import FilterBar, { type SortKey } from './FilterBar';
import type { TestWithPrices, Lab } from '@/lib/types';

interface Props {
  tests: TestWithPrices[];
  labs: Lab[];
  initialLabs?: string[];
  initialSort?: SortKey;
  preserveParams?: Record<string, string>;
}

export default function SortableTestList({
  tests,
  labs,
  initialLabs = [],
  initialSort = 'price_asc',
  preserveParams = {},
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeLabs, setActiveLabs] = useState<string[]>(initialLabs);
  const [sort, setSort] = useState<SortKey>(initialSort);

  const availableLabs = useMemo(() => {
    const slugs = new Set<string>();
    tests.forEach((t) =>
      t.prices.forEach((p) => {
        if (!p.is_stale && Number(p.price_eur) > 0 && p.lab?.slug) slugs.add(p.lab.slug);
      })
    );
    return Array.from(slugs);
  }, [tests]);

  const pushUrl = useCallback(
    (newLabs: string[], newSort: SortKey) => {
      const params = new URLSearchParams();
      Object.entries(preserveParams).forEach(([k, v]) => { if (v) params.set(k, v); });
      if (newLabs.length > 0) params.set('labs', newLabs.join(','));
      if (newSort !== 'price_asc') params.set('sort', newSort);
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, pathname, preserveParams]
  );

  const handleLabsChange = (labs: string[]) => {
    setActiveLabs(labs);
    pushUrl(labs, sort);
  };

  const handleSortChange = (newSort: SortKey) => {
    setSort(newSort);
    pushUrl(activeLabs, newSort);
  };

  const handleClearAll = () => {
    setActiveLabs([]);
    setSort('price_asc');
    pushUrl([], 'price_asc');
  };

  const filtered = useMemo(() => {
    let result = tests;
    if (activeLabs.length > 0) {
      result = result.filter((t) =>
        t.prices.some(
          (p) => !p.is_stale && Number(p.price_eur) > 0 && p.lab?.slug && activeLabs.includes(p.lab.slug)
        )
      );
    }
    return [...result].sort((a, b) => {
      if (sort === 'name_asc') {
        return a.canonical_name_lt.localeCompare(b.canonical_name_lt, 'lt');
      }
      const getMin = (t: TestWithPrices) => {
        const prices = t.prices
          .filter((p) => !p.is_stale && Number(p.price_eur) > 0)
          .map((p) => Number(p.price_eur));
        return prices.length > 0 ? Math.min(...prices) : Infinity;
      };
      const aMin = getMin(a);
      const bMin = getMin(b);
      if (aMin === Infinity && bMin === Infinity) return a.canonical_name_lt.localeCompare(b.canonical_name_lt, 'lt');
      if (aMin === Infinity) return 1;
      if (bMin === Infinity) return -1;
      return sort === 'price_desc' ? bMin - aMin : aMin - bMin;
    });
  }, [tests, activeLabs, sort]);

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <FilterBar
          labs={labs}
          availableLabs={availableLabs}
          activeLabs={activeLabs}
          sort={sort}
          onLabsChange={handleLabsChange}
          onSortChange={handleSortChange}
          onClearAll={handleClearAll}
        />
        {filtered.length !== tests.length && (
          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} iš {tests.length} tyrimų
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-sm mb-3">Nerasta tyrimų su pasirinktais filtrais.</p>
          <button
            onClick={handleClearAll}
            className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2"
          >
            Išvalyti filtrus
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((test) => (
            <div key={test.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-baseline gap-2 flex-wrap">
                <Link
                  href={`/test/${test.id}`}
                  className="font-medium text-gray-900 hover:text-blue-600 transition-colors text-sm leading-snug"
                >
                  {test.canonical_name_lt}
                </Link>
                {test.canonical_name_en && (
                  <span className="text-xs text-gray-400">{test.canonical_name_en}</span>
                )}
                {test.category && (
                  <Link
                    href={`/category/${test.category.slug}`}
                    className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
                  >
                    {test.category.icon} {test.category.name_lt}
                  </Link>
                )}
              </div>
              <PriceTable prices={test.prices} labs={labs} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
