'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchBar({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  const router = useRouter();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = value.trim();
      if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
    },
    [value, router]
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="pvz. Vitaminas D, TSH, gliukozė, cholesterolis..."
        className="flex-1 px-4 py-3 rounded-none border border-[#e5e5e0] bg-[#f4f4f0] text-[#1a1a1a] placeholder-[#8a8a82] focus:outline-none focus:border-[#1a1a1a] focus:bg-white text-sm"
        autoFocus
      />
      <button
        type="submit"
        className="px-5 py-3 bg-[#1a1a1a] text-white rounded-none border-2 border-[#1a1a1a] font-bold uppercase tracking-wider text-xs hover:bg-[#333] active:bg-[#000] transition-colors whitespace-nowrap"
      >
        Ieškoti
      </button>
    </form>
  );
}
