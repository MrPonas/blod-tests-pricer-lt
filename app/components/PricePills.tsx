import type { Price, Lab } from '@/lib/types';

interface Props {
  prices: (Price & { lab: Lab })[];
}

export default function PricePills({ prices }: Props) {
  const active = prices
    .filter((p) => !p.is_stale && Number(p.price_eur) > 0)
    .sort((a, b) => Number(a.price_eur) - Number(b.price_eur));

  if (active.length === 0) {
    return <span className="text-xs text-gray-400">Kainų nėra</span>;
  }

  const minPrice = Number(active[0].price_eur);

  return (
    <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
      {active.map((p, i) => {
        const isCheapest = Number(p.price_eur) === minPrice;
        return (
          <span
            key={p.lab_id}
            className={`flex items-center gap-1 text-sm ${isCheapest ? 'text-green-700 font-semibold' : 'text-gray-500'}`}
          >
            {isCheapest && <span className="text-green-500 text-xs">✓</span>}
            <span>{p.lab?.name ?? '—'}</span>
            <span className="tabular-nums">€{Number(p.price_eur).toFixed(2)}</span>
            {i < active.length - 1 && <span className="text-gray-300 ml-1">·</span>}
          </span>
        );
      })}
    </div>
  );
}
