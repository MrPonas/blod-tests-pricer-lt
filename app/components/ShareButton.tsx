'use client';

import { useState } from 'react';

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-none border-2 font-mono font-bold text-[11px] uppercase tracking-wider transition-colors ${
        copied
          ? 'bg-[#059669] text-white border-[#059669]'
          : 'border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#f4f4f0]'
      }`}
    >
      {copied ? (
        <>
          <span>✓</span>
          <span>Nukopijuota</span>
        </>
      ) : (
        <>
          <span>⎘</span>
          <span>Dalintis</span>
        </>
      )}
    </button>
  );
}
