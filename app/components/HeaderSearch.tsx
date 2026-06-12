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
        className="w-40 sm:w-56 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
      />
      <button
        type="submit"
        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
      >
        Ieškoti
      </button>
    </form>
  );
}
