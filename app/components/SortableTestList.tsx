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
      const getActivePrices = (t: TestWithPrices) =>
        t.prices.filter((p) => !p.is_stale && Number(p.price_eur) > 0).map((p) => Number(p.price_eur));
      if (sort === 'savings_desc') {
        const aPrices = getActivePrices(a);
        const bPrices = getActivePrices(b);
        const aSav = aPrices.length > 1 ? Math.max(...aPrices) - Math.min(...aPrices) : 0;
        const bSav = bPrices.length > 1 ? Math.max(...bPrices) - Math.min(...bPrices) : 0;
        return bSav - aSav;
      }
      const aMin = getActivePrices(a).length > 0 ? Math.min(...getActivePrices(a)) : Infinity;
      const bMin = getActivePrices(b).length > 0 ? Math.min(...getActivePrices(b)) : Infinity;
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
          <span className="font-mono text-[11px] text-[#8a8a82] ml-auto">
            {filtered.length} iš {tests.length} tyrimų
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14 text-[#8a8a82]">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-sm mb-3">Nerasta tyrimų su pasirinktais filtrais.</p>
          <button
            onClick={handleClearAll}
            className="font-mono font-bold text-[11px] uppercase tracking-wider text-[#1a1a1a] underline underline-offset-2 hover:text-[#8a8a82]"
          >
            Išvalyti filtrus
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((test) => (
            <div key={test.id} className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] shadow-[2px_2px_0px_0px_#1a1a1a] overflow-hidden">
              <div className="px-5 py-3 border-b-2 border-[#1a1a1a] flex items-baseline gap-2 flex-wrap bg-[#f4f4f0]">
                <Link
                  href={`/test/${test.id}`}
                  className="font-medium text-[#1a1a1a] hover:text-[#8a8a82] transition-colors text-sm leading-snug"
                >
                  {test.canonical_name_lt}
                </Link>
                {test.canonical_name_en && (
                  <span className="font-mono text-[10px] text-[#8a8a82]">{test.canonical_name_en}</span>
                )}
                {(() => {
                  const ap = test.prices.filter(p => !p.is_stale && Number(p.price_eur) > 0).map(p => Number(p.price_eur));
                  if (ap.length < 2) return null;
                  const mn = Math.min(...ap), mx = Math.max(...ap);
                  return (
                    <span className="font-mono text-[10px] text-[#8a8a82] whitespace-nowrap">
                      €{mn.toFixed(2)}{mn !== mx ? ` – €${mx.toFixed(2)}` : ''}
                    </span>
                  );
                })()}
                {test.category && (
                  <Link
                    href={`/category/${test.category.slug}`}
                    className="font-mono text-[10px] uppercase tracking-wider text-[#8a8a82] hover:text-[#1a1a1a] ml-auto"
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
