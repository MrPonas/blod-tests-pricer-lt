import type { Price, Lab } from '@/lib/types';

interface Props {
  prices: (Price & { lab: Lab })[];
}

export default function PricePills({ prices }: Props) {
  const active = prices
    .filter((p) => !p.is_stale && Number(p.price_eur) > 0)
    .sort((a, b) => Number(a.price_eur) - Number(b.price_eur));

  if (active.length === 0) {
    return <span className="font-mono text-[11px] text-[#8a8a82]">Kainų nėra</span>;
  }

  const minPrice = Number(active[0].price_eur);

  return (
    <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
      {active.map((p) => {
        const isCheapest = Number(p.price_eur) === minPrice;
        return (
          <span
            key={p.lab_id}
            className={`inline-flex items-center gap-1 rounded-none border font-mono text-[11px] px-2 py-0.5 ${
              isCheapest
                ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#059669] font-bold'
                : 'bg-[#f4f4f0] border-[#e5e5e0] text-[#1a1a1a]'
            }`}
          >
            {isCheapest && <span className="text-[#059669]">✓</span>}
            <span>{p.lab?.name ?? '—'}</span>
            <span className="tabular-nums">€{Number(p.price_eur).toFixed(2)}</span>
          </span>
        );
      })}
    </div>
  );
}
