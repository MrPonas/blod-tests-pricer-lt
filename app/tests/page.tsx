import { getAllTests, getCategories } from '@/lib/db';
import Link from 'next/link';
import AllTestsFilter from '@/app/components/AllTestsFilter';

export const revalidate = 86400;

export default async function AllTestsPage() {
  const [tests, categories] = await Promise.all([getAllTests(), getCategories()]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <nav className="font-mono text-[11px] text-[#8a8a82] mb-5 flex items-center gap-1.5">
        <Link href="/" className="hover:text-[#1a1a1a] transition-colors">Pagrindinis</Link>
        <span>/</span>
        <span className="text-[#1a1a1a]">Visi tyrimai</span>
      </nav>

      <div className="mb-6">
        <h1 className="font-serif italic font-bold text-3xl text-[#1a1a1a]">Visi tyrimai</h1>
      </div>

      <AllTestsFilter tests={tests} categories={categories} />
    </div>
  );
}
