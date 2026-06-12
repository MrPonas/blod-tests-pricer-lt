import type { Metadata } from 'next';
import Link from 'next/link';
import HeaderSearch from './components/HeaderSearch';
import { getLabs } from '@/lib/db';
import './globals.css';

export const metadata: Metadata = {
  title: 'Laboratorijų kainos — palyginkite kraujo tyrimų kainas Lietuvoje',
  description:
    'Palyginkite kraujo tyrimų kainas tarp visų pagrindinių Lietuvos laboratorijų: Synlab, Anteja, Affidea, Meliva, Rezus. Kainos atnaujinamos kasdien.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const labs = await getLabs().catch(() => []);
  return (
    <html lang="lt">
      <body className="min-h-screen flex flex-col">
        <header className="bg-[#fdfdfc] border-b-2 border-[#1a1a1a] sticky top-0 z-10">
          <div className="h-1 bg-[#059669]" />
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 bg-[#1a1a1a] flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <span className="font-serif italic font-bold text-[#1a1a1a] text-base">Laboratorijų kainos</span>
            </Link>
            <div className="flex items-center gap-4 sm:gap-6">
              <HeaderSearch />
              <nav className="hidden sm:flex items-center gap-5">
                <Link href="/tests" className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#8a8a82] hover:text-[#1a1a1a] transition-colors">Visi tyrimai</Link>
                <Link href="/about" className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#8a8a82] hover:text-[#1a1a1a] transition-colors">Apie</Link>
              </nav>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-16 sm:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#fdfdfc] border-t-2 border-[#1a1a1a] flex">
          <Link href="/" className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[#8a8a82] hover:text-[#1a1a1a] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold">Pradžia</span>
          </Link>
          <Link href="/search" className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[#8a8a82] hover:text-[#1a1a1a] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold">Paieška</span>
          </Link>
          <Link href="/tests" className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[#8a8a82] hover:text-[#1a1a1a] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold">Tyrimai</span>
          </Link>
          <Link href="/about" className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[#8a8a82] hover:text-[#1a1a1a] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold">Apie</span>
          </Link>
        </nav>

        <footer className="border-t-2 border-[#1a1a1a] bg-[#1a1a1a] mt-16">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="font-serif italic font-bold text-[#fdfdfc] text-sm">Laboratorijų kainos</span>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                {labs.length > 0 ? labs.map(lab => (
                  lab.booking_url ? (
                    <a key={lab.id} href={lab.booking_url} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[10px] uppercase tracking-wider text-[#8a8a82] hover:text-[#fdfdfc] transition-colors">
                      {lab.name}
                    </a>
                  ) : (
                    <span key={lab.id} className="font-mono text-[10px] uppercase tracking-wider text-[#8a8a82]">{lab.name}</span>
                  )
                )) : (
                  <>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#8a8a82]">Synlab</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#8a8a82]">Anteja</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#8a8a82]">Affidea</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#8a8a82]">Meliva</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#8a8a82]">Rezus</span>
                  </>
                )}
              </div>
              <div className="text-center sm:text-right space-y-0.5">
                <p className="text-[11px] text-[#8a8a82]">Kainos orientacinės. Visada patikrinkite kainą oficialios laboratorijos svetainėje.</p>
                <div className="flex items-center justify-center sm:justify-end gap-1.5">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#8a8a82]" title="Duomenys atnaujinti" />
                  <span className="font-mono text-[10px] text-[#8a8a82]">
                    {process.env.NEXT_PUBLIC_GIT_SHA} · {process.env.NEXT_PUBLIC_BUILD_TIME}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
