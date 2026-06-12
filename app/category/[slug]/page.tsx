import { getTestsByCategory, getCategories, getLabs } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import SortableTestList from '@/app/components/SortableTestList';
import type { SortKey } from '@/app/components/FilterBar';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ labs?: string; sort?: string }>;
}

export const revalidate = 86400;

export async function generateStaticParams() {
  try {
    const categories = await getCategories();
    return categories.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories().catch(() => []);
  const cat = categories.find(c => c.slug === slug);
  if (!cat) return { title: 'Kategorija nerasta | Laboratorijų kainos' };

  const title = `${cat.name_lt} — tyrimų kainos | Laboratorijų kainos`;
  const description = `Palyginkite ${cat.name_lt.toLowerCase()} tyrimų kainas tarp visų pagrindinių Lietuvos laboratorijų: Synlab, Anteja, Affidea, Meliva, Rezus. Kainos atnaujinamos kasdien.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
  };
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

  const allCategoryTests = await getTestsByCategory(slug);
  // Only show tests with at least one active (non-stale) price
  const tests = allCategoryTests.filter(t =>
    t.prices.some(p => !p.is_stale && Number(p.price_eur) > 0)
  );

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
      <nav className="font-mono text-[11px] text-[#8a8a82] mb-5 flex items-center gap-1.5">
        <Link href="/" className="hover:text-[#1a1a1a] transition-colors">Pagrindinis</Link>
        <span>/</span>
        <span className="text-[#1a1a1a]">{category.name_lt}</span>
      </nav>

      <div className="mb-6">
        <h1 className="font-serif italic font-bold text-3xl text-[#1a1a1a]">
          {category.icon} {category.name_lt}
        </h1>
        <p className="font-mono text-[11px] text-[#8a8a82] mt-2 flex items-center gap-2 flex-wrap">
          <span className="rounded-none bg-[#f4f4f0] border border-[#e5e5e0] px-2 py-0.5">{tests.length} tyrimų</span>
          {withComparisons > 0 && (
            <span className="rounded-none bg-[#ecfdf5] border border-[#a7f3d0] text-[#059669] px-2 py-0.5">{withComparisons} su kainų palyginimu</span>
          )}
        </p>
      </div>

      {tests.length === 0 ? (
        <div className="text-center py-16 text-[#8a8a82] text-sm">
          <p>Šioje kategorijoje tyrimų dar nėra.</p>
        </div>
      ) : (
        <div className="rounded-none border-2 border-[#1a1a1a] shadow-[4px_4px_0px_0px_#1a1a1a] overflow-hidden p-5 bg-[#fdfdfc]">
          <SortableTestList
            tests={sorted}
            labs={labs}
            initialLabs={initialLabs}
            initialSort={initialSort}
          />
        </div>
      )}
    </div>
  );
}
