import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <p className="font-mono text-[11px] text-[#8a8a82] uppercase tracking-widest mb-4">404</p>
      <h1 className="font-serif italic font-bold text-3xl text-[#1a1a1a] mb-3">Puslapis nerastas</h1>
      <p className="text-[#8a8a82] text-sm mb-8">
        Ieškomas puslapis neegzistuoja arba buvo perkeltas.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="px-6 py-3 bg-[#1a1a1a] text-white font-mono font-bold uppercase tracking-wider text-xs hover:bg-[#333] transition-colors"
        >
          Grįžti į pradžią
        </Link>
        <Link
          href="/tests"
          className="px-6 py-3 border-2 border-[#1a1a1a] text-[#1a1a1a] font-mono font-bold uppercase tracking-wider text-xs hover:bg-[#f4f4f0] transition-colors"
        >
          Visi tyrimai
        </Link>
      </div>
    </div>
  );
}
