import { getTestById, getLabs, getPriceHistory } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import PriceTable from '@/app/components/PriceTable';
import ShareButton from '@/app/components/ShareButton';

interface PageProps {
  params: Promise<{ id: string }>;
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
      <nav className="text-xs text-gray-400 mb-5 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-gray-600">Pagrindinis</Link>
        {test.category && (
          <>
            <span>/</span>
            <Link href={`/category/${test.category.slug}`} className="hover:text-gray-600">
              {test.category.name_lt}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-gray-600 truncate max-w-xs">{test.canonical_name_lt}</span>
      </nav>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{test.canonical_name_lt}</h1>
          {test.canonical_name_en && (
            <p className="text-gray-400 text-sm mt-0.5">{test.canonical_name_en}</p>
          )}
        </div>
        <ShareButton />
      </div>

      {/* Cheapest price summary card */}
      {minPrice !== null && cheapest?.lab && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Pigiausia kaina</p>
              <p className="text-4xl font-bold text-green-700 tabular-nums">€{minPrice.toFixed(2)}</p>
              <p className="text-sm text-green-600 mt-1 font-medium">{cheapest.lab.name}</p>
              {savings !== null && expensiveLab && expensiveLab !== cheapest.lab.name && (
                <p className="text-xs text-green-600 mt-1">
                  Sutaupykite <span className="font-semibold">€{savings.toFixed(2)}</span> lyginant su {expensiveLab}
                </p>
              )}
            </div>
            {cheapestBookingUrl && (
              <Link
                href={cheapestBookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm whitespace-nowrap"
              >
                Registruotis →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Full price comparison table */}
      {activePrices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-8">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Kainos visose laboratorijose
            </h2>
          </div>
          <PriceTable prices={test.prices} labs={labs} />
        </div>
      )}

      {activePrices.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-4 mb-8">Kainų duomenų nėra.</p>
      )}

      {/* Price history */}
      {Object.keys(historyByLab).length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Kainų istorija
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="divide-y divide-gray-50">
              {Object.entries(historyByLab).map(([labId, entries]) => {
                const latest = entries[0];
                const previous = entries[1];
                const trend = previous
                  ? latest.price_eur < previous.price_eur ? '↓'
                    : latest.price_eur > previous.price_eur ? '↑'
                    : '→'
                  : null;
                const trendColor = trend === '↓' ? 'text-green-500' : trend === '↑' ? 'text-red-400' : 'text-gray-400';
                const trendLabel = trend === '↓' ? 'Kaina krito' : trend === '↑' ? 'Kaina kilo' : null;

                return (
                  <div key={labId} className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-600">{latest.lab_name}</span>
                      {trendLabel ? (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                          trend === '↓' ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-400'
                        }`}>
                          {trend} {trendLabel}
                        </span>
                      ) : trend === '→' ? (
                        <span className="text-xs text-gray-400 italic">kaina nepakito</span>
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
                          <span key={i} className="flex items-center gap-1 text-xs bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-gray-700 tabular-nums">
                            <span className="font-medium">€{entry.price_eur.toFixed(2)}</span>
                            {entryTrend && (
                              <span className={entryTrend === '↓' ? 'text-green-500' : 'text-red-400'}>
                                {entryTrend}
                              </span>
                            )}
                            <span className="text-gray-400 ml-0.5">{formatDate(entry.recorded_at)}</span>
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

      <p className="text-xs text-gray-400 text-center mt-4">
        Kainos orientacinės. Visada patikrinkite kainą oficialios laboratorijos svetainėje.
      </p>
    </div>
  );
}
