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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none border font-mono font-bold text-[11px] uppercase tracking-wider transition-colors ${
                activeLabs.length > 0
                  ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white'
                  : 'border-[#e5e5e0] bg-[#f4f4f0] text-[#63635e] hover:border-[#1a1a1a] hover:text-[#1a1a1a]'
              }`}
            >
              Laboratorija
              {activeLabs.length > 0 && (
                <span className="bg-white text-[#1a1a1a] text-[10px] rounded-none w-4 h-4 flex items-center justify-center font-bold leading-none">
                  {activeLabs.length}
                </span>
              )}
              <span className="text-xs ml-0.5 opacity-60">▾</span>
            </button>
            {labOpen && (
              <div className="absolute top-full left-0 mt-1 bg-[#fdfdfc] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_0px_#1a1a1a] z-20 py-1 min-w-[170px]">
                {visibleLabs.map((lab) => (
                  <label
                    key={lab.id}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#f4f4f0] cursor-pointer font-mono text-[11px] text-[#1a1a1a] select-none"
                  >
                    <input
                      type="checkbox"
                      checked={activeLabs.includes(lab.slug)}
                      onChange={() => toggleLab(lab.slug)}
                      className="border-[#e5e5e0] text-[#1a1a1a] focus:ring-[#1a1a1a]"
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none border font-mono font-bold text-[11px] uppercase tracking-wider transition-colors ${
              sort !== 'price_asc'
                ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white'
                : 'border-[#e5e5e0] bg-[#f4f4f0] text-[#63635e] hover:border-[#1a1a1a] hover:text-[#1a1a1a]'
            }`}
          >
            {SORT_LABELS[sort]}
            <span className="text-xs ml-0.5 opacity-60">▾</span>
          </button>
          {sortOpen && (
            <div className="absolute top-full left-0 mt-1 bg-[#fdfdfc] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_0px_#1a1a1a] z-20 py-1 min-w-[190px]">
              {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { onSortChange(key); setSortOpen(false); }}
                  className={`w-full text-left px-3 py-2 font-mono text-[11px] uppercase tracking-wider hover:bg-[#f4f4f0] transition-colors ${
                    sort === key ? 'text-[#1a1a1a] font-bold' : 'text-[#63635e]'
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
            className="flex items-center gap-1 px-3 py-1.5 rounded-none border-2 border-[#1a1a1a] bg-white font-mono font-bold text-[11px] uppercase tracking-wider text-[#1a1a1a] hover:bg-[#f4f4f0] transition-colors"
          >
            × Išvalyti
          </button>
        )}
      </div>

      {/* Mobile */}
      <div className="sm:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none border font-mono font-bold text-[11px] uppercase tracking-wider transition-colors ${
            hasFilters
              ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white'
              : 'border-[#e5e5e0] bg-[#f4f4f0] text-[#63635e]'
          }`}
        >
          Filtrai
          {activeCount > 0 && (
            <span className="bg-white text-[#1a1a1a] text-[10px] rounded-none w-4 h-4 flex items-center justify-center font-bold leading-none">
              {activeCount}
            </span>
          )}
        </button>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <div className="relative bg-[#fdfdfc] border-t-2 border-[#1a1a1a] p-5 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#1a1a1a]">Filtrai</span>
                <button onClick={() => setMobileOpen(false)} className="text-[#8a8a82] text-2xl leading-none">×</button>
              </div>

              {visibleLabs.length > 0 && (
                <div className="mb-5">
                  <p className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#8a8a82] mb-2">Laboratorija</p>
                  {visibleLabs.map((lab) => (
                    <label key={lab.id} className="flex items-center gap-2.5 py-2 cursor-pointer font-mono text-[11px] text-[#1a1a1a] select-none">
                      <input
                        type="checkbox"
                        checked={activeLabs.includes(lab.slug)}
                        onChange={() => toggleLab(lab.slug)}
                        className="border-[#e5e5e0] text-[#1a1a1a]"
                      />
                      {lab.name}
                    </label>
                  ))}
                </div>
              )}

              <div className="mb-5">
                <p className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#8a8a82] mb-2">Rikiuoti</p>
                {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2.5 py-2 cursor-pointer font-mono text-[11px] text-[#1a1a1a] select-none">
                    <input
                      type="radio"
                      name="mobile-sort"
                      checked={sort === key}
                      onChange={() => onSortChange(key)}
                      className="text-[#1a1a1a]"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                {hasFilters && (
                  <button
                    onClick={() => { onClearAll(); setMobileOpen(false); }}
                    className="flex-1 py-2.5 rounded-none border-2 border-[#1a1a1a] font-mono font-bold text-[11px] uppercase tracking-wider text-[#1a1a1a]"
                  >
                    Išvalyti
                  </button>
                )}
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 py-2.5 rounded-none bg-[#1a1a1a] text-white border-2 border-[#1a1a1a] font-mono font-bold text-[11px] uppercase tracking-wider"
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
