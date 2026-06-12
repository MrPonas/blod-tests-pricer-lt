import Link from 'next/link';
import type { Price, Lab } from '@/lib/types';

interface Props {
  prices: (Price & { lab: Lab })[];
  labs: Lab[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('lt-LT', { day: 'numeric', month: 'short' });
}

export default function PriceTable({ prices, labs }: Props) {
  const priceMap = new Map(prices.map((p) => [p.lab_id, p]));
  const labsWithData = labs.filter((lab) => priceMap.has(lab.id));

  const activePrices = labsWithData
    .map((lab) => priceMap.get(lab.id)!)
    .filter((p) => !p.is_stale && Number(p.price_eur) > 0)
    .sort((a, b) => Number(a.price_eur) - Number(b.price_eur));

  const minPrice = activePrices.length > 0 ? Number(activePrices[0].price_eur) : null;
  const maxPrice = activePrices.length > 0 ? Number(activePrices[activePrices.length - 1].price_eur) : null;

  const activeLabs = [...labsWithData].filter((lab) => {
    const p = priceMap.get(lab.id)!;
    return !p.is_stale && Number(p.price_eur) > 0;
  }).sort((a, b) => Number(priceMap.get(a.id)!.price_eur) - Number(priceMap.get(b.id)!.price_eur));

  const staleLabs = labsWithData.filter((lab) => {
    const p = priceMap.get(lab.id)!;
    return p.is_stale || Number(p.price_eur) === 0;
  });

  if (labsWithData.length === 0) {
    return (
      <div className="px-5 py-6 text-center text-sm text-gray-400">Kainų duomenų nėra</div>
    );
  }

  const showBars = activePrices.length >= 2 && minPrice !== null && maxPrice !== null && maxPrice > minPrice;

  return (
    <div>
      {/* Desktop table header */}
      <div className="hidden sm:flex items-center px-5 py-2 border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide gap-4">
        <span className="w-4 flex-shrink-0" />
        <span className="flex-1">Laboratorija</span>
        <span className="w-24 text-right">Kaina</span>
        {showBars && <span className="w-28 hidden md:block" />}
        <span className="w-20 text-right hidden sm:block">Skirtumas</span>
        <span className="w-24 flex-shrink-0" />
      </div>

      {/* Active prices */}
      <div className="divide-y divide-gray-50">
        {activeLabs.map((lab) => {
          const price = priceMap.get(lab.id)!;
          const priceNum = Number(price.price_eur);
          const isCheapest = priceNum === minPrice && minPrice !== null;
          const diff = minPrice !== null && priceNum > minPrice ? priceNum - minPrice : null;
          const barWidth = showBars && maxPrice! > 0 ? Math.round((priceNum / maxPrice!) * 100) : 0;
          const bookingUrl = price.lab_test_url ?? lab.booking_url ?? null;

          return (
            <div
              key={lab.id}
              className={`transition-colors ${isCheapest ? 'bg-green-50' : 'hover:bg-gray-50'}`}
            >
              {/* Desktop row */}
              <div className="hidden sm:flex items-center px-5 py-3.5 gap-4">
                <div className="w-4 flex-shrink-0 flex items-center justify-center">
                  {isCheapest && <span className="text-green-500 font-bold text-sm">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${isCheapest ? 'text-green-800' : 'text-gray-800'}`}>
                    {lab.name}
                  </span>
                  {price.scraped_at && (
                    <div className="text-xs text-gray-400 mt-0.5">atnaujinta {formatDate(price.scraped_at)}</div>
                  )}
                </div>
                <div className="w-24 text-right flex-shrink-0">
                  <span className={`text-base font-bold tabular-nums ${isCheapest ? 'text-green-700' : 'text-gray-900'}`}>
                    €{priceNum.toFixed(2)}
                  </span>
                </div>
                {showBars && (
                  <div className="w-28 hidden md:flex items-center flex-shrink-0">
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isCheapest ? 'bg-green-400' : 'bg-orange-300'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="w-20 text-right flex-shrink-0">
                  {isCheapest && activePrices.length > 1 && (
                    <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Pigiausia
                    </span>
                  )}
                  {diff !== null && (
                    <span className="text-xs text-red-400 tabular-nums whitespace-nowrap">+€{diff.toFixed(2)}</span>
                  )}
                </div>
                <div className="w-24 flex-shrink-0 flex justify-end">
                  {bookingUrl ? (
                    <Link
                      href={bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                        isCheapest
                          ? 'bg-green-600 border-green-600 text-white hover:bg-green-700'
                          : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      Registruotis
                    </Link>
                  ) : <span />}
                </div>
              </div>

              {/* Mobile card */}
              <div className="sm:hidden px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      {isCheapest && <span className="text-green-500 font-bold text-xs">✓</span>}
                      <span className={`text-sm font-medium ${isCheapest ? 'text-green-800' : 'text-gray-800'}`}>
                        {lab.name}
                      </span>
                      {isCheapest && activePrices.length > 1 && (
                        <span className="text-xs font-semibold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
                          Pigiausia
                        </span>
                      )}
                    </div>
                    {price.scraped_at && (
                      <div className="text-xs text-gray-400 mt-0.5">atnaujinta {formatDate(price.scraped_at)}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold tabular-nums ${isCheapest ? 'text-green-700' : 'text-gray-900'}`}>
                      €{priceNum.toFixed(2)}
                    </span>
                    {diff !== null && (
                      <div className="text-xs text-red-400 tabular-nums">+€{diff.toFixed(2)}</div>
                    )}
                  </div>
                </div>
                {bookingUrl && (
                  <Link
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-2 block w-full text-center text-xs py-2 rounded-lg font-medium transition-colors ${
                      isCheapest
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'border border-blue-200 text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    Registruotis
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stale prices — collapsed */}
      {staleLabs.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-2">
          <details className="group">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-500 select-none list-none flex items-center gap-1">
              <span className="group-open:hidden">▸</span>
              <span className="hidden group-open:inline">▾</span>
              Senų duomenų ({staleLabs.length})
            </summary>
            <div className="mt-2 space-y-1">
              {staleLabs.map((lab) => {
                const price = priceMap.get(lab.id)!;
                return (
                  <div key={lab.id} className="flex items-center gap-3 py-1">
                    <span className="flex-1 text-xs text-gray-400">{lab.name}</span>
                    <span className="text-xs text-gray-300 tabular-nums">
                      €{Number(price.price_eur).toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-300 italic">senų duomenų</span>
                  </div>
                );
              })}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
