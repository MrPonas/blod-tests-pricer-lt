import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import Link from 'next/link';
import HeaderSearch from './components/HeaderSearch';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Laboratorijų kainos — palyginkite kraujo tyrimų kainas Lietuvoje',
  description:
    'Palyginkite kraujo tyrimų kainas tarp visų pagrindinių Lietuvos laboratorijų: Synlab, Anteja, Affidea, Meliva, Rezus. Kainos atnaujinamos kasdien.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lt" className={geist.className}>
      <body className="min-h-screen flex flex-col bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 text-base font-semibold text-gray-900 tracking-tight shrink-0">
              <span>🩸</span>
              <span>Laboratorijų kainos</span>
            </Link>
            <div className="flex items-center gap-4 sm:gap-6">
              <HeaderSearch />
              <nav className="hidden sm:flex items-center gap-5 text-sm text-gray-500">
                <Link href="/tests" className="hover:text-gray-900 transition-colors">Visi tyrimai</Link>
                <Link href="/about" className="hover:text-gray-900 transition-colors">Apie</Link>
              </nav>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-gray-200 bg-white mt-16">
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <span>🩸</span>
                <span className="font-medium text-gray-500">Laboratorijų kainos</span>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                <span>Synlab</span>
                <span>Anteja</span>
                <span>Affidea</span>
                <span>Meliva</span>
                <span>Rezus</span>
              </div>
              <div className="text-center sm:text-right space-y-0.5">
                <p>Kainos orientacinės. Visada patikrinkite kainą oficialios laboratorijos svetainėje.</p>
                <p>Duomenys atnaujinami automatiškai kartą per dieną.</p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
