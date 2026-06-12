'use client';

import { useState, useEffect } from 'react';

const CART_KEY = 'lab-cart';

export default function AddToCartButton({ testId }: { testId: string }) {
  const [inCart, setInCart] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      const items: string[] = saved ? JSON.parse(saved) : [];
      setInCart(items.includes(testId));
    } catch {}
  }, [testId]);

  function toggle() {
    try {
      const saved = localStorage.getItem(CART_KEY);
      const items: string[] = saved ? JSON.parse(saved) : [];
      const next = inCart ? items.filter(id => id !== testId) : [...items, testId];
      localStorage.setItem(CART_KEY, JSON.stringify(next));
      setInCart(!inCart);
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none border-2 font-mono font-bold text-[11px] uppercase tracking-wider transition-colors whitespace-nowrap ${
        inCart
          ? 'bg-[#ecfdf5] border-[#059669] text-[#059669]'
          : 'bg-white border-[#1a1a1a] text-[#1a1a1a] hover:bg-[#f4f4f0]'
      }`}
    >
      {inCart ? '✓ Krepšelyje' : '+ Į krepšelį'}
    </button>
  );
}
