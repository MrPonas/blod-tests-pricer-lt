'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchIndex } from '@/app/hooks/useSearchIndex';
import { getDisplayName } from '@/lib/utils';
import { optimizeBasket } from '@/lib/basket-optimizer';
import type { BasketOptimization } from '@/lib/basket-optimizer';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TestUI {
  id: string;
  name: string;
  latinName: string | null;
  code: string;
  category: string;
  prices: Record<string, number>;
  bookingUrls: Record<string, string | null>;
  isStale: boolean;
  updateDate: string;
}

export interface LabUI {
  id: string;
  name: string;
  samplingFee: number;
  bookingUrl: string | null;
  description: string;
  color: string;
}

export interface CategoryUI {
  id: string;
  name: string;
  icon?: string | null;
}

interface HistoryPoint {
  lab_id: number;
  lab_name: string;
  price_eur: number;
  recorded_at: string;
}

interface ChartPoint {
  date: string;
  [labId: string]: number | string;
}

// ─── Static Data ──────────────────────────────────────────────────────────────

interface LocEntry {
  id: string;
  labName: string;
  city: string;
  address: string;
  workingHours: string;
  phone: string;
}

const LAB_LOCATIONS: LocEntry[] = [
  { id: 'v-ant-1', labName: 'Antėja', city: 'Vilnius', address: 'Laisvės pr. 79D, Vilnius', workingHours: 'I–V 7:00–19:00, VI 8:00–14:00', phone: '+370 700 55511' },
  { id: 'v-ant-2', labName: 'Antėja', city: 'Vilnius', address: 'Savanorių pr. 139A, Vilnius', workingHours: 'I–V 7:30–16:00', phone: '+370 700 55511' },
  { id: 'v-syn-1', labName: 'Synlab', city: 'Vilnius', address: 'Kalvarijų g. 137A, Vilnius', workingHours: 'I–V 7:30–15:30', phone: '+370 5 248 7755' },
  { id: 'v-rez-1', labName: 'Rezus', city: 'Vilnius', address: 'Antakalnio g. 42, Vilnius', workingHours: 'I–V 7:30–15:00, VI 8:00–12:00', phone: '+370 604 12111' },
  { id: 'k-ant-1', labName: 'Antėja', city: 'Kaunas', address: 'Savanorių pr. 169, Kaunas', workingHours: 'I–V 7:00–19:00, VI 8:00–15:00', phone: '+370 700 55511' },
  { id: 'k-syn-1', labName: 'Synlab', city: 'Kaunas', address: 'Vytauto pr. 32, Kaunas', workingHours: 'I–V 7:30–15:00', phone: '+370 37 323 125' },
  { id: 'k-rez-1', labName: 'Rezus', city: 'Kaunas', address: 'Savanorių pr. 66, Kaunas', workingHours: 'I–V 7:30–15:00', phone: '+370 659 12345' },
  { id: 'kl-ant-1', labName: 'Antėja', city: 'Klaipėda', address: 'Liepų g. 48B, Klaipėda', workingHours: 'I–V 7:30–17:00, VI 8:00–13:00', phone: '+370 700 55511' },
  { id: 'kl-syn-1', labName: 'Synlab', city: 'Klaipėda', address: 'Taikos pr. 141, Klaipėda', workingHours: 'I–V 7:30–15:00', phone: '+370 46 411 915' },
  { id: 'kl-rez-1', labName: 'Rezus', city: 'Klaipėda', address: 'Manto g. 22, Klaipėda', workingHours: 'I–V 7:30–15:00', phone: '+370 659 98765' },
  { id: 's-ant-1', labName: 'Antėja', city: 'Šiauliai', address: 'Tilžės g. 11B, Šiauliai', workingHours: 'I–V 7:30–16:00', phone: '+370 700 55511' },
  { id: 's-rez-1', labName: 'Rezus', city: 'Šiauliai', address: 'Sodų g. 3A, Šiauliai', workingHours: 'I–V 7:00–17:00, VI 8:00–13:00', phone: '+370 41 552 901' },
  { id: 'p-ant-1', labName: 'Antėja', city: 'Panevėžys', address: 'Smėlynės g. 25, Panevėžys', workingHours: 'I–V 7:30–16:00', phone: '+370 700 55511' },
  { id: 'p-rez-1', labName: 'Rezus', city: 'Panevėžys', address: 'Savanorių a. 12, Panevėžys', workingHours: 'I–V 7:30–15:30', phone: '+370 620 44344' },
];

const CITIES = ['Vilnius', 'Kaunas', 'Klaipėda', 'Šiauliai', 'Panevėžys'];

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

