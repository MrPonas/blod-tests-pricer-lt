import { getAllTests, getCategories } from '@/lib/db';
import Link from 'next/link';
import AllTestsFilter from '@/app/components/AllTestsFilter';

export const revalidate = 86400;

export default async function AllTestsPage() {
  const [tests, categories] = await Promise.all([getAllTests(), getCategories()]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-xs text-gray-400 mb-5 flex items-center gap-1.5">
        <Link href="/" className="hover:text-gray-600">Pagrindinis</Link>
        <span>/</span>
        <span className="text-gray-600">Visi tyrimai</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Visi tyrimai</h1>
      </div>

      <AllTestsFilter tests={tests} categories={categories} />
    </div>
  );
}
