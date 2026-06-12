'use client';

import { useState } from 'react';

interface ScrapeRun {
  id: number;
  lab: { name: string } | null;
  started_at: string;
  status: string | null;
  tests_updated: number;
  error_message: string | null;
}

interface PendingItem {
  id: number;
  lab: { name: string } | null;
  raw_name: string;
  price_eur: number | null;
  suggestion: { id: number; name: string; score: number | undefined } | null;
}

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [scrapeMsg, setScrapeMsg] = useState('');

  async function fetchStatus(t: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/scrape-status', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) { setError('Neteisingas slaptažodis'); setLoading(false); return; }
      const data = await res.json();
      setRuns(data.runs);
      setPending(data.pending);
      setAuthed(true);
    } catch {
      setError('Nepavyko prisijungti');
    }
    setLoading(false);
  }

  async function triggerScrape() {
    setScrapeMsg('Paleidžiama...');
    const res = await fetch('/api/admin/trigger-scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setScrapeMsg(data.message);
    setTimeout(() => fetchStatus(token), 3000);
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-4 py-24">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Administratoriaus sritis</h1>
        <form onSubmit={(e) => { e.preventDefault(); fetchStatus(token); }} className="space-y-3">
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
            {loading ? 'Tikrinama...' : 'Prisijungti'}
          </button>
        </form>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    success: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700',
    failed:  'bg-red-100 text-red-700',
    running: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Administravimas</h1>
        <div className="flex items-center gap-3">
          {scrapeMsg && <span className="text-sm text-gray-500">{scrapeMsg}</span>}
          <button
            onClick={triggerScrape}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Paleisti scrape
          </button>
          <button
            onClick={() => fetchStatus(token)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Atnaujinti
          </button>
        </div>
      </div>

      <h2 className="text-base font-semibold text-gray-900 mb-3">Paskutiniai scrape&#8217;ai</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-2 text-left font-medium">Laboratorija</th>
              <th className="px-4 py-2 text-left font-medium">Pradėta</th>
              <th className="px-4 py-2 text-left font-medium">Statusas</th>
              <th className="px-4 py-2 text-right font-medium">Atnaujinta</th>
              <th className="px-4 py-2 text-left font-medium">Klaida</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-800">{run.lab?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(run.started_at).toLocaleString('lt-LT')}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[run.status ?? 'running'] ?? 'bg-gray-100 text-gray-500'}`}>
                    {run.status ?? 'vykdoma'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{run.tests_updated}</td>
                <td className="px-4 py-3 text-red-500 text-xs max-w-xs truncate">{run.error_message ?? ''}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Nėra duomenų
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-base font-semibold text-gray-900 mb-3">
        Nesusieti tyrimai{pending.length > 0 && ` (${pending.length})`}
      </h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-2 text-left font-medium">Lab.</th>
              <th className="px-4 py-2 text-left font-medium">Originalus pavadinimas</th>
              <th className="px-4 py-2 text-left font-medium">Artimiausia atitiktis</th>
              <th className="px-4 py-2 text-right font-medium">Kaina</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">{item.lab?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700">{item.raw_name}</td>
                <td className="px-4 py-3">
                  {item.suggestion ? (
                    <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {item.suggestion.name}
                      <span className="ml-1 text-blue-400">
                        ({((1 - (item.suggestion.score ?? 0)) * 100).toFixed(0)}%)
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 italic">naujas tyrimas</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 tabular-nums whitespace-nowrap">
                  {item.price_eur ? `€${Number(item.price_eur).toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Visi tyrimai susieti ✓
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