const Ic = {
  Cart: ({ c = 'w-4 h-4' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  Trend: ({ c = 'w-4 h-4' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Map: ({ c = 'w-4 h-4' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  File: ({ c = 'w-4 h-4' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Down: ({ c = 'w-4 h-4' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Up: ({ c = 'w-4 h-4' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  Search: ({ c = 'w-4 h-4' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Check: ({ c = 'w-4 h-4' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Trash: ({ c = 'w-4 h-4' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  Filter: ({ c = 'w-4 h-4' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  Right: ({ c = 'w-4 h-4' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Phone: ({ c = 'w-3 h-3' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.37 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.38a16 16 0 0 0 6.06 6.06l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  Clock: ({ c = 'w-3 h-3' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Link: ({ c = 'w-3 h-3' }: { c?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildChartData(history: HistoryPoint[], labs: LabUI[]): ChartPoint[] {
  if (history.length === 0) return [];
  const byMonth = new Map<string, Map<string, number>>();
  history.forEach(h => {
    const month = h.recorded_at.slice(0, 7);
    const lab = labs.find(l => l.name === h.lab_name);
    if (!lab) return;
    if (!byMonth.has(month)) byMonth.set(month, new Map());
    const existing = byMonth.get(month)!.get(lab.id);
    // Keep latest price for the month
    if (existing === undefined) byMonth.get(month)!.set(lab.id, h.price_eur);
  });
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8) // last 8 months
    .map(([date, prices]) => ({ date, ...Object.fromEntries(prices.entries()) }));
}

const MONTHS: Record<string, string> = {
  '01': 'Saus.', '02': 'Vas.', '03': 'Kov.', '04': 'Bal.',
  '05': 'Geg.', '06': 'Birž.', '07': 'Liep.', '08': 'Rugp.',
  '09': 'Rugs.', '10': 'Spal.', '11': 'Lapk.', '12': 'Gruod.',
};

function fmtDate(d: string) {
  const [y, m] = d.split('-');
  return `${MONTHS[m] || m} ${y?.slice(2)}`;
}

function MiniSvgChart({ chartData, labs }: { chartData: ChartPoint[]; labs: LabUI[] }) {
  if (chartData.length < 1) return null;
  const W = 400, H = 90, pX = 35, pY = 12;
  const allPrices: number[] = [];
  chartData.forEach(d => labs.forEach(l => {
    const v = d[l.id] as number;
    if (typeof v === 'number') allPrices.push(v);
  }));
  if (allPrices.length === 0) return null;
  const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
  const sp = maxP - minP || 1;
  const gMin = Math.max(0, minP - sp * 0.15), gMax = maxP + sp * 0.15;
  const gX = (i: number) => chartData.length <= 1 ? W / 2 : pX + (i * (W - pX * 2)) / (chartData.length - 1);
  const gY = (v: number) => H - pY - ((v - gMin) / (gMax - gMin || 1)) * (H - pY * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {[0.25, 0.75].map((r, i) => {
        const y = pY + r * (H - pY * 2);
        return (
          <g key={i}>
            <line x1={pX} y1={y} x2={W - pX} y2={y} stroke="#e5e5e0" strokeWidth="0.8" strokeDasharray="2 2" />
            <text x={pX - 5} y={y + 3} textAnchor="end" fontSize="7" className="fill-[#8a8a82] font-mono">
              {(gMax - r * (gMax - gMin)).toFixed(1)}€
            </text>
          </g>
        );
      })}
      {labs.map(lab => {
        const pts = chartData.map((d, i) => ({ x: gX(i), y: gY(d[lab.id] as number) }))
          .filter(p => !isNaN(p.y) && isFinite(p.y));
        if (pts.length === 0) return null;
        if (pts.length === 1) return <circle key={lab.id} cx={pts[0].x} cy={pts[0].y} r={5} fill={lab.color} />;
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return <path key={lab.id} d={path} fill="none" stroke={lab.color} strokeWidth="1.8" strokeLinecap="round" />;
      })}
      {chartData.map((d, i) => (
        <text key={i} x={gX(i)} y={H - 2} textAnchor="middle" fontSize="7" className="fill-[#8a8a82] font-mono">
          {fmtDate(d.date)}
        </text>
      ))}
    </svg>
  );
}

function FullSvgChart({ chartData, labs }: { chartData: ChartPoint[]; labs: LabUI[] }) {
  if (chartData.length < 1) return null;
  const W = 500, H = 140, pX = 45, pY = 20;
  const allPrices: number[] = [];
  chartData.forEach(d => labs.forEach(l => {
    const v = d[l.id] as number;
    if (typeof v === 'number') allPrices.push(v);
  }));
  if (allPrices.length === 0) return null;
  const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
  const sp = maxP - minP || 1;
  const gMin = Math.max(0, minP - sp * 0.15), gMax = maxP + sp * 0.15;
  const gX = (i: number) => chartData.length <= 1 ? W / 2 : pX + (i * (W - pX * 2)) / (chartData.length - 1);
  const gY = (v: number) => H - pY - ((v - gMin) / (gMax - gMin || 1)) * (H - pY * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto min-h-[140px]">
      {[0.25, 0.5, 0.75].map((r, i) => {
        const y = pY + r * (H - pY * 2);
        const val = gMax - r * (gMax - gMin);
        return (
          <g key={i}>
            <line x1={pX} y1={y} x2={W - pX} y2={y} stroke="#f1f1eb" strokeDasharray="2 2" />
            <text x={pX - 8} y={y + 3} textAnchor="end" fontSize="8" className="fill-[#8a8a82] font-mono">
              {val.toFixed(1)} €
            </text>
          </g>
        );
      })}
      {chartData.map((d, i) => (
        <g key={i}>
          <line x1={gX(i)} y1={H - pY} x2={gX(i)} y2={H - pY + 3} stroke="#e5e5e0" />
          <text x={gX(i)} y={H - pY + 12} textAnchor="middle" fontSize="7" className="fill-[#8a8a82] font-mono font-bold">
            {fmtDate(d.date)}
          </text>
        </g>
      ))}
      {labs.map(lab => {
        const pts = chartData.map((d, i) => ({ x: gX(i), y: gY(d[lab.id] as number) }))
          .filter(p => !isNaN(p.y) && isFinite(p.y));
        if (pts.length === 0) return null;
        if (pts.length === 1) {
          const v = chartData[0][lab.id] as number;
          return (
            <g key={lab.id}>
              <circle cx={pts[0].x} cy={pts[0].y} r={5} fill="white" stroke={lab.color} strokeWidth={2} />
              {!isNaN(v) && (
                <g>
                  <rect x={pts[0].x + 4} y={pts[0].y - 7} width={30} height={12} fill="#1a1a1a" />
                  <text x={pts[0].x + 19} y={pts[0].y + 2} textAnchor="middle" fontSize="7.5" className="fill-white font-mono font-extrabold">{v.toFixed(1)}€</text>
                </g>
              )}
            </g>
          );
        }
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const last = pts[pts.length - 1];
        const lastVal = chartData[pts.length - 1]?.[lab.id] as number;
        return (
          <g key={lab.id}>
            <path d={path} fill="none" stroke={lab.color} strokeWidth="2" strokeLinecap="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3} fill="white" stroke={lab.color} strokeWidth={1.5} />
            ))}
            {last && !isNaN(lastVal) && (
              <g>
                <rect x={last.x + 4} y={last.y - 7} width={30} height={12} fill="#1a1a1a" />
                <text x={last.x + 19} y={last.y + 2} textAnchor="middle" fontSize="7.5" className="fill-white font-mono font-extrabold">
                  {lastVal.toFixed(1)}€
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function TrendsSvgChart({ chartData, labs }: { chartData: ChartPoint[]; labs: LabUI[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (chartData.length < 1) return null;
  const W = 500, H = 220, pX = 50, pY = 30;
  const allPrices: number[] = [];
  chartData.forEach(d => labs.forEach(l => {
    const v = d[l.id] as number;
    if (typeof v === 'number') allPrices.push(v);
  }));
  if (allPrices.length === 0) return null;
  const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
  const sp = maxP - minP || 1;
  const gMin = Math.max(0, minP - sp * 0.15), gMax = maxP + sp * 0.15;
  const gX = (i: number) => chartData.length <= 1 ? W / 2 : pX + (i * (W - pX * 2)) / (chartData.length - 1);
  const gY = (v: number) => H - pY - ((v - gMin) / (gMax - gMin || 1)) * (H - pY * 2);

  return (
    <div className="relative border border-[#e5e5e0] bg-[#fdfdfc] p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible select-none"
        onMouseLeave={() => setHovered(null)}>
        {[0, 1, 2, 3, 4].map(idx => {
          const val = gMin + (idx / 4) * (gMax - gMin);
          const y = gY(val);
          return (
            <g key={idx} opacity="0.5">
              <line x1={pX} y1={y} x2={W - pX} y2={y} stroke="#e5e5e0" strokeWidth="1" strokeDasharray="2 3" />
              <text x={pX - 8} y={y + 3} textAnchor="end" fontSize="9" className="fill-[#1a1a1a] font-mono font-bold">
                {val.toFixed(1)} €
              </text>
            </g>
          );
        })}
        {chartData.map((d, i) => (
          <text key={i} x={gX(i)} y={H - pY + 14} textAnchor="middle" fontSize="8" className="fill-[#1a1a1a] font-mono font-bold uppercase opacity-50">
            {d.date.replace('-', '/')}
          </text>
        ))}
        {labs.map(lab => {
          const pts = chartData.map((d, i) => ({ x: gX(i), y: gY(d[lab.id] as number), v: d[lab.id] as number }))
            .filter(p => typeof p.v === 'number' && !isNaN(p.y));
          if (pts.length === 0) return null;
          if (pts.length === 1) return <circle key={lab.id} cx={pts[0].x} cy={pts[0].y} r={6} fill={lab.color} className="pointer-events-none" />;
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return (
            <g key={lab.id}>
              <path d={path} fill="none" stroke={lab.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        {chartData.map((d, i) => {
          const x = gX(i);
          const isHov = hovered === i;
          return (
            <g key={i}>
              <rect x={x - 15} y={pY} width={30} height={H - pY * 2} fill="transparent" className="cursor-pointer"
                onMouseEnter={() => setHovered(i)} onTouchStart={() => setHovered(i)} />
              {isHov && <line x1={x} y1={pY} x2={x} y2={H - pY} stroke="#1a1a1a" strokeWidth="1.2" strokeDasharray="2 2" className="pointer-events-none" />}
              {labs.map(lab => {
                const val = d[lab.id] as number;
                if (typeof val !== 'number') return null;
                const y = gY(val);
                return (
                  <circle key={lab.id} cx={x} cy={y} r={isHov ? 5 : 3.5} fill={lab.color} stroke="#fff" strokeWidth={isHov ? 2 : 1.2} className="pointer-events-none" />
                );
              })}
            </g>
          );
        })}
      </svg>
      {hovered !== null && chartData[hovered] && (
        <div
          className="absolute bg-[#1a1a1a] text-[#fffcf0] shadow-[2px_2px_0px_0px_#8a8a82] border border-[#1a1a1a] p-3 text-xs w-48 space-y-2 pointer-events-none"
          style={{ left: `${Math.min(Math.max(5, (gX(hovered) / W) * 100 - 22), 72)}%`, top: '30px' }}
        >
          <div className="pb-1 border-b border-white/10 text-[9px] uppercase tracking-widest text-[#8a8a82] font-mono font-bold">
            {fmtDate(chartData[hovered].date)}
          </div>
          <div className="space-y-1.5 font-mono text-[10.5px]">
            {labs.map(lab => {
              const price = chartData[hovered!][lab.id] as number;
              return typeof price === 'number' ? (
                <div key={lab.id} className="flex justify-between">
                  <span className="text-zinc-300 font-bold">{lab.name}</span>
                  <span className="font-extrabold">{price.toFixed(2)} €</span>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  tests: TestUI[];
  labs: LabUI[];
  categories: CategoryUI[];
  totalTests: number;
  lastUpdated: string;
}

export default function HomeClient({ tests, labs, categories, totalTests, lastUpdated }: Props) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'comparison' | 'cart' | 'trends' | 'locations'>('comparison');
  const [cartItems, setCartItems] = useState<string[]>([]);
  const cartFirstRender = useRef(true);
  const [visibleLabs, setVisibleLabs] = useState<string[]>(() => labs.map(l => l.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'cheapest' | 'savings'>('name');
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [historyCache, setHistoryCache] = useState<Record<string, HistoryPoint[]>>({});
  const [historyLoading, setHistoryLoading] = useState<Record<string, boolean>>({});
  const [trendsTestId, setTrendsTestId] = useState(tests[0]?.id ?? '');
  const [trendsRaw, setTrendsRaw] = useState<HistoryPoint[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [cityFilter, setCityFilter] = useState('Vilnius');
  const [locLabFilter, setLocLabFilter] = useState<string | null>(null);
  const [cartExpandedId, setCartExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const { search: fuseSearch, ready: fuseReady } = useSearchIndex();

  // ── Derived: active labs ───────────────────────────────────────────────────
  const activeLabs = useMemo(() => labs.filter(l => visibleLabs.includes(l.id)), [labs, visibleLabs]);

  // Labs with zero prices across all tests (not yet scraped)
  const emptyLabs = useMemo(() => new Set(
    labs.filter(lab => !tests.some(t => (t.prices[lab.id] ?? 0) > 0)).map(l => l.id)
  ), [labs, tests]);


  // ── Cart localStorage sync ─────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lab-cart');
      if (saved) setCartItems(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    if (cartFirstRender.current) { cartFirstRender.current = false; return; }
    try { localStorage.setItem('lab-cart', JSON.stringify(cartItems)); } catch {}
  }, [cartItems]);

  // ── Fetch trends when tab or test changes ──────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'trends' || !trendsTestId) return;
    setTrendsLoading(true);
    setTrendsRaw([]);
    fetch(`/api/price-history?id=${trendsTestId}`)
      .then(r => r.json())
      .then(d => { setTrendsRaw(Array.isArray(d) ? d : []); setTrendsLoading(false); })
      .catch(() => setTrendsLoading(false));
  }, [activeTab, trendsTestId]);

  // ── Filtered & sorted tests ────────────────────────────────────────────────
  const filteredTests = useMemo(() => {
    let result: TestUI[];

    if (searchTerm.trim() && fuseReady) {
      // Fuse.js search on the static index — returns ordered IDs
      const matches = fuseSearch(searchTerm.trim(), 50);
      const order = new Map(matches.map((m, i) => [String(m.id), i]));
      result = tests
        .filter(t => order.has(t.id) && (selectedCategory === 'all' || t.category === selectedCategory))
        .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
    } else {
      // No search term (or index not yet loaded) — show all with sort applied
      result = tests.filter(t => {
        const q = searchTerm.toLowerCase();
        const matchSearch = !q ||
          t.name.toLowerCase().includes(q) ||
          (t.latinName && t.latinName.toLowerCase().includes(q)) ||
          t.code.toLowerCase().includes(q);
        const matchCat = selectedCategory === 'all' || t.category === selectedCategory;
        return matchSearch && matchCat;
      });
      if (sortBy === 'name') {
        result = [...result].sort((a, b) => a.name.localeCompare(b.name, 'lt'));
      } else if (sortBy === 'cheapest') {
        result = [...result].sort((a, b) => {
          const pA = visibleLabs.map(l => a.prices[l]).filter(p => p > 0);
          const pB = visibleLabs.map(l => b.prices[l]).filter(p => p > 0);
          return (pA.length ? Math.min(...pA) : 999) - (pB.length ? Math.min(...pB) : 999);
        });
      } else {
        result = [...result].sort((a, b) => {
          const pA = visibleLabs.map(l => a.prices[l]).filter(p => p > 0);
          const pB = visibleLabs.map(l => b.prices[l]).filter(p => p > 0);
          const savA = pA.length > 1 ? Math.max(...pA) - Math.min(...pA) : 0;
          const savB = pB.length > 1 ? Math.max(...pB) - Math.min(...pB) : 0;
          return savB - savA;
        });
      }
    }

    return result;
  }, [tests, searchTerm, fuseReady, fuseSearch, selectedCategory, sortBy, visibleLabs]);

  const visibleTests = filteredTests.slice(0, visibleCount);

  // Reset pagination when filters change
  useEffect(() => { setVisibleCount(50); }, [searchTerm, selectedCategory, sortBy, visibleLabs]);

  // ── Cart computations ──────────────────────────────────────────────────────
  const cartTests = useMemo(() => tests.filter(t => cartItems.includes(t.id)), [tests, cartItems]);

  const labTotals = useMemo(() => activeLabs.map(lab => {
    const testsSum = cartTests.reduce((acc, t) => acc + (t.prices[lab.id] ?? 0), 0);
    const totalPrice = testsSum + (cartTests.length > 0 ? lab.samplingFee : 0);
    return { ...lab, testsSum, totalPrice };
  }).sort((a, b) => a.totalPrice - b.totalPrice), [activeLabs, cartTests]);

  const cheapestCartLab = labTotals[0] ?? null;
  const mostExpensiveCartLab = labTotals[labTotals.length - 1] ?? null;
  const maxPriceForChart = useMemo(() => Math.max(...labTotals.map(l => l.totalPrice), 1), [labTotals]);

  const splitStrategy = useMemo(() => {
    if (cartTests.length === 0) return null;
    const items = cartTests.map(test => {
      const ap = activeLabs
        .map(lab => ({ labId: lab.id, labName: lab.name, price: test.prices[lab.id] }))
        .filter(p => (p.price ?? 0) > 0) as { labId: string; labName: string; price: number }[];
      if (!ap.length) return null;
      const sorted = [...ap].sort((a, b) => a.price - b.price);
      return { testId: test.id, testName: test.name, testCode: test.code, bestPrice: sorted[0].price, bestLabId: sorted[0].labId, bestLabName: sorted[0].labName };
    }).filter(Boolean) as { testId: string; testName: string; testCode: string; bestPrice: number; bestLabId: string; bestLabName: string }[];

    const uniqueLabIds = Array.from(new Set(items.map(i => i.bestLabId)));
    const visitedLabs = activeLabs.filter(l => uniqueLabIds.includes(l.id));
    const totalTestsSum = items.reduce((acc, i) => acc + i.bestPrice, 0);
    const totalSamplingFees = visitedLabs.reduce((acc, l) => acc + l.samplingFee, 0);
    return { items, visitedLabs, totalTestsSum, totalSamplingFees, totalSplitCost: totalTestsSum + totalSamplingFees };
  }, [cartTests, activeLabs]);

  const splitComparison = useMemo(() => {
    if (!splitStrategy || !cheapestCartLab) return null;
    const diff = cheapestCartLab.totalPrice - splitStrategy.totalSplitCost;
    return { difference: Math.abs(diff), isSplitCheaper: diff > 0.05, visitedCount: splitStrategy.visitedLabs.length };
  }, [splitStrategy, cheapestCartLab]);

  const basketOptimization = useMemo((): BasketOptimization | null => {
    if (cartTests.length === 0) return null;
    return optimizeBasket(cartTests, activeLabs);
  }, [cartTests, activeLabs]);

  // ── Preset packages ────────────────────────────────────────────────────────
  const presetPackages = useMemo(() => [
    { name: 'Nuovargio paieška', description: 'BKT + Vitaminas D + Feritinas + TTH', icon: '⚡', color: 'border-amber-200 hover:border-amber-400 bg-amber-50/20', matchers: ['bendras kraujo', 'vitaminas d', 'feritinas', 'tirotropinas'] },
    { name: 'Cukrus & Medžiagų apykaita', description: 'BKT + Gliukozė + HbA1c + Lipidograma', icon: '🩸', color: 'border-rose-200 hover:border-rose-400 bg-rose-50/20', matchers: ['bendras kraujo', 'gliukoz', 'hemoglobin', 'lipid'] },
    { name: 'Skydliaukės skydas', description: 'TTH + FT4 + ATPO', icon: '🦋', color: 'border-sky-200 hover:border-sky-400 bg-sky-50/20', matchers: ['tirotropinas', 'tiroksinas', 'antikūnai'] },
  ].map(p => ({
    ...p,
    ids: p.matchers.map(m => tests.find(t => t.name.toLowerCase().includes(m.toLowerCase()))?.id).filter(Boolean) as string[],
  })), [tests]);

  // ── Live basket meter ──────────────────────────────────────────────────────
  const liveTotals = useMemo(() => {
    if (!cartItems.length) return [];
    return labTotals.map(l => l);
  }, [cartItems, labTotals]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleToggleLab = useCallback((id: string) => {
    setVisibleLabs(prev => {
      if (prev.includes(id)) return prev.length <= 1 ? prev : prev.filter(l => l !== id);
      return [...prev, id];
    });
  }, []);

  const handleToggleCart = useCallback((id: string) => {
    setCartItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedTestId === id) { setExpandedTestId(null); return; }
    setExpandedTestId(id);
    if (historyCache[id] === undefined) {
      setHistoryLoading(prev => ({ ...prev, [id]: true }));
      try {
        const res = await fetch(`/api/price-history?id=${id}`);
        const data = await res.json();
        setHistoryCache(prev => ({ ...prev, [id]: Array.isArray(data) ? data : [] }));
      } catch {
        setHistoryCache(prev => ({ ...prev, [id]: [] }));
      }
      setHistoryLoading(prev => ({ ...prev, [id]: false }));
    }
  }, [expandedTestId, historyCache]);

  // ── Computed chart data ────────────────────────────────────────────────────
  const trendsChartData = useMemo(() => buildChartData(trendsRaw, labs), [trendsRaw, labs]);
  const trendsActiveLabs = useMemo(() => labs.filter(l => {
    return trendsChartData.some(d => typeof d[l.id] === 'number');
  }), [labs, trendsChartData]);

  // ── Locations ──────────────────────────────────────────────────────────────
  const cityLabNames = useMemo(() => {
    const names = new Set(LAB_LOCATIONS.filter(l => l.city === cityFilter).map(l => l.labName));
    return Array.from(names);
  }, [cityFilter]);

  const filteredLocations = useMemo(() =>
    LAB_LOCATIONS.filter(l => l.city === cityFilter && (!locLabFilter || l.labName === locLabFilter)),
    [cityFilter, locLabFilter]);

  // Popular tests: id → display label mapping
  const POPULAR_TESTS: { id: string; label: string }[] = [
    { id: '168', label: 'BKT' },
    { id: '2195', label: 'TSH' },
    { id: '1073', label: 'Vitaminas D' },
    { id: '1428', label: 'Gliukozė' },
    { id: '274', label: 'Feritinas' },
    { id: '107', label: 'ALT' },
    { id: '1955', label: 'HbA1c' },
    { id: '1829', label: 'PSA' },
    { id: '212', label: 'Cholesterolis' },
    { id: '92', label: 'Vitaminas B12' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

      {/* Hero search bar */}
      <div className="bg-[#fdfdfc] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_0px_#1a1a1a] p-6 space-y-4">
        <div>
          <p className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#8a8a82] mb-2">Laboratorijų kainos · Lietuva</p>
          <h1 className="font-serif italic font-bold text-2xl sm:text-3xl text-[#1a1a1a] leading-tight">
            Raskite pigiausią kraujo tyrimo kainą
          </h1>
        </div>
        <div className="relative max-w-2xl">
          <Ic.Search c="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8a8a82]" />
          <input
            type="text"
            placeholder="Ieškoti tyrimo... (pvz. vitaminas D, TSH, gliukozė)"
            aria-label="Ieškoti tyrimo"
            className="w-full pl-11 pr-10 py-3.5 bg-[#f4f4f0] border-2 border-[#e5e5e0] rounded-none text-sm placeholder-[#8a8a82] focus:outline-none focus:border-[#1a1a1a] focus:bg-white transition text-[#1a1a1a]"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); if (activeTab !== 'comparison') setActiveTab('comparison'); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && fuseReady && searchTerm.trim()) {
                const top = fuseSearch(searchTerm.trim(), 1)[0];
                if (top) window.location.href = `/test/${top.id}`;
              }
            }}
          />
          {!fuseReady && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#8a8a82] border-t-transparent rounded-full animate-spin" />
          )}
          {fuseReady && searchTerm && (
            <button onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold px-2 py-1 bg-[#1a1a1a] text-white rounded-none">
              ×
            </button>
          )}
          {/* Live search dropdown */}
          {fuseReady && searchTerm.trim().length >= 2 && (() => {
            const hits = fuseSearch(searchTerm.trim(), 5);
            if (hits.length === 0) return null;
            return (
              <div className="absolute top-full left-0 right-0 z-30 mt-0.5 bg-[#fdfdfc] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_0px_#1a1a1a] divide-y divide-[#e5e5e0]">
                {hits.map(hit => (
                  <a key={hit.id} href={`/test/${hit.id}`}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-[#f4f4f0] transition-colors group"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-[#1a1a1a] font-medium group-hover:text-[#059669] transition-colors">{getDisplayName(hit.name_lt, hit.aliases)}</span>
                      {hit.name_en && <span className="ml-2 font-mono text-[10px] text-[#8a8a82]">{hit.name_en}</span>}
                    </div>
                    {hit.min_price !== null && (
                      <span className="font-mono font-bold text-[#059669] text-sm tabular-nums ml-4 shrink-0">€{hit.min_price.toFixed(2)}</span>
                    )}
                  </a>
                ))}
                <a href={`/search?q=${encodeURIComponent(searchTerm.trim())}`}
                  className="flex items-center justify-center px-4 py-2 bg-[#f4f4f0] hover:bg-[#e5e5e0] transition-colors font-mono text-[11px] text-[#8a8a82] uppercase tracking-wider">
                  Visos paieškos rezultatai →
                </a>
              </div>
            );
          })()}
        </div>
        {/* Popular tests chips */}
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8a8a82]">Dažniausiai ieškomi tyrimai:</p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_TESTS.map(({ id, label }) => (
              <a
                key={id}
                href={`/test/${id}`}
                className="px-3 py-1.5 rounded-none border-2 border-[#1a1a1a] bg-white hover:bg-[#ecfdf5] hover:border-[#059669] hover:text-[#059669] font-mono text-[11px] text-[#1a1a1a] transition-colors font-bold uppercase tracking-wider"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Category grid */}
      {categories.length > 0 && (
        <div className="space-y-3">
          <p className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#8a8a82]">Kategorijos:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {categories.slice(0, 8).map(cat => (
              <a key={cat.id} href={`/category/${cat.id}`}
                className="flex items-center gap-2.5 px-4 py-3 bg-[#fdfdfc] border-2 border-[#1a1a1a] hover:bg-[#f4f4f0] transition-colors group"
              >
                {cat.icon && <span className="text-lg shrink-0">{cat.icon}</span>}
                <span className="font-mono text-[11px] font-bold text-[#1a1a1a] uppercase tracking-wider leading-tight group-hover:text-[#059669] transition-colors">{cat.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex xl:flex-row flex-col xl:items-center justify-between gap-4 border-b-2 border-[#1a1a1a] pb-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'comparison', icon: <Ic.File c="w-4 h-4" />, label: 'Tyrimų kainų palyginimas' },
            { id: 'cart', icon: <Ic.Cart c="w-4 h-4" />, label: 'Krepšelio analizė', badge: cartItems.length },
            { id: 'trends', icon: <Ic.Trend c="w-4 h-4" />, label: 'Kainų tendencijos' },
            { id: 'locations', icon: <Ic.Map c="w-4 h-4" />, label: 'Klinikų adresai' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wider uppercase transition shrink-0 rounded-none border-t border-x ${
                activeTab === tab.id
                  ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                  : 'bg-white hover:bg-[#f4f4f0] border-[#e5e5e0] text-[#63635e] hover:text-[#1a1a1a]'
              }`}
            >
              {tab.icon} {tab.label}
              {tab.badge ? (
                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-none ${activeTab === tab.id ? 'bg-[#fffcf0] text-[#1a1a1a]' : 'bg-[#059669] text-white'}`}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="text-[11px] font-mono uppercase text-[#8a8a82] shrink-0 tracking-wider">
          Kainos nurodytos su PVM · Laboratorijos nepriklausomos
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[450px]">

        {/* ── COMPARISON TAB ── */}
        {activeTab === 'comparison' && (
          <div className="space-y-6">

            {/* Live basket meter */}
            {cartItems.length > 0 && liveTotals.length > 0 && (
              <div className="bg-white border-2 border-[#1a1a1a] p-5 space-y-4 shadow-[4px_4px_0px_0px_#059669]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5e5e0]">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#059669] animate-pulse" />
                      <h4 className="text-[10.5px] font-bold font-mono text-[#059669] uppercase tracking-wider">Tiesioginis kainų seklys</h4>
                    </div>
                    <p className="text-xs text-[#8a8a82]">Bendros jūsų pasirinktų tyrimų kainos su paėmimo mokesčiais:</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setCartItems([])}
                      className="text-[9px] font-mono font-bold px-2 py-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-none uppercase">
                      Išvalyti krepšelį
                    </button>
                    <button onClick={() => setActiveTab('cart')}
                      className="text-[9.5px] font-mono font-bold px-3.5 py-1.5 bg-[#059669] text-white hover:bg-[#047857] rounded-none uppercase tracking-wide">
                      Palyginti skaidant →
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  {liveTotals.map((lab, idx) => (
                    <div key={lab.id} className={`border-2 p-3 flex flex-col gap-2.5 rounded-none ${idx === 0 ? 'border-[#059669] bg-[#ecfdf5]/20 shadow-[2px_2px_0px_0px_#059669]' : 'border-gray-200 hover:border-[#1a1a1a]'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-xs text-[#1a1a1a]">{lab.name}</span>
                        {idx === 0 && <span className="text-[8px] font-bold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] px-1 py-0.5 rounded-none uppercase font-mono">Pigiausia</span>}
                      </div>
                      <div>
                        <p className="text-[17px] font-mono font-black text-[#1a1a1a] leading-none">{lab.totalPrice.toFixed(2)} €</p>
                        <p className="text-[9.5px] text-[#8a8a82]">({lab.testsSum.toFixed(2)} € + {lab.samplingFee.toFixed(2)} € paėmimas)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search & filter panel */}
            <div className="bg-[#fdfdfc] border-2 border-[#1a1a1a] p-6 space-y-5 shadow-[4px_4px_0px_0px_#1a1a1a]">
              {/* Lab toggles */}
              <div className="pb-4 border-b border-[#e5e5e0] space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <h4 className="text-[10.5px] font-bold font-mono uppercase tracking-widest text-[#1a1a1a]">Palyginti laboratorijas:</h4>
                  <span className="text-[10px] text-[#8a8a82] font-mono uppercase">Aktyvios: <span className="font-extrabold text-[#1a1a1a]">{visibleLabs.length}</span> iš {labs.length}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {labs.map(lab => {
                    const isChecked = visibleLabs.includes(lab.id);
                    return (
                      <button key={lab.id} onClick={() => handleToggleLab(lab.id)}
                        className={`px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider border-2 rounded-none flex items-center gap-2.5 transition ${
                          isChecked ? 'bg-white border-[#1a1a1a] text-[#1a1a1a] shadow-[2px_2px_0px_0px_#1a1a1a]' : 'bg-[#f4f4f0] border-[#e5e5e0] text-[#8a8a82] hover:border-[#1a1a1a] hover:text-[#1a1a1a]'
                        }`}
                        title={`Paėmimo mokestis: ${lab.samplingFee.toFixed(2)} €`}
                      >
                        <span className="w-2.5 h-2.5 border shrink-0" style={{ backgroundColor: isChecked ? lab.color : 'transparent', borderColor: isChecked ? lab.color : '#8a8a82', borderStyle: isChecked ? 'solid' : 'dashed' }} />
                        {lab.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sort */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[#f4f4f0] border border-[#e5e5e0] text-[#1a1a1a] text-xs font-mono rounded-none shrink-0">
                  <Ic.Filter c="w-3.5 h-3.5" /> <span>Rūšiuoti:</span>
                </div>
                {([['name', 'A–Ž'], ['cheapest', 'Pigiausius'], ['savings', 'Didžiausią skirtumą']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setSortBy(val)}
                    className={`px-3.5 py-2 text-xs font-bold rounded-none border transition uppercase tracking-wider shrink-0 ${
                      sortBy === val ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white' : 'bg-white border-[#e5e5e0] text-[#63635e] hover:border-[#1a1a1a]'
                    }`}>{label}
                  </button>
                ))}
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[#e5e5e0]">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 text-[10px] font-medium rounded-none transition uppercase tracking-widest ${
                      selectedCategory === cat.id ? 'bg-[#1a1a1a] text-white border border-[#1a1a1a]' : 'bg-[#f4f4f0] hover:bg-[#e5e5e0] text-[#63635e] border border-[#e5e5e0]'
                    }`}>{cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Cart tip */}
            {cartItems.length > 0 && (
              <div className="p-4 bg-[#ecfdf5] border-2 border-[#059669] flex flex-col sm:flex-row items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#059669]" />
                  </span>
                  <p>Pasirinkote <span className="font-extrabold text-[#1a1a1a] font-mono">{cartItems.length} tyrimus</span>.</p>
                </div>
                <button onClick={() => setActiveTab('cart')}
                  className="flex items-center gap-1.5 font-bold text-[#059669] hover:text-[#047857] px-4 py-2 bg-white border border-[#059669] rounded-none transition uppercase tracking-wider text-[11px]">
                  Peržiūrėti krepšelį →
                </button>
              </div>
            )}

            {/* Results stats + bulk actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#63635e] bg-[#fdfdfc] p-3 px-4 border-2 border-[#1a1a1a] gap-2.5">
              <div>Rodoma: <span className="font-extrabold text-[#1a1a1a]">{filteredTests.length}</span> tyrimų</div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setCartItems(prev => Array.from(new Set([...prev, ...filteredTests.map(t => t.id)])))}
                  className="px-2.5 py-1 bg-[#f4f4f0] border border-[#e5e5e0] hover:bg-[#ecfdf5] hover:text-[#059669] hover:border-[#a7f3d0] font-mono font-bold uppercase text-[10px] transition">
                  + Pridėti visus ({filteredTests.length})
                </button>
                {cartItems.length > 0 && (
                  <button onClick={() => setCartItems([])}
                    className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-mono font-bold uppercase text-[10px] transition flex items-center gap-1">
                    <Ic.Trash c="w-3 h-3" /> Išvalyti krepšelį
                  </button>
                )}
              </div>
            </div>

            {/* Comparison table */}
            <div className="bg-[#fdfdfc] border-2 border-[#1a1a1a] overflow-hidden">
              {/* Desktop header */}
              <div className="hidden md:grid grid-cols-12 gap-2 bg-[#f4f4f0] border-b-2 border-[#1a1a1a] px-6 py-4 text-xs font-bold text-[#1a1a1a] uppercase tracking-wider items-center">
                <div className="col-span-5 font-mono">Tyrimo Pavadinimas</div>
                <div className="col-span-6 grid gap-2 text-center" style={{ gridTemplateColumns: `repeat(${activeLabs.length}, minmax(0, 1fr))` }}>
                  {activeLabs.map(lab => (
                    <div key={lab.id} className="px-1 py-1 bg-white border border-[#e5e5e0] text-[#1a1a1a] font-mono text-[10px]">{lab.name}</div>
                  ))}
                </div>
                <div className="col-span-1 text-right font-mono text-[11px]">Krepšelis</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-[#e5e5e0]">
                {filteredTests.length === 0 ? (
                  <div className="text-center py-16 px-4 space-y-3">
                    <div className="mx-auto w-12 h-12 bg-[#f4f4f0] flex items-center justify-center text-[#8a8a82] border border-[#e5e5e0]">
                      <Ic.Search c="w-5 h-5" />
                    </div>
                    <p className="text-[#1a1a1a] font-serif italic text-lg">Nerasta tyrimų pagal užklausą</p>
                    <p className="text-xs text-[#8a8a82] max-w-sm mx-auto">Pabandykite trumpesnį pavadinimą arba pasirinkite kitą kategoriją.</p>
                  </div>
                ) : (
                  visibleTests.map(test => {
                    const prices = activeLabs.map(l => test.prices[l.id]).filter(p => (p ?? 0) > 0);
                    const minPrice = prices.length ? Math.min(...prices) : 0;
                    const maxPrice = prices.length ? Math.max(...prices) : 0;
                    const maxSavings = maxPrice - minPrice;
                    const cheapestLabIds = activeLabs.filter(l => (test.prices[l.id] ?? 0) === minPrice && minPrice > 0).map(l => l.id);
                    const isInCart = cartItems.includes(test.id);
                    const isExpanded = expandedTestId === test.id;
                    const historyRaw = historyCache[test.id] ?? null;
                    const historyChart = historyRaw ? buildChartData(historyRaw, activeLabs) : null;
                    const histLoading = historyLoading[test.id] ?? false;

                    return (
                      <div key={test.id} className={`transition-colors duration-150 ${isExpanded ? 'bg-[#fffcf0]' : 'hover:bg-[#f9f9f6]'}`}>
                        {/* Row grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-2 px-4 md:px-6 py-4 items-center">
                          {/* Test info */}
                          <div className="col-span-1 md:col-span-5 space-y-1 pr-2">
                            <div className="flex items-start gap-2.5">
                              <button onClick={() => toggleExpand(test.id)} className="mt-0.5 shrink-0 hover:scale-110 transition">
                                {isExpanded ? <Ic.Up c="w-4 h-4 text-[#059669]" /> : <Ic.Down c="w-4 h-4 text-[#1a1a1a]" />}
                              </button>
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span onClick={() => toggleExpand(test.id)} title={test.name}
                                    className="font-bold text-[#1a1a1a] hover:text-[#059669] cursor-pointer text-sm leading-snug transition-colors truncate max-w-[220px] block">
                                    {test.name}
                                  </span>
                                  {test.code !== '—' && (
                                    <span className="px-1.5 py-0.5 bg-[#f4f4f0] text-[9px] font-mono font-bold text-[#1a1a1a] tracking-wider border border-[#e5e5e0]">
                                      {test.code}
                                    </span>
                                  )}
                                  {test.isStale && (
                                    <span className="px-1.5 py-0.5 bg-[#fffcf0] border border-[#f0e6c5] text-[9px] font-mono font-bold text-[#856d2b] flex items-center gap-0.5 uppercase">
                                      <span className="w-1 h-1 rounded-full bg-[#d4a017] animate-pulse inline-block" /> kintama
                                    </span>
                                  )}
                                </div>
                                {test.latinName && <p className="text-xs text-[#8a8a82] italic font-serif">{test.latinName}</p>}
                              </div>
                            </div>
                          </div>

                          {/* Prices grid */}
                          <div className="col-span-1 md:col-span-6 grid gap-1 md:gap-2 text-center mt-2 md:mt-0"
                            style={{ gridTemplateColumns: `repeat(${activeLabs.length}, minmax(0, 1fr))` }}>
                            {activeLabs.map(lab => {
                              const price = test.prices[lab.id];
                              const isCheap = cheapestLabIds.includes(lab.id) && price !== undefined;
                              return (
                                <div key={lab.id} className="flex flex-col md:block justify-center items-center py-2 px-1 border border-[#e5e5e0] bg-white">
                                  <span className="text-[9px] font-bold text-[#8a8a82] md:hidden block mb-1 font-mono uppercase">{lab.name}</span>
                                  <div className={`text-xs md:text-sm font-bold px-1 py-0.5 w-full text-center ${isCheap ? 'text-[#059669] font-black bg-[#ecfdf5] border-l-2 border-[#059669]' : 'text-[#1a1a1a]'}`}>
                                    {price
                                      ? <>{price.toFixed(2)} €{isCheap && <span className="text-[10px] text-[#059669] font-mono ml-0.5">★</span>}</>
                                      : emptyLabs.has(lab.id)
                                        ? <span className="text-[9px] font-mono text-[#8a8a82] italic normal-case tracking-normal">Netrukus</span>
                                        : '—'
                                    }
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Cart button */}
                          <div className="col-span-1 md:col-span-1 text-right flex md:block items-center justify-between gap-4 mt-1 md:mt-0 pt-2.5 md:pt-0 border-t md:border-0 border-[#e5e5e0]">
                            <div className="md:hidden">
                              {maxSavings > 0.01 ? (
                                <span className="text-[11px] font-bold text-[#059669] bg-[#ecfdf5] px-2 py-1 border border-[#a7f3d0]">Sutaupoma iki {maxSavings.toFixed(2)} €</span>
                              ) : <span className="text-[11px] text-[#8a8a82] italic">Vienodos kainos</span>}
                            </div>
                            <button onClick={() => handleToggleCart(test.id)}
                              className={`p-2 rounded-none transition flex items-center justify-center w-full md:w-10 h-10 border-2 ${
                                isInCart ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white' : 'bg-[#f4f4f0] hover:bg-[#ecfdf5] text-[#1a1a1a] hover:text-[#059669] border-[#e5e5e0] hover:border-[#059669]'
                              }`}>
                              {isInCart
                                ? <span className="flex items-center gap-1 md:block"><Ic.Check c="w-4 h-4 md:mx-auto" /><span className="text-xs font-mono font-bold md:hidden uppercase">Pasirinktas</span></span>
                                : <span className="flex items-center gap-1.5 md:block"><Ic.Cart c="w-4 h-4 md:mx-auto" /><span className="text-xs font-mono font-bold md:hidden uppercase">Pridėti</span></span>
                              }
                            </button>
                          </div>
                        </div>

                        {/* Expanded drawer */}
                        {isExpanded && (
                          <div className="border-t border-[#e5e5e0] bg-[#fbfdfa] p-5 md:p-6 space-y-6">
                            <div className="flex flex-col lg:flex-row gap-6 justify-between">
                              {/* Description */}
                              <div className="space-y-3 flex-1 max-w-2xl">
                                <h4 className="text-[10px] font-bold font-mono uppercase tracking-widest text-[#8a8a82]">Informacija:</h4>
                                <h3 className="text-lg font-serif italic font-bold text-[#1a1a1a]">{test.name}</h3>
                                <div className="flex flex-wrap gap-2.5 pt-1.5">
                                  {test.code !== '—' && (
                                    <span className="text-xs bg-[#f4f4f0] border border-[#e5e5e0] px-2 py-1 text-[#1a1a1a] font-mono">
                                      Kodas: <span className="font-extrabold">{test.code}</span>
                                    </span>
                                  )}
                                  {test.latinName && (
                                    <span className="text-xs bg-[#f4f4f0] border border-[#e5e5e0] px-2 py-1 text-[#1a1a1a] italic font-serif">
                                      {test.latinName}
                                    </span>
                                  )}
                                  {test.updateDate && (
                                    <span className="text-xs bg-[#f4f4f0] border border-[#e5e5e0] px-2 py-1 text-[#1a1a1a] font-mono">
                                      Atnaujinta: {test.updateDate}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Booking panel */}
                              <div className="bg-[#fcfcfb] border-2 border-[#1a1a1a] p-5 lg:w-96 space-y-4 shrink-0 shadow-[2px_2px_0px_0px_#1a1a1a]">
                                <div className="flex items-center gap-2 pb-2 border-b border-[#e5e5e0]">
                                  <span className="text-[11px] font-bold font-mono text-[#1a1a1a] uppercase tracking-wider">Klinikų šaltiniai:</span>
                                </div>
                                <div className="space-y-3">
                                  {activeLabs.map(lab => {
                                    const price = test.prices[lab.id];
                                    const url = test.bookingUrls[lab.id];
                                    return (
                                      <div key={lab.id} className="flex justify-between items-center text-xs gap-4 pb-1 border-b border-dashed border-[#e5e5e0] last:border-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lab.color }} />
                                          <span className="font-bold text-[#1a1a1a]">{lab.name}:</span>
                                          <span className="bg-[#f4f4f0] text-[#1a1a1a] px-1.5 py-0.5 font-extrabold font-mono">
                                            {price ? `${price.toFixed(2)} €` : emptyLabs.has(lab.id) ? <span className="text-[#8a8a82] italic font-normal text-[10px]">Netrukus</span> : '—'}
                                          </span>
                                          <span className="text-[#8a8a82] text-[10px] font-mono">(+ {lab.samplingFee.toFixed(2)} € paėmimas)</span>
                                        </div>
                                        {url && (
                                          <a href={url} target="_blank" rel="noopener noreferrer"
                                            className="shrink-0 px-3 py-1 bg-[#059669] hover:bg-[#047857] text-white font-bold uppercase tracking-wider text-[9px] transition-colors whitespace-nowrap">
                                            Atidaryti ↗
                                          </a>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                {maxSavings > 0.01 && (
                                  <div className="bg-[#ecfdf5] p-3 border border-[#a7f3d0] flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-[#059669] uppercase tracking-wide">Skirtumas:</span>
                                    <span className="text-xs font-black font-mono text-[#059669]">{maxSavings.toFixed(2)} € / vnt</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Price history chart */}
                            <div className="pt-6 border-t border-[#e5e5e0]">
                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                                <div className="lg:col-span-4 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="p-1 px-1.5 bg-[#1a1a1a] text-[#fdfdfc] text-[10px] font-mono uppercase font-bold">% Istorija</span>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a]">Kainų pokyčiai</h4>
                                  </div>
                                  <div className="flex flex-wrap gap-2.5 pt-1.5">
                                    {activeLabs.map(lab => (
                                      <div key={lab.id} className="flex items-center gap-1.5 text-[10.5px] font-mono font-bold text-[#1a1a1a]">
                                        <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: lab.color }} />
                                        {lab.name}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="lg:col-span-8 bg-white border border-[#e5e5e0] p-4 flex justify-center items-center">
                                  {histLoading ? (
                                    <p className="text-xs text-[#8a8a82] font-mono">Kraunama...</p>
                                  ) : historyChart && historyChart.length >= 1 ? (
                                    <div className="w-full"><FullSvgChart chartData={historyChart} labs={activeLabs} /></div>
                                  ) : (
                                    <p className="text-xs text-[#8a8a82] font-mono italic">Kainų istorija dar kaupiama</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {filteredTests.length > visibleCount && (
                <div className="border-t-2 border-[#1a1a1a] px-6 py-4 bg-[#f4f4f0] flex items-center justify-between gap-4">
                  <span className="font-mono text-[11px] text-[#8a8a82] uppercase tracking-wider">
                    Rodoma {visibleCount} iš {filteredTests.length}
                  </span>
                  <button
                    onClick={() => setVisibleCount(c => c + 50)}
                    className="px-5 py-2 bg-[#1a1a1a] text-white font-mono font-bold text-[11px] uppercase tracking-wider hover:bg-[#333] transition-colors"
                  >
                    Rodyti daugiau →
                  </button>
                </div>
              )}
            </div>

            {/* Preset packages */}
            <div className="bg-[#fffcf0] border-2 border-[#1a1a1a] p-5 space-y-4 shadow-[4px_4px_0px_0px_#1a1a1a]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f0e6c5] pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#1a1a1a] text-[#fffcf0] text-[10px] font-mono uppercase font-black tracking-wider">✦ Ruošiniai</span>
                  <h3 className="text-sm font-bold text-[#1a1a1a] uppercase tracking-wider">Populiarūs tyrimų paketo ruošiniai:</h3>
                </div>
                <span className="text-[10px] text-[#8a8a82] italic">Spustelkite, kad akimirksniu sukurtumėte tyrimų paketą</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                {presetPackages.map(preset => {
                  const isSelected = preset.ids.length > 0 && preset.ids.every(id => cartItems.includes(id));
                  return (
                    <div key={preset.name}
                      className={`border-2 p-4 flex flex-col justify-between space-y-3 rounded-none relative overflow-hidden ${preset.color} ${isSelected ? 'border-[#1a1a1a] shadow-[2px_2px_0px_0px_#1a1a1a] bg-white' : 'border-[#e5e5e0]'}`}
                    >
                      {isSelected && <div className="absolute top-0 right-0 bg-[#1a1a1a] text-white px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-widest">Aktyvus</div>}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{preset.icon}</span>
                          <h4 className="font-extrabold text-xs text-[#1a1a1a] uppercase tracking-wide">{preset.name}</h4>
                        </div>
                        <p className="text-[10.5px] text-[#8a8a82] leading-snug">{preset.description}</p>
                      </div>
                      <div className="pt-2 border-t border-dashed border-[#e5e5e0] flex items-center justify-between gap-2.5">
                        <div className="text-[9px] text-[#8a8a82] font-mono">({preset.ids.length} tyrimai)</div>
                        <button
                          onClick={() => setCartItems(preset.ids)}
                          disabled={preset.ids.length === 0}
                          className={`text-[9.5px] font-mono font-bold px-3 py-1.5 uppercase tracking-wider rounded-none border ${
                            isSelected ? 'bg-[#059669] text-white border-[#059669]' : 'bg-[#1a1a1a] text-white border-[#1a1a1a] hover:bg-[#333]'
                          } disabled:opacity-40`}
                        >
                          {isSelected ? '✓ Sukonstruota' : 'Užpildyti paketą'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── CART TAB ── */}
        {activeTab === 'cart' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-serif italic font-bold text-[#1a1a1a]">Tyrimų paketo analizė ({cartItems.length})</h2>
                <p className="text-sm text-[#63635e]">Raskite finansinį optimumą — geriausią bendrą sumą vienoje laboratorijoje arba skaidant.</p>
              </div>
              {cartItems.length > 0 && (
                <button onClick={() => setCartItems([])}
                  className="text-[10px] font-mono font-bold text-red-700 flex items-center gap-1.5 px-4 py-2 bg-[#fffcf0] border border-[#f0e6c5] hover:bg-red-50 rounded-none transition self-start uppercase tracking-wider">
                  <Ic.Trash c="w-4 h-4" /> Išvalyti krepšelį
                </button>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="bg-[#fcfcfb] border-2 border-dashed border-[#e5e5e0] text-center py-20 px-4 space-y-5">
                <div className="mx-auto w-14 h-14 bg-[#f4f4f0] text-[#1a1a1a] flex items-center justify-center border border-[#e5e5e0]">
                  <Ic.Cart c="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-serif italic font-bold text-[#1a1a1a]">Krepšelis tuščias</h4>
                  <p className="text-xs text-[#8a8a82] max-w-sm mx-auto">Pridėkite tyrimus iš palyginimo sąrašo paspaudę krepšelio piktogramą.</p>
                </div>
                <button onClick={() => setActiveTab('comparison')}
                  className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#333] text-white font-bold text-xs px-6 py-3 rounded-none shadow-[2px_2px_0px_0px_#8a8a82] uppercase tracking-wider font-mono">
                  Pasirinkti tyrimus →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left panel */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Item list */}
                  <div className="bg-[#fdfdfc] border-2 border-[#1a1a1a] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold font-mono uppercase tracking-widest text-[#8a8a82]">Jūsų sukurtas paketas:</h3>
                      <span className="text-[10px] font-mono bg-[#1a1a1a] text-white px-2 py-0.5">{cartTests.length} vnt</span>
                    </div>
                    <div className="divide-y divide-[#e5e5e0] max-h-[440px] overflow-y-auto pr-1 space-y-2">
                      {cartTests.map(test => {
                        const isExp = cartExpandedId === test.id;
                        const hRaw = historyCache[test.id] ?? null;
                        const hChart = hRaw ? buildChartData(hRaw, activeLabs) : null;
                        return (
                          <div key={test.id} className="pt-3.5 first:pt-0 space-y-3">
                            <div className="flex items-start justify-between gap-3 text-sm">
                              <div onClick={async () => {
                                setCartExpandedId(prev => prev === test.id ? null : test.id);
                                if (!historyCache[test.id]) {
                                  setHistoryLoading(p => ({ ...p, [test.id]: true }));
                                  try {
                                    const r = await fetch(`/api/price-history?id=${test.id}`);
                                    const d = await r.json();
                                    setHistoryCache(p => ({ ...p, [test.id]: Array.isArray(d) ? d : [] }));
                                  } catch { setHistoryCache(p => ({ ...p, [test.id]: [] })); }
                                  setHistoryLoading(p => ({ ...p, [test.id]: false }));
                                }
                              }} className="space-y-0.5 cursor-pointer hover:text-[#059669] flex-1">
                                <div className="flex items-center gap-1.5">
                                  {isExp ? <Ic.Up c="w-3.5 h-3.5 text-[#059669]" /> : <Ic.Down c="w-3.5 h-3.5" />}
                                  <p className="font-bold text-[#1a1a1a] leading-none text-xs hover:underline">{test.name}</p>
                                </div>
                                <div className="flex gap-2 items-center text-[10.5px] pl-5">
                                  {test.code !== '—' && <span className="font-mono bg-[#f4f4f0] text-[#1a1a1a] px-1 text-[8.5px] font-bold border border-[#e5e5e0]">{test.code}</span>}
                                  {test.latinName && <span className="italic font-serif text-[#8a8a82] text-[10px] line-clamp-1">{test.latinName}</span>}
                                </div>
                              </div>
                              <button onClick={() => setCartItems(p => p.filter(id => id !== test.id))}
                                className="p-1 text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-none transition shrink-0">
                                <Ic.Trash c="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {isExp && (
                              <div className="pl-5 pr-1 py-3 bg-[#fffcf0] border border-[#f0e6c5] space-y-2">
                                <div className="flex justify-between items-center bg-white border border-[#e5e5e0] px-2 py-1 text-[9.5px] font-mono font-bold">
                                  <span className="text-[#8a8a82] uppercase">Kainų retrospektyva</span>
                                  <span className="text-[#059669]">Atnaujinama</span>
                                </div>
                                {historyLoading[test.id] ? (
                                  <p className="text-[9px] text-[#8a8a82] font-mono">Kraunama...</p>
                                ) : hChart && hChart.length >= 1 ? (
                                  <MiniSvgChart chartData={hChart} labs={activeLabs} />
                                ) : (
                                  <p className="text-[9px] text-[#8a8a82] font-mono italic">Istorija dar kaupiama</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Lab totals */}
                    <div className="pt-4 border-t-2 border-[#1a1a1a] space-y-2.5 text-xs">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#8a8a82] tracking-wider font-mono">
                        <span>Laboratorija</span><span>Tyrimų suma</span>
                      </div>
                      {labTotals.map(lab => (
                        <div key={lab.id} className="flex justify-between items-center">
                          <span className="text-[#1a1a1a] font-bold">{lab.name}</span>
                          <span className="text-[#1a1a1a] font-mono font-bold bg-[#f4f4f0] px-1.5 border border-[#e5e5e0]">{lab.testsSum.toFixed(2)} €</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sampling fee notice */}
                  <div className="bg-[#fffcf0] border-2 border-[#f0e6c5] p-5 text-xs text-[#856d2b] space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-[#1a1a1a] uppercase tracking-wider font-mono text-[10px]">
                      <span>?</span><span>Mėginio paėmimo mokestis: kas tai?</span>
                    </div>
                    <p className="leading-relaxed text-[11.5px]">
                      Atvykus į kliniką, prie tyrimo kainos visada pridedamas vienkartinis kraujo paėmimo mokestis:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[11.5px]">
                      {activeLabs.map(lab => (
                        <li key={lab.id}><span className="font-extrabold text-[#1a1a1a]">{lab.name}</span>: {lab.samplingFee.toFixed(2)} €</li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-[#8a8a82] leading-relaxed pt-1 italic">
                      Įtraukiame vieną paėmimo mokestį kiekvienoje laboratorijoje — kraują priduodate vieną kartą.
                    </p>
                  </div>
                </div>

                {/* Right panel */}
                <div className="lg:col-span-7 space-y-6">
                  {basketOptimization && (() => {
                    const best = basketOptimization.singleLabOptions[0] ?? null;
                    const split = basketOptimization.splitOption;
                    const splitSaves = best && split ? best.total - split.total : 0;
                    const splitIsCheaper = splitSaves > 0.05;

                    return (
                      <>
                        {/* ── Section A: Coverage matrix ── */}
                        <div className="bg-[#fdfdfc] border-2 border-[#1a1a1a] overflow-hidden">
                          <div className="px-5 py-3 border-b-2 border-[#1a1a1a] bg-[#f4f4f0]">
                            <h3 className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#8a8a82]">Tyrimų prieinamumas laboratorijose</h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-[#e5e5e0]">
                                  <th className="text-left px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#8a8a82] font-bold bg-[#f4f4f0] min-w-[120px]">Tyrimas</th>
                                  {activeLabs.map(lab => (
                                    <th key={lab.id} className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#8a8a82] font-bold text-center bg-[#f4f4f0] whitespace-nowrap">
                                      {lab.name}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#e5e5e0]">
                                {cartTests.map(test => {
                                  const isUnavailable = activeLabs.every(l => (test.prices[l.id] ?? 0) === 0);
                                  const pricesForTest = activeLabs.map(l => test.prices[l.id]).filter(Boolean) as number[];
                                  const minForTest = pricesForTest.length ? Math.min(...pricesForTest) : null;
                                  return (
                                    <tr key={test.id} className={isUnavailable ? 'bg-[#fffcf0]' : 'hover:bg-[#f9f9f6]'}>
                                      <td className="px-4 py-2.5 font-medium text-[#1a1a1a] max-w-[160px]">
                                        <span className="block truncate" title={test.name}>{test.name}</span>
                                        {isUnavailable && <span className="text-[9px] font-mono text-[#856d2b]">nėra kainų</span>}
                                      </td>
                                      {activeLabs.map(lab => {
                                        const price = test.prices[lab.id];
                                        const isCheapest = price !== undefined && price === minForTest && (pricesForTest.length > 1);
                                        return (
                                          <td key={lab.id} className="px-3 py-2.5 text-center whitespace-nowrap">
                                            {price ? (
                                              <span className={`font-mono font-bold tabular-nums ${isCheapest ? 'text-[#059669]' : 'text-[#1a1a1a]'}`}>
                                                {isCheapest && <span className="text-[9px] mr-0.5">★</span>}€{price.toFixed(2)}
                                              </span>
                                            ) : (
                                              <span className="text-[#856d2b] font-mono font-bold text-base leading-none">—</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Coverage gap warning */}
                        {basketOptimization.coverageGaps.length > 0 && (
                          <div className="bg-[#fffcf0] border-2 border-[#f0e6c5] p-4 space-y-2">
                            <p className="font-mono font-bold text-[11px] uppercase tracking-wider text-[#856d2b]">
                              ⚠ Šių tyrimų neatlieka nė viena laboratorija:
                            </p>
                            {basketOptimization.coverageGaps.map(gap => (
                              <p key={gap.test.id} className="text-xs text-[#856d2b]">• {gap.test.name}</p>
                            ))}
                          </div>
                        )}

                        {/* ── Section B: Three options ── */}
                        {best && split ? (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                              {/* Option 1: Pigiausia viena laboratorija */}
                              <div className="border-2 border-[#059669] bg-[#ecfdf5]/30 p-4 space-y-3 shadow-[2px_2px_0px_0px_#059669]">
                                <div>
                                  <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#059669]">1 Variantas</span>
                                  <h4 className="font-bold text-xs text-[#1a1a1a] mt-1 leading-tight">Pigiausia viena laboratorija</h4>
                                </div>
                                <div className="space-y-1.5">
                                  {basketOptimization.singleLabOptions.slice(0, 4).map((opt, i) => (
                                    <div key={opt.lab.id} className={`flex items-center justify-between gap-2 py-1.5 border-b border-[#e5e5e0] last:border-0 ${i === 0 ? 'pb-2' : ''}`}>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {i === 0 && <span className="text-[#059669] font-bold text-[10px] shrink-0">★</span>}
                                        <span className={`text-xs font-bold truncate ${i === 0 ? 'text-[#059669]' : 'text-[#1a1a1a]'}`}>{opt.lab.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`font-mono font-bold tabular-nums text-sm ${i === 0 ? 'text-[#059669]' : 'text-[#1a1a1a]'}`}>€{opt.total.toFixed(2)}</span>
                                        {opt.lab.bookingUrl && (
                                          <a href={opt.lab.bookingUrl} target="_blank" rel="noopener noreferrer"
                                            className="text-[8.5px] font-mono font-bold px-1.5 py-0.5 bg-[#059669] hover:bg-[#047857] text-white transition whitespace-nowrap">
                                            Atidaryti ↗
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-[9.5px] text-[#8a8a82] font-mono">Su paėmimo mokesčiu (€{best.lab.samplingFee.toFixed(2)})</p>
                              </div>

                              {/* Option 2: Pigiausia kombinacija */}
                              <div className="border-2 border-[#1a1a1a] p-4 space-y-3">
                                <div>
                                  <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#8a8a82]">2 Variantas</span>
                                  <h4 className="font-bold text-xs text-[#1a1a1a] mt-1 leading-tight">Pigiausia kombinacija</h4>
                                </div>
                                <div>
                                  <div className="font-mono font-black text-2xl text-[#1a1a1a] tabular-nums">€{split.total.toFixed(2)}</div>
                                  <div className="text-[10px] text-[#8a8a82] font-mono mt-0.5">
                                    {split.labsUsed.length} laboratorij{split.labsUsed.length === 1 ? 'a' : 'os'} · {split.labsUsed.length} vizit{split.labsUsed.length === 1 ? 'as' : 'ai'}
                                  </div>
                                </div>
                                {splitIsCheaper && (
                                  <div className="bg-[#ecfdf5] border border-[#a7f3d0] px-2.5 py-1.5">
                                    <span className="font-mono font-bold text-[#059669] text-[10px]">
                                      Sutaupote €{splitSaves.toFixed(2)} vs 1 lab.
                                    </span>
                                  </div>
                                )}
                                <div className="space-y-1 pt-1">
                                  {split.assignments.map(a => (
                                    <div key={a.test.id} className="flex items-center justify-between text-[10px] gap-1">
                                      <span className="text-[#1a1a1a] truncate" title={a.test.name}>{a.test.name}</span>
                                      <span className="font-mono font-bold text-[#059669] shrink-0">{a.lab.name} €{a.price.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Option 3: Vienas vizitas */}
                              <div className="border-2 border-[#1a1a1a] bg-[#fdfdfc] p-4 space-y-3">
                                <div>
                                  <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#8a8a82]">3 Variantas</span>
                                  <h4 className="font-bold text-xs text-[#1a1a1a] mt-1 leading-tight">Vienas vizitas</h4>
                                </div>
                                <p className="text-[11px] text-[#63635e] leading-snug">
                                  Visa tai atliekate <span className="font-bold text-[#1a1a1a]">{best.lab.name}</span> — kraujas imamas vieną kartą.
                                </p>
                                <div>
                                  <div className="font-mono font-black text-2xl text-[#1a1a1a] tabular-nums">€{best.total.toFixed(2)}</div>
                                  {splitIsCheaper ? (
                                    <div className="text-[10px] text-[#8a8a82] font-mono mt-0.5">
                                      +€{splitSaves.toFixed(2)} daugiau nei skaidant, bet 1 vizitas
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-[#059669] font-mono font-bold mt-0.5">
                                      Ir pigiausias, ir patogiausias
                                    </div>
                                  )}
                                </div>
                                {best.lab.bookingUrl && (
                                  <a href={best.lab.bookingUrl} target="_blank" rel="noopener noreferrer"
                                    className="block w-full text-center py-2 bg-[#059669] hover:bg-[#047857] text-white font-mono font-bold text-[9.5px] uppercase tracking-wider transition">
                                    Atidaryti {best.lab.name} ↗
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Conclusion */}
                            <div className={`p-4 border-2 border-[#1a1a1a] text-xs leading-relaxed ${splitIsCheaper ? 'bg-[#ecfdf5]' : 'bg-[#fffcf0]'}`}>
                              {splitIsCheaper
                                ? <p><span className="font-bold">Išvada:</span> Skaidymas sutaupytų <span className="font-mono font-bold text-[#059669]">€{splitSaves.toFixed(2)}</span>, tačiau reikės <span className="font-bold">{split.labsUsed.length} laboratorijų vizitų</span>.</p>
                                : <p><span className="font-bold">Išvada:</span> <span className="font-bold">{best.lab.name}</span> yra ir pigiausias, ir patogiausias pasirinkimas — viskas vienoje vietoje.</p>
                              }
                            </div>
                          </>
                        ) : basketOptimization.minVisitCombination ? (
                          /* ── Section C: No single lab covers all ── */
                          <div className="bg-[#fffcf0] border-2 border-[#f0e6c5] p-5 space-y-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[#856d2b] text-lg">⚠</span>
                              <h4 className="font-mono font-bold text-[11px] uppercase tracking-wider text-[#856d2b]">
                                Nė viena laboratorija neatlieka visų tyrimų
                              </h4>
                            </div>
                            <p className="text-xs text-[#856d2b]">Rekomenduojama minimali laboratorijų kombinacija:</p>
                            <div className="space-y-3">
                              {basketOptimization.minVisitCombination.groups.map(g => (
                                <div key={g.lab.id} className="bg-white border border-[#f0e6c5] p-3 space-y-2">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className="font-bold text-[#1a1a1a] text-sm">{g.lab.name}</span>
                                    <span className="font-mono text-xs text-[#8a8a82]">
                                      €{g.tests.reduce((s, t) => s + t.price, 0).toFixed(2)} + €{g.lab.samplingFee.toFixed(2)} paėmimas
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {g.tests.map(t => (
                                      <span key={t.test.id} className="text-[9px] font-mono bg-[#fffcf0] border border-[#f0e6c5] px-1.5 py-0.5 text-[#856d2b]">
                                        {t.test.name}
                                      </span>
                                    ))}
                                  </div>
                                  {g.lab.bookingUrl && (
                                    <a href={g.lab.bookingUrl} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex text-[10px] font-mono font-bold text-[#059669] hover:text-[#047857] uppercase tracking-wider gap-1">
                                      Atidaryti {g.lab.name} ↗
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-[#f0e6c5]">
                              <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-[#856d2b]">Bendra kaina:</span>
                              <span className="font-mono font-black text-xl text-[#1a1a1a] tabular-nums">€{basketOptimization.minVisitCombination.total.toFixed(2)}</span>
                            </div>
                          </div>
                        ) : null}

                        {/* ── Planuoti vizitus ── */}
                        {split && (
                          <div className="bg-[#fdfdfc] border-2 border-[#1a1a1a] overflow-hidden">
                            <div className="px-5 py-3 border-b-2 border-[#1a1a1a] bg-[#f4f4f0] flex items-center justify-between">
                              <h4 className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#8a8a82]">
                                Kelionių planas — {splitIsCheaper ? 'pigiausia kombinacija' : 'viena laboratorija'}
                              </h4>
                              <span className="font-mono font-black text-sm text-[#1a1a1a] tabular-nums">
                                €{(splitIsCheaper ? split.total : (best?.total ?? split.total)).toFixed(2)} iš viso
                              </span>
                            </div>
                            <div className="divide-y divide-[#e5e5e0]">
                              {(() => {
                                const planGroups = splitIsCheaper
                                  ? (() => {
                                      const byLab = new Map<string, typeof split.assignments>();
                                      for (const a of split.assignments) {
                                        if (!byLab.has(a.lab.id)) byLab.set(a.lab.id, []);
                                        byLab.get(a.lab.id)!.push(a);
                                      }
                                      return Array.from(byLab.entries()).map(([, items]) => ({ lab: items[0].lab, items }));
                                    })()
                                  : best
                                    ? [{ lab: best.lab, items: best.assignments.map(a => ({ ...a, lab: best.lab })) }]
                                    : [];
                                return planGroups.map(({ lab, items }) => (
                                  <div key={lab.id} className="px-5 py-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                      <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 shrink-0" style={{ backgroundColor: lab.color ?? '#8a8a82' }} />
                                        <span className="font-bold text-[#1a1a1a] text-sm">{lab.name}</span>
                                        <span className="font-mono text-[10px] text-[#8a8a82]">
                                          €{items.reduce((s, a) => s + a.price, 0).toFixed(2)} + €{lab.samplingFee.toFixed(2)} paėmimas
                                        </span>
                                      </div>
                                      {lab.bookingUrl && (
                                        <a href={lab.bookingUrl} target="_blank" rel="noopener noreferrer"
                                          className="shrink-0 px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white font-mono font-bold text-[9.5px] uppercase tracking-wider transition whitespace-nowrap">
                                          Atidaryti ↗
                                        </a>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {items.map(a => (
                                        <span key={a.test.id} className="text-[9.5px] font-mono bg-[#f4f4f0] border border-[#e5e5e0] px-2 py-1 text-[#1a1a1a]">
                                          {a.test.name} <span className="text-[#059669] font-bold">€{a.price.toFixed(2)}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TRENDS TAB ── */}
        {activeTab === 'trends' && (
          <div className="bg-[#fdfdfc] border-2 border-[#1a1a1a] p-6 space-y-6 shadow-[4px_4px_0px_0px_#1a1a1a]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e5e5e0]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-[#1a1a1a] text-[#fdfdfc]"><Ic.Trend c="w-4 h-4" /></span>
                  <h3 className="text-xl font-serif italic font-bold text-[#1a1a1a]">Kainų Dinamika ir Istorija</h3>
                </div>
                <p className="text-xs text-[#8a8a82] mt-1">Stebėkite, kaip tyrimų įkainiai kito pagrindinėse laboratorijose.</p>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {tests.slice(0, 20).map(test => (
                  <button key={test.id} onClick={() => setTrendsTestId(test.id)}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition shrink-0 rounded-none ${
                      trendsTestId === test.id ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white' : 'bg-[#f4f4f0] border-[#e5e5e0] text-[#63635e] hover:border-[#1a1a1a]'
                    }`}>
                    {test.code !== '—' ? test.code : test.name.slice(0, 12)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-[#fcfcfb] border border-[#e5e5e0] p-5 space-y-3">
                  <h4 className="text-[10px] font-mono font-bold text-[#8a8a82] uppercase tracking-widest">Aktyvus tyrimas</h4>
                  <p className="text-base font-bold text-[#1a1a1a] leading-tight">
                    {tests.find(t => t.id === trendsTestId)?.name ?? '—'}
                  </p>
                  <p className="text-xs text-[#555550] leading-relaxed">
                    Istoriniai duomenys rodo rinkos pakitimus laike. Kreivė atspindi laboratorijų nustatytus įkainius pastaraisiais mėnesiais.
                  </p>
                </div>
                <div className="p-4 bg-[#fffcf0] border border-[#f0e6c5] text-[#856d2b] text-[11px] leading-relaxed flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4a017] shrink-0 mt-1.5 animate-pulse" />
                  <p><span className="font-bold">Interaktyvus grafikas:</span> Užveskite pelę ant grafiko, kad pamatytumėte konkrečius įkainius.</p>
                </div>
              </div>
              <div className="lg:col-span-8 space-y-4">
                {/* Legend */}
                <div className="flex flex-wrap gap-4 items-center justify-center py-2 bg-[#f4f4f0] border border-[#e5e5e0] text-xs">
                  {trendsActiveLabs.map(lab => (
                    <div key={lab.id} className="flex items-center gap-2">
                      <span className="w-3 h-0.5" style={{ backgroundColor: lab.color }} />
                      <span className="font-bold text-[#1a1a1a] text-[10px] uppercase tracking-wider font-mono">{lab.name}</span>
                    </div>
                  ))}
                </div>
                {trendsLoading ? (
                  <div className="border border-[#e5e5e0] p-12 text-center text-xs text-[#8a8a82] font-mono">Kraunama...</div>
                ) : trendsChartData.length >= 1 ? (
                  <TrendsSvgChart chartData={trendsChartData} labs={trendsActiveLabs.length > 0 ? trendsActiveLabs : activeLabs} />
                ) : (
                  <div className="border border-[#e5e5e0] p-12 text-center space-y-2">
                    <p className="text-[#1a1a1a] font-serif italic">Kainų istorija dar kaupiama</p>
                    <p className="text-xs text-[#8a8a82]">Duomenys kaupiami kas dieną. Grįžkite po pirmojo scrape ciklo.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LOCATIONS TAB ── */}
        {activeTab === 'locations' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-serif italic font-bold text-[#1a1a1a]">Klinikų adresai</h2>
              <p className="text-sm text-[#63635e]">Raskite artimiausią laboratorijos filialą pagal miestą.</p>
            </div>

            {/* City tabs */}
            <div className="flex flex-wrap gap-2 border-b-2 border-[#1a1a1a] pb-3">
              {CITIES.map(city => (
                <button key={city} onClick={() => { setCityFilter(city); setLocLabFilter(null); }}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-t border-x rounded-none transition ${
                    cityFilter === city ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white border-[#e5e5e0] text-[#63635e] hover:bg-[#f4f4f0]'
                  }`}>{city}
                </button>
              ))}
            </div>

            {/* Lab filter */}
            {cityLabNames.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setLocLabFilter(null)}
                  className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider border rounded-none transition ${!locLabFilter ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-[#f4f4f0] border-[#e5e5e0] text-[#63635e] hover:border-[#1a1a1a]'}`}>
                  Visos laboratorijos
                </button>
                {cityLabNames.map(name => (
                  <button key={name} onClick={() => setLocLabFilter(name)}
                    className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider border rounded-none transition ${locLabFilter === name ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-[#f4f4f0] border-[#e5e5e0] text-[#63635e] hover:border-[#1a1a1a]'}`}>
                    {name}
                  </button>
                ))}
              </div>
            )}

            {/* Location cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLocations.map(loc => (
                <div key={loc.id} className="bg-[#fdfdfc] border-2 border-[#e5e5e0] hover:border-[#1a1a1a] p-5 space-y-3 transition shadow-[2px_2px_0px_0px_#e5e5e0] hover:shadow-[2px_2px_0px_0px_#1a1a1a]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8a8a82]">{loc.labName}</span>
                      <p className="font-bold text-[#1a1a1a] text-sm mt-0.5">{loc.address}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-[#8a8a82]">
                    <div className="flex items-center gap-1.5">
                      <Ic.Clock c="w-3 h-3 shrink-0" />
                      <span>{loc.workingHours}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Ic.Phone c="w-3 h-3 shrink-0" />
                      <span className="font-mono">{loc.phone}</span>
                    </div>
                  </div>
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(loc.address)}`} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] font-mono font-bold text-[#059669] hover:text-[#047857] uppercase tracking-wider flex items-center gap-1">
                    <Ic.Link c="w-3 h-3" /> Google Maps ↗
                  </a>
                </div>
              ))}
              {filteredLocations.length === 0 && (
                <div className="col-span-full text-center py-12 text-[#8a8a82] text-sm">Šiame mieste adresų nerasta.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FAQ section */}
      <div className="bg-[#fcfcfb] border border-[#e5e5e0] p-7 space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#e5e5e0]">
          <span className="p-1.5 bg-[#1a1a1a] text-white">♡</span>
          <h3 className="text-lg font-serif italic text-[#1a1a1a]">DUK ir svarbi pagalba pacientui</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs leading-relaxed text-[#555550]">
          <div className="space-y-2">
            <h4 className="font-bold text-[#1a1a1a] text-sm">1. Kada geriausia atvykti kraujo tyrimui?</h4>
            <p>Kraują priduoti rekomenduojama ryte (nuo 7:00 iki 11:00 val.), nevalgius 8–12 valandų prieš procedūrą. Kavą ir arbatą patariama pakeisti švariu vandeniu.</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-[#1a1a1a] text-sm">2. Kas yra kraujo paėmimo mokestis?</h4>
            <p>Tai vienkartinis mokestis (2.00–3.00 €), kurį laboratorijos ima už adatą, slaugytojos darbą ir mėginio paruošimą. Mūsų krepšelio analizėje šis mokestis pridedamas automatiškai.</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-[#1a1a1a] text-sm">3. Ar tyrimus sujungus gaunama nuolaida?</h4>
            <p>Taip! Pasirinkus išsamius profilaktinius rinkinius, tyrimų įkainiai gaunasi iki 30–50% palankesni lyginant su užsakymu pavieniui.</p>
          </div>
        </div>
      </div>

      {/* Floating cart badge */}
      {cartItems.length > 0 && activeTab !== 'cart' && (
        <button onClick={() => setActiveTab('cart')}
          className="fixed bottom-6 right-6 bg-[#059669] hover:bg-[#047857] text-[#fffcf0] font-bold text-xs p-4 px-6 rounded-none shadow-[4px_4px_0px_0px_#1a1a1a] flex items-center gap-2 border-2 border-[#1a1a1a] z-50 transition-all">
          <Ic.Cart c="w-4 h-4" />
          <span className="uppercase tracking-wider">Krepšelis ({cartItems.length})</span>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        </button>
      )}
    </div>
  );
}
