import { getTestById, getLabs, getPriceHistory, getActiveTestIds, getRelatedTests } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import PriceTable from '@/app/components/PriceTable';
import ShareButton from '@/app/components/ShareButton';

export const revalidate = 86400;

export async function generateStaticParams() {
  try {
    const ids = await getActiveTestIds();
    return ids.map(id => ({ id: String(id) }));
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const test = await getTestById(Number(id));
  if (!test) return { title: 'Tyrimas nerastas | Laboratorijų kainos' };

  const activePrices = test.prices.filter(p => !p.is_stale && Number(p.price_eur) > 0);
  const minPrice = activePrices.length > 0 ? Math.min(...activePrices.map(p => Number(p.price_eur))) : null;
  const enPart = test.canonical_name_en ? ` (${test.canonical_name_en})` : '';
  const pricePart = minPrice ? `. Pigiausia kaina nuo €${minPrice.toFixed(2)}` : '';

  const title = `${test.canonical_name_lt}${enPart} — tyrimo kaina | Laboratorijų kainos`;
  const description = `Palyginkite ${test.canonical_name_lt} tyrimo kainas tarp Synlab, Anteja, Affidea, Meliva, Rezus${pricePart}. Kainos atnaujinamos kasdien.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('lt-LT', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default async function TestPage({ params }: PageProps) {
  const { id } = await params;
  const [test, labs, history] = await Promise.all([
    getTestById(Number(id)),
    getLabs(),
    getPriceHistory(Number(id)),
  ]);
  if (!test) notFound();
  const related = test.category?.id ? await getRelatedTests(test.category.id, Number(id), 6) : [];
  // Warn about labs that have a price but no booking URL at all (not even lab-level)
  for (const p of test.prices.filter(p => !p.is_stale && Number(p.price_eur) > 0)) {
    if (!p.lab_test_url && !p.lab?.booking_url) {
      console.warn(`[test/${id}] Lab "${p.lab?.name}" has price but no booking URL (lab_id=${p.lab_id})`);
    }
  }

  const activePrices = test.prices
    .filter((p) => !p.is_stale && Number(p.price_eur) > 0)
    .sort((a, b) => Number(a.price_eur) - Number(b.price_eur));

  const cheapest = activePrices[0] ?? null;
  const minPrice = cheapest ? Number(cheapest.price_eur) : null;
  const maxPrice = activePrices.length > 0 ? Number(activePrices[activePrices.length - 1].price_eur) : null;
  const savings = minPrice !== null && maxPrice !== null && maxPrice > minPrice ? maxPrice - minPrice : null;
  const expensiveLab = activePrices[activePrices.length - 1]?.lab?.name ?? null;

  const historyByLab = history.reduce<Record<number, typeof history>>((acc, h) => {
    if (!acc[h.lab_id]) acc[h.lab_id] = [];
    acc[h.lab_id].push(h);
    return acc;
  }, {});

  const cheapestBookingUrl = cheapest?.lab_test_url ?? cheapest?.lab?.booking_url ?? null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <nav className="font-mono text-[11px] text-[#8a8a82] mb-5 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-[#1a1a1a] transition-colors">Pagrindinis</Link>
        {test.category && (
          <>
            <span>/</span>
            <Link href={`/category/${test.category.slug}`} className="hover:text-[#1a1a1a] transition-colors">
              {test.category.name_lt}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-[#1a1a1a] truncate max-w-xs">{test.canonical_name_lt}</span>
      </nav>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="font-serif italic font-bold text-3xl text-[#1a1a1a]">{test.canonical_name_lt}</h1>
          {test.canonical_name_en && (
            <p className="text-[#8a8a82] text-sm mt-0.5">{test.canonical_name_en}</p>
          )}
        </div>
        <ShareButton />
      </div>

      {/* Cheapest price summary card */}
      {minPrice !== null && cheapest?.lab && (
        <div className="bg-[#ecfdf5] border-2 border-[#059669] shadow-[4px_4px_0px_0px_#059669] rounded-none p-5 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#059669] mb-1">Pigiausia kaina</p>
              <p className="font-mono font-black text-[#059669] tabular-nums text-3xl">€{minPrice.toFixed(2)}</p>
              <p className="text-sm text-[#047857] mt-1 font-medium">{cheapest.lab.name}</p>
              {savings !== null && expensiveLab && expensiveLab !== cheapest.lab.name && (
                <p className="font-mono text-[11px] text-[#059669] mt-1">
                  Sutaupykite <span className="font-bold">€{savings.toFixed(2)}</span> lyginant su {expensiveLab}
                </p>
              )}
            </div>
            {cheapestBookingUrl && (
              <Link
                href={cheapestBookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white rounded-none border-2 border-[#059669] font-bold uppercase tracking-wider text-xs transition-colors whitespace-nowrap"
              >
                Registruotis →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Full price comparison table */}
      {activePrices.length > 0 && (
        <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] shadow-[4px_4px_0px_0px_#1a1a1a] overflow-hidden mb-8">
          <div className="px-5 py-3 border-b-2 border-[#1a1a1a] bg-[#f4f4f0]">
            <h2 className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#8a8a82]">
              Kainos visose laboratorijose
            </h2>
          </div>
          <PriceTable prices={test.prices} labs={labs} />
        </div>
      )}

      {activePrices.length === 0 && (
        <p className="text-center text-[#8a8a82] text-sm py-4 mb-8">Kainų duomenų nėra.</p>
      )}

      {/* Price history */}
      {Object.keys(historyByLab).length > 0 && (
        <div className="mb-6">
          <h2 className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#8a8a82] mb-3">
            Kainų istorija
          </h2>
          <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] overflow-hidden">
            <div className="divide-y divide-[#e5e5e0]">
              {Object.entries(historyByLab).map(([labId, entries]) => {
                const latest = entries[0];
                const previous = entries[1];
                const trend = previous
                  ? latest.price_eur < previous.price_eur ? '↓'
                    : latest.price_eur > previous.price_eur ? '↑'
                    : '→'
                  : null;
                const trendColor = trend === '↓' ? 'text-[#059669]' : trend === '↑' ? 'text-red-500' : 'text-[#8a8a82]';
                const trendLabel = trend === '↓' ? 'Kaina krito' : trend === '↑' ? 'Kaina kilo' : null;

                return (
                  <div key={labId} className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-[#1a1a1a]">{latest.lab_name}</span>
                      {trendLabel ? (
                        <span className={`font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-none border ${
                          trend === '↓' ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#059669]' : 'bg-red-50 border-red-200 text-red-500'
                        }`}>
                          {trend} {trendLabel}
                        </span>
                      ) : trend === '→' ? (
                        <span className="font-mono text-[10px] text-[#8a8a82]">kaina nepakito</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entries.slice(0, 6).map((entry, i) => {
                        const prev = entries[i + 1];
                        const entryTrend = prev
                          ? entry.price_eur < prev.price_eur ? '↓'
                            : entry.price_eur > prev.price_eur ? '↑'
                            : null
                          : null;
                        return (
                          <span key={i} className="flex items-center gap-1 font-mono text-[11px] bg-[#f4f4f0] border border-[#e5e5e0] rounded-none px-2.5 py-1.5 text-[#1a1a1a] tabular-nums">
                            <span className="font-bold">€{entry.price_eur.toFixed(2)}</span>
                            {entryTrend && (
                              <span className={entryTrend === '↓' ? 'text-[#059669]' : 'text-red-500'}>
                                {entryTrend}
                              </span>
                            )}
                            <span className="text-[#8a8a82] ml-0.5">{formatDate(entry.recorded_at)}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stale data warning */}
      {test.prices.some(p => p.is_stale) && activePrices.length > 0 && (
        <p className="bg-[#fffcf0] border-2 border-[#f0e6c5] text-[#856d2b] rounded-none font-sans text-[11px] text-center px-4 py-3 mb-4">
          ⚠ Kai kurių laboratorijų kainos gali būti neatnaujintos
        </p>
      )}

      {/* Related tests */}
      {related.length > 0 && (
        <div className="mb-6">
          <h2 className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#8a8a82] mb-3">
            Susiję tyrimai
          </h2>
          <div className="flex flex-wrap gap-2">
            {related.map(r => (
              <Link
                key={r.id}
                href={`/test/${r.id}`}
                className="px-3 py-1.5 rounded-none border-2 border-[#1a1a1a] bg-white hover:bg-[#f4f4f0] font-mono text-[11px] text-[#1a1a1a] transition-colors"
              >
                {r.canonical_name_lt}
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="bg-[#fffcf0] border-2 border-[#f0e6c5] text-[#856d2b] rounded-none font-sans text-[11px] text-center px-4 py-3 mt-4">
        Kainos orientacinės. Visada patikrinkite kainą oficialios laboratorijos svetainėje.
      </p>
    </div>
  );
}
