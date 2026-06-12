import { getTestsByCategory, getCategories, getLabs } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import SortableTestList from '@/app/components/SortableTestList';
import type { SortKey } from '@/app/components/FilterBar';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ labs?: string; sort?: string }>;
}

export async function generateStaticParams() {
  try {
    const categories = await getCategories();
    return categories.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { labs: labsParam, sort: sortParam } = await searchParams;

  const initialLabs = labsParam ? labsParam.split(',').filter(Boolean) : [];
  const initialSort: SortKey =
    sortParam === 'price_desc' ? 'price_desc' : sortParam === 'name_asc' ? 'name_asc' : 'price_asc';

  const [categories, labs] = await Promise.all([getCategories(), getLabs()]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const tests = await getTestsByCategory(slug);

  const withComparisons = tests.filter(
    (t) => t.prices.filter((p) => !p.is_stale && Number(p.price_eur) > 0).length >= 2
  ).length;

  // Default sort: tests with 2+ prices first, then alpha
  const sorted = [...tests].sort((a, b) => {
    const aCount = a.prices.filter((p) => !p.is_stale && Number(p.price_eur) > 0).length;
    const bCount = b.prices.filter((p) => !p.is_stale && Number(p.price_eur) > 0).length;
    const aGroup = aCount >= 2 ? 0 : aCount === 1 ? 1 : 2;
    const bGroup = bCount >= 2 ? 0 : bCount === 1 ? 1 : 2;
    if (aGroup !== bGroup) return aGroup - bGroup;
    return a.canonical_name_lt.localeCompare(b.canonical_name_lt, 'lt');
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <nav className="text-xs text-gray-400 mb-5 flex items-center gap-1.5">
        <Link href="/" className="hover:text-gray-600">Pagrindinis</Link>
        <span>/</span>
        <span className="text-gray-600">{category.name_lt}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {category.icon} {category.name_lt}
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {tests.length} tyrimų
          {withComparisons > 0 && (
            <span className="ml-2 text-green-600">· {withComparisons} su kainų palyginimu</span>
          )}
        </p>
      </div>

      {tests.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          <p>Šioje kategorijoje tyrimų dar nėra.</p>
        </div>
      ) : (
        <SortableTestList
          tests={sorted}
          labs={labs}
          initialLabs={initialLabs}
          initialSort={initialSort}
        />
      )}
    </div>
  );
}
