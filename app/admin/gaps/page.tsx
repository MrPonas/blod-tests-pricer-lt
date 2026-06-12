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
    value >= 0.95 ? 'bg-orange-100 text-orange-700' :
    value >= 0.92 ? 'bg-yellow-100 text-yellow-700' :
    'bg-gray-100 text-gray-500';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium tabular-nums ${color}`}>
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
        <h1 className="text-xl font-bold text-gray-900 mb-6">Administratoriaus sritis</h1>
        <form onSubmit={(e) => { e.preventDefault(); load(token); }} className="space-y-3">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Slaptažodis"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
          <h1 className="text-2xl font-bold text-gray-900">Padengiamumo spragos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Skirtingų laboratorijų tyrimai, susietie su skirtingais kanonais — galimos susiliejimai.
          </p>
        </div>
        <button
          onClick={() => load(token)}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {loading ? 'Kraunama...' : 'Atnaujinti'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'high', 'medium'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'all'    && `Visi (${pairs.length - dismissed.size})`}
            {f === 'high'   && `≥ 95% (${highCount})`}
            {f === 'medium' && `88–95% (${mediumCount})`}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-2 text-left font-medium w-8">%</th>
              <th className="px-4 py-2 text-left font-medium">Kanonas A</th>
              <th className="px-4 py-2 text-left font-medium">Lab. A</th>
              <th className="px-4 py-2 text-left font-medium">Kanonas B</th>
              <th className="px-4 py-2 text-left font-medium">Lab. B</th>
              <th className="px-4 py-2 text-left font-medium w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={`${p.id1}-${p.id2}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <SimilarityBadge value={p.similarity} />
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/test/${p.id1}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline font-medium"
                  >
                    {p.name1}
                  </a>
                  <div className="text-xs text-gray-400">id={p.id1}</div>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                  {p.labs1 ?? <span className="text-gray-300 italic">nėra kainų</span>}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/test/${p.id2}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline font-medium"
                  >
                    {p.name2}
                  </a>
                  <div className="text-xs text-gray-400">id={p.id2}</div>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                  {p.labs2 ?? <span className="text-gray-300 italic">nėra kainų</span>}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => dismiss(p.id1, p.id2)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Praleisti
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                  {loading ? 'Kraunama...' : 'Spragų nerasta ✓'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          Norėdami susieti, paleiskite <code className="bg-gray-100 px-1 rounded">scripts/audit-coverage-gaps.ts</code> arba sukurkite tikslinį merge skriptą.
        </p>
      )}
    </div>
  );
}
