'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSearchIndex, type SearchEntry } from '@/app/hooks/useSearchIndex';

interface Props {
  initialQuery: string;
}

export default function SearchClient({ initialQuery }: Props) {
  const router = useRouter();
  const { search, ready } = useSearchIndex();
  const [inputValue, setInputValue] = useState(initialQuery);
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [searched, setSearched] = useState(false);

  // Run search whenever the index becomes ready or the initial query changes
  useEffect(() => {
    if (!ready) return;
    const q = initialQuery.trim();
    if (q) {
      setResults(search(q, 30));
      setSearched(true);
    } else {
      setResults([]);
      setSearched(false);
    }
  }, [ready, initialQuery, search]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = inputValue.trim();
      if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
    },
    [inputValue, router]
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="pvz. Vitaminas D, TSH, gliukozė..."
          autoFocus
          className="flex-1 px-4 py-3 rounded-none border border-[#e5e5e0] bg-[#f4f4f0] text-[#1a1a1a] placeholder-[#8a8a82] focus:outline-none focus:border-[#1a1a1a] focus:bg-white text-sm"
        />
        <button
          type="submit"
          className="px-5 py-3 bg-[#1a1a1a] text-white rounded-none border-2 border-[#1a1a1a] font-bold uppercase tracking-wider text-xs hover:bg-[#333] transition-colors whitespace-nowrap"
        >
          Ieškoti
        </button>
      </form>

      {initialQuery && !ready && (
        <p className="font-mono text-[11px] text-[#8a8a82] uppercase tracking-wider text-center py-8">
          Kraunama...
        </p>
      )}

      {searched && results.length === 0 && ready && (
        <div className="text-center py-16">
          <p className="text-[#1a1a1a] font-medium mb-1">
            Nerasta tyrimų pagal „{initialQuery}"
          </p>
          <p className="font-mono text-[11px] text-[#8a8a82] uppercase tracking-wider mb-6">
            Patikrinkite rašybą arba bandykite kitą pavadinimą
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/tests"
              className="px-4 py-2 rounded-none border border-[#e5e5e0] bg-[#f4f4f0] font-mono text-[11px] uppercase tracking-wider text-[#1a1a1a] hover:border-[#1a1a1a] transition-colors"
            >
              Visi tyrimai →
            </Link>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <>
          <p className="font-mono text-[11px] text-[#8a8a82] uppercase tracking-wider mb-4">
            {results.length} tyrima{results.length === 1 ? 's' : results.length < 10 ? 'i' : 'ų'} pagal „{initialQuery}"
          </p>
          <div className="bg-[#fdfdfc] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_0px_#1a1a1a] divide-y divide-[#e5e5e0]">
            {results.map(entry => (
              <Link
                key={entry.id}
                href={`/test/${entry.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#f4f4f0] transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#1a1a1a] font-medium group-hover:text-[#8a8a82] transition-colors">
                    {entry.name_lt}
                  </p>
                  {entry.name_en && (
                    <p className="font-mono text-[10px] text-[#8a8a82] mt-0.5">{entry.name_en}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {entry.category && (
                    <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-[#8a8a82] bg-[#f4f4f0] border border-[#e5e5e0] px-2 py-0.5">
                      {entry.category}
                    </span>
                  )}
                  {entry.lab_count >= 2 && (
                    <span className="font-mono text-[10px] text-[#8a8a82]">{entry.lab_count} lab.</span>
                  )}
                  {entry.min_price !== null ? (
                    <span className="font-mono font-bold text-[#059669] tabular-nums text-sm w-16 text-right">
                      nuo €{entry.min_price.toFixed(2)}
                    </span>
                  ) : (
                    <span className="font-mono text-[#8a8a82] w-16 text-right text-xs">—</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {!initialQuery && (
        <div className="text-center py-16 text-[#8a8a82] text-sm">
          Įveskite tyrimo pavadinimą paieškos laukelyje
        </div>
      )}
    </div>
  );
}
