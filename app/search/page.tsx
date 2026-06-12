import type { Metadata } from 'next';
import SearchClient from './SearchClient';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';
  if (!query) return { title: 'Paieška | Laboratorijų kainos' };
  return {
    title: `„${query}" — paieška | Laboratorijų kainos`,
    description: `Tyrimo „${query}" kainos visose Lietuvos laboratorijose: Synlab, Anteja, Affidea, Meliva, Rezus.`,
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  return <SearchClient initialQuery={q?.trim() ?? ''} />;
}
