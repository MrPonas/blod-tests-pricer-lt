'use client';

import { useState, useRef, useEffect } from 'react';
import type { Lab } from '@/lib/types';

export type SortKey = 'price_asc' | 'price_desc' | 'name_asc';

export const SORT_LABELS: Record<SortKey, string> = {
  price_asc: 'Kaina ↑',
  price_desc: 'Kaina ↓',
  name_asc: 'Pavadinimas A–Z',
};

interface Props {
  labs: Lab[];
  availableLabs: string[];
  activeLabs: string[];
  sort: SortKey;
  onLabsChange: (labs: string[]) => void;
  onSortChange: (sort: SortKey) => void;
  onClearAll: () => void;
}

export default function FilterBar({
  labs,
  availableLabs,
  activeLabs,
  sort,
  onLabsChange,
  onSortChange,
  onClearAll,
}: Props) {
  const [labOpen, setLabOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const labRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (labRef.current && !labRef.current.contains(e.target as Node)) setLabOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleLab = (slug: string) => {
    if (activeLabs.includes(slug)) {
      onLabsChange(activeLabs.filter((l) => l !== slug));
    } else {
      onLabsChange([...activeLabs, slug]);
    }
  };

  const hasFilters = activeLabs.length > 0 || sort !== 'price_asc';
  const activeCount = activeLabs.length + (sort !== 'price_asc' ? 1 : 0);
  const visibleLabs = labs.filter((l) => availableLabs.includes(l.slug));

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:flex items-center gap-2 flex-wrap">
        {visibleLabs.length > 0 && (
          <div className="relative" ref={labRef}>
            <button
              onClick={() => { setLabOpen(!labOpen); setSortOpen(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                activeLabs.length > 0
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              Laboratorija
              {activeLabs.length > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium leading-none">
                  {activeLabs.length}
                </span>
              )}
              <span className="text-gray-400 text-xs ml-0.5">▾</span>
            </button>
            {labOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 min-w-[170px]">
                {visibleLabs.map((lab) => (
                  <label
                    key={lab.id}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 select-none"
                  >
                    <input
                      type="checkbox"
                      checked={activeLabs.includes(lab.slug)}
                      onChange={() => toggleLab(lab.slug)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {lab.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="relative" ref={sortRef}>
          <button
            onClick={() => { setSortOpen(!sortOpen); setLabOpen(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
              sort !== 'price_asc'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {SORT_LABELS[sort]}
            <span className="text-gray-400 text-xs ml-0.5">▾</span>
          </button>
          {sortOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 min-w-[190px]">
              {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { onSortChange(key); setSortOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    sort === key ? 'text-blue-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasFilters && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
          >
            × Išvalyti
          </button>
        )}
      </div>

      {/* Mobile */}
      <div className="sm:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
            hasFilters
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-600'
          }`}
        >
          Filtrai
          {activeCount > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium leading-none">
              {activeCount}
            </span>
          )}
        </button>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <div className="relative bg-white rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-gray-900">Filtrai</span>
                <button onClick={() => setMobileOpen(false)} className="text-gray-400 text-2xl leading-none">×</button>
              </div>

              {visibleLabs.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Laboratorija</p>
                  {visibleLabs.map((lab) => (
                    <label key={lab.id} className="flex items-center gap-2.5 py-2 cursor-pointer text-sm text-gray-700 select-none">
                      <input
                        type="checkbox"
                        checked={activeLabs.includes(lab.slug)}
                        onChange={() => toggleLab(lab.slug)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      {lab.name}
                    </label>
                  ))}
                </div>
              )}

              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rikiuoti</p>
                {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2.5 py-2 cursor-pointer text-sm text-gray-700 select-none">
                    <input
                      type="radio"
                      name="mobile-sort"
                      checked={sort === key}
                      onChange={() => onSortChange(key)}
                      className="text-blue-600"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                {hasFilters && (
                  <button
                    onClick={() => { onClearAll(); setMobileOpen(false); }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium"
                  >
                    Išvalyti
                  </button>
                )}
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium"
                >
                  Taikyti
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
