'use client';

import { useState } from 'react';

interface GapPair {
  id1: number;
  name1: string;
  labs1: string | null;
  id2: number;
  name2: string;
  labs2: string | null;
  similarity: number;
}

function SimilarityBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.98 ? 'bg-red-100 text-red-700' :
    value >= 0.95 ? 'bg-[#fffcf0] text-[#856d2b]' :
    value >= 0.92 ? 'bg-[#f4f4f0] text-[#8a8a82]' :
    'bg-[#f4f4f0] text-[#8a8a82]';
  return (
    <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-none tabular-nums ${color}`}>
      {pct}%
    </span>
  );
}

export default function GapsPage() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pairs, setPairs] = useState<GapPair[]>([]);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium'>('all');
  const [dismissed, setDismissed] = useState(new Set<string>());

  async function load(t: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/gaps', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) { setError('Neteisingas slaptažodis'); setLoading(false); return; }
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setPairs(data.pairs ?? []);
      setAuthed(true);
    } catch {
      setError('Nepavyko prisijungti');
    }
    setLoading(false);
  }

  function dismiss(id1: number, id2: number) {
    setDismissed(prev => new Set([...prev, `${id1}-${id2}`]));
  }

  const filtered = pairs
    .filter(p => !dismissed.has(`${p.id1}-${p.id2}`))
    .filter(p => {
      if (filter === 'high')   return p.similarity >= 0.95;
      if (filter === 'medium') return p.similarity >= 0.88 && p.similarity < 0.95;
      return true;
    });

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-4 py-24">
        <h1 className="font-serif italic font-bold text-xl text-[#1a1a1a] mb-6">Administratoriaus sritis</h1>
        <form onSubmit={(e) => { e.preventDefault(); load(token); }} className="space-y-3">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Slaptažodis"
            className="w-full px-4 py-2.5 rounded-none border border-[#e5e5e0] bg-[#f4f4f0] text-sm text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a] focus:bg-white"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#1a1a1a] text-white rounded-none border-2 border-[#1a1a1a] font-bold uppercase tracking-wider text-xs hover:bg-[#333] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Kraunama...' : 'Prisijungti'}
          </button>
        </form>
      </div>
    );
  }

  const highCount   = pairs.filter(p => p.similarity >= 0.95 && !dismissed.has(`${p.id1}-${p.id2}`)).length;
  const mediumCount = pairs.filter(p => p.similarity >= 0.88 && p.similarity < 0.95 && !dismissed.has(`${p.id1}-${p.id2}`)).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif italic font-bold text-2xl text-[#1a1a1a]">Padengiamumo spragos</h1>
          <p className="font-mono text-[11px] text-[#8a8a82] mt-1">
            Skirtingų laboratorijų tyrimai, susietie su skirtingais kanonais — galimos susiliejimai.
          </p>
        </div>
        <button
          onClick={() => load(token)}
          disabled={loading}
          className="px-4 py-2 rounded-none border-2 border-[#1a1a1a] font-bold uppercase tracking-wider text-xs text-[#1a1a1a] hover:bg-[#f4f4f0] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Kraunama...' : 'Atnaujinti'}
        </button>
      </div>

      {error && <p className="text-red-500 font-mono text-[11px] mb-4">{error}</p>}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'high', 'medium'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-none font-mono font-bold text-[11px] uppercase tracking-wider transition-colors ${
              filter === f
                ? 'bg-[#1a1a1a] text-white border-2 border-[#1a1a1a]'
                : 'border-2 border-[#e5e5e0] text-[#63635e] hover:border-[#1a1a1a] hover:text-[#1a1a1a]'
            }`}
          >
            {f === 'all'    && `Visi (${pairs.length - dismissed.size})`}
            {f === 'high'   && `≥ 95% (${highCount})`}
            {f === 'medium' && `88–95% (${mediumCount})`}
          </button>
        ))}
      </div>

      <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono text-[11px] uppercase tracking-wider text-[#8a8a82] bg-[#f4f4f0] border-b-2 border-[#1a1a1a]">
              <th className="px-4 py-2 text-left font-bold w-8">%</th>
              <th className="px-4 py-2 text-left font-bold">Kanonas A</th>
              <th className="px-4 py-2 text-left font-bold">Lab. A</th>
              <th className="px-4 py-2 text-left font-bold">Kanonas B</th>
              <th className="px-4 py-2 text-left font-bold">Lab. B</th>
              <th className="px-4 py-2 text-left font-bold w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={`${p.id1}-${p.id2}`} className="border-b border-[#e5e5e0] last:border-0 hover:bg-[#f4f4f0]">
                <td className="px-4 py-3">
                  <SimilarityBadge value={p.similarity} />
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/test/${p.id1}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1a1a1a] hover:text-[#8a8a82] hover:underline font-medium"
                  >
                    {p.name1}
                  </a>
                  <div className="font-mono text-[10px] text-[#8a8a82]">id={p.id1}</div>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-[#8a8a82] whitespace-nowrap">
                  {p.labs1 ?? <span className="italic">nėra kainų</span>}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/test/${p.id2}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1a1a1a] hover:text-[#8a8a82] hover:underline font-medium"
                  >
                    {p.name2}
                  </a>
                  <div className="font-mono text-[10px] text-[#8a8a82]">id={p.id2}</div>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-[#8a8a82] whitespace-nowrap">
                  {p.labs2 ?? <span className="italic">nėra kainų</span>}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => dismiss(p.id1, p.id2)}
                    className="font-mono text-[11px] uppercase tracking-wider text-[#8a8a82] hover:text-[#1a1a1a] transition-colors"
                  >
                    Praleisti
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center font-mono text-[11px] text-[#8a8a82]">
                  {loading ? 'Kraunama...' : 'Spragų nerasta ✓'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <p className="font-mono text-[11px] text-[#8a8a82] mt-3">
          Norėdami susieti, paleiskite <code className="bg-[#f4f4f0] border border-[#e5e5e0] px-1">scripts/audit-coverage-gaps.ts</code> arba sukurkite tikslinį merge skriptą.
        </p>
      )}
    </div>
  );
}
