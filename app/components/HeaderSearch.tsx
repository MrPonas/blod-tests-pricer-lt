'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function HeaderSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = value.trim();
      if (q) {
        router.push(`/search?q=${encodeURIComponent(q)}`);
        setValue('');
      }
    },
    [value, router]
  );

  if (pathname === '/') return null;

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ieškoti tyrimo..."
        className="w-40 sm:w-56 px-3 py-2 rounded-none border border-[#e5e5e0] bg-[#f4f4f0] text-sm text-[#1a1a1a] placeholder-[#8a8a82] focus:outline-none focus:border-[#1a1a1a] focus:bg-white"
      />
      <button
        type="submit"
        className="px-3 py-2 bg-[#1a1a1a] text-white rounded-none border-2 border-[#1a1a1a] text-xs font-bold uppercase tracking-wider hover:bg-[#333] transition-colors whitespace-nowrap"
      >
        Ieškoti
      </button>
    </form>
  );
}
