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
      <div className="px-5 py-6 text-center text-sm text-[#8a8a82]">Kainų duomenų nėra</div>
    );
  }

  const showBars = activePrices.length >= 2 && minPrice !== null && maxPrice !== null && maxPrice > minPrice;

  return (
    <div>
      {/* Desktop table header */}
      <div className="hidden sm:flex items-center px-5 py-2 border-b-2 border-[#1a1a1a] bg-[#f4f4f0] font-mono font-bold text-[11px] uppercase tracking-wider text-[#8a8a82] gap-4">
        <span className="w-4 flex-shrink-0" />
        <span className="flex-1">Laboratorija</span>
        <span className="w-24 text-right flex-shrink-0">Kaina</span>
        {showBars && <span className="w-28 hidden md:block flex-shrink-0" />}
        <span className="w-24 text-right hidden sm:block flex-shrink-0">Skirtumas</span>
        <span className="w-24 flex-shrink-0" />
      </div>

      {/* Active prices */}
      <div className="divide-y divide-[#e5e5e0]">
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
              className={`transition-colors ${isCheapest ? 'bg-[#ecfdf5]' : 'hover:bg-[#f4f4f0]'}`}
            >
              {/* Desktop row */}
              <div className="hidden sm:flex items-center px-5 py-3.5 gap-4">
                <div className="w-4 flex-shrink-0 flex items-center justify-center">
                  {isCheapest && <span className="text-[#059669] font-bold text-sm">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${isCheapest ? 'text-[#047857]' : 'text-[#1a1a1a]'}`}>
                    {lab.name}
                  </span>
                  {price.scraped_at && (
                    <div className="font-mono text-[10px] text-[#8a8a82] mt-0.5">atnaujinta {formatDate(price.scraped_at)}</div>
                  )}
                </div>
                {/* KAINA: price + Pigiausia badge stacked — badge stays in this column, never overlaps button */}
                <div className="w-24 flex-shrink-0 flex flex-col items-end gap-1">
                  <span className={`font-mono font-bold tabular-nums text-base leading-none ${isCheapest ? 'text-[#059669]' : 'text-[#1a1a1a]'}`}>
                    €{priceNum.toFixed(2)}
                  </span>
                  {isCheapest && activePrices.length > 1 && (
                    <span className="rounded-none bg-[#ecfdf5] border border-[#a7f3d0] text-[#059669] font-mono font-bold text-[9px] uppercase tracking-wider px-1.5 py-0.5 whitespace-nowrap">
                      Pigiausia
                    </span>
                  )}
                </div>
                {showBars && (
                  <div className="w-28 hidden md:flex items-center flex-shrink-0">
                    <div className="w-full bg-[#e5e5e0] h-1.5 overflow-hidden">
                      <div
                        className={`h-full ${isCheapest ? 'bg-[#059669]' : 'bg-[#8a8a82]'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )}
                {/* SKIRTUMAS: diff only, badge removed from here */}
                <div className="w-24 text-right flex-shrink-0">
                  {diff !== null && (
                    <span className="font-mono text-xs text-[#8a8a82] tabular-nums whitespace-nowrap">+€{diff.toFixed(2)}</span>
                  )}
                </div>
                <div className="w-24 flex-shrink-0 flex justify-end">
                  {bookingUrl ? (
                    <Link
                      href={bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-xs px-3 py-1.5 rounded-none border-2 transition-colors whitespace-nowrap font-bold uppercase tracking-wider ${
                        isCheapest
                          ? 'bg-[#059669] border-[#059669] text-white hover:bg-[#047857]'
                          : 'border-[#1a1a1a] text-[#1a1a1a] bg-white hover:bg-[#f4f4f0]'
                      }`}
                    >
                      Atidaryti ↗
                    </Link>
                  ) : <span />}
                </div>
              </div>

              {/* Mobile card */}
              <div className="sm:hidden px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      {isCheapest && <span className="text-[#059669] font-bold text-xs">✓</span>}
                      <span className={`text-sm font-medium ${isCheapest ? 'text-[#047857]' : 'text-[#1a1a1a]'}`}>
                        {lab.name}
                      </span>
                      {isCheapest && activePrices.length > 1 && (
                        <span className="rounded-none bg-[#ecfdf5] border border-[#a7f3d0] text-[#059669] font-mono font-bold text-[9px] uppercase tracking-wider px-1.5 py-0.5">
                          Pigiausia
                        </span>
                      )}
                    </div>
                    {price.scraped_at && (
                      <div className="font-mono text-[10px] text-[#8a8a82] mt-0.5">atnaujinta {formatDate(price.scraped_at)}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`font-mono font-bold tabular-nums text-lg ${isCheapest ? 'text-[#059669]' : 'text-[#1a1a1a]'}`}>
                      €{priceNum.toFixed(2)}
                    </span>
                    {diff !== null && (
                      <div className="font-mono text-xs text-[#8a8a82] tabular-nums">+€{diff.toFixed(2)}</div>
                    )}
                  </div>
                </div>
                {bookingUrl && (
                  <Link
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-2 block w-full text-center text-xs py-2 rounded-none border-2 font-bold uppercase tracking-wider transition-colors ${
                      isCheapest
                        ? 'bg-[#059669] border-[#059669] text-white hover:bg-[#047857]'
                        : 'border-[#1a1a1a] text-[#1a1a1a] bg-white hover:bg-[#f4f4f0]'
                    }`}
                  >
                    Atidaryti ↗
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stale prices — collapsed */}
      {staleLabs.length > 0 && (
        <div className="bg-[#fffcf0] border-t border-[#f0e6c5] px-5 py-2">
          <details className="group">
            <summary className="font-mono text-[11px] text-[#856d2b] cursor-pointer hover:text-[#6b5622] select-none list-none flex items-center gap-1">
              <span className="group-open:hidden">▸</span>
              <span className="hidden group-open:inline">▾</span>
              Senų duomenų ({staleLabs.length})
            </summary>
            <div className="mt-2 space-y-1">
              {staleLabs.map((lab) => {
                const price = priceMap.get(lab.id)!;
                return (
                  <div key={lab.id} className="flex items-center gap-3 py-1">
                    <span className="flex-1 font-mono text-[11px] text-[#8a8a82]">{lab.name}</span>
                    <span className="font-mono text-xs text-[#8a8a82] tabular-nums">
                      €{Number(price.price_eur).toFixed(2)}
                    </span>
                    <span className="font-mono text-[10px] text-[#856d2b] uppercase tracking-wider bg-[#fffcf0] border border-[#f0e6c5] px-1.5 py-0.5">senų duomenų</span>
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
