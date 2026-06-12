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
        <h1 className="font-serif italic font-bold text-xl text-[#1a1a1a] mb-6">Administratoriaus sritis</h1>
        <form onSubmit={(e) => { e.preventDefault(); fetchStatus(token); }} className="space-y-3">
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
            {loading ? 'Tikrinama...' : 'Prisijungti'}
          </button>
        </form>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    success: 'bg-[#ecfdf5] text-[#059669]',
    partial: 'bg-[#fffcf0] text-[#856d2b]',
    failed:  'bg-red-50 text-red-600',
    running: 'bg-[#f4f4f0] text-[#1a1a1a]',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif italic font-bold text-2xl text-[#1a1a1a]">Administravimas</h1>
        <div className="flex items-center gap-3">
          {scrapeMsg && <span className="font-mono text-[11px] text-[#8a8a82]">{scrapeMsg}</span>}
          <button
            onClick={triggerScrape}
            className="px-4 py-2 bg-[#1a1a1a] text-white rounded-none border-2 border-[#1a1a1a] font-bold uppercase tracking-wider text-xs hover:bg-[#333] transition-colors"
          >
            Paleisti scrape
          </button>
          <button
            onClick={() => fetchStatus(token)}
            className="px-4 py-2 rounded-none border-2 border-[#1a1a1a] font-bold uppercase tracking-wider text-xs text-[#1a1a1a] hover:bg-[#f4f4f0] transition-colors"
          >
            Atnaujinti
          </button>
        </div>
      </div>

      <h2 className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#8a8a82] mb-3">Paskutiniai scrape&#8217;ai</h2>
      <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono text-[11px] uppercase tracking-wider text-[#8a8a82] bg-[#f4f4f0] border-b-2 border-[#1a1a1a]">
              <th className="px-4 py-2 text-left font-bold">Laboratorija</th>
              <th className="px-4 py-2 text-left font-bold">Pradėta</th>
              <th className="px-4 py-2 text-left font-bold">Statusas</th>
              <th className="px-4 py-2 text-right font-bold">Atnaujinta</th>
              <th className="px-4 py-2 text-left font-bold">Klaida</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b border-[#e5e5e0] last:border-0 hover:bg-[#f4f4f0]">
                <td className="px-4 py-3 font-medium text-[#1a1a1a]">{run.lab?.name ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-[#8a8a82]">
                  {new Date(run.started_at).toLocaleString('lt-LT')}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-none ${statusColor[run.status ?? 'running'] ?? 'bg-[#f4f4f0] text-[#8a8a82]'}`}>
                    {run.status ?? 'vykdoma'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-[#8a8a82] tabular-nums">{run.tests_updated}</td>
                <td className="px-4 py-3 text-red-500 font-mono text-[11px] max-w-xs truncate">{run.error_message ?? ''}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-mono text-[11px] text-[#8a8a82]">
                  Nėra duomenų
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="font-mono font-bold text-[11px] uppercase tracking-widest text-[#8a8a82] mb-3">
        Nesusieti tyrimai{pending.length > 0 && ` (${pending.length})`}
      </h2>
      <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono text-[11px] uppercase tracking-wider text-[#8a8a82] bg-[#f4f4f0] border-b-2 border-[#1a1a1a]">
              <th className="px-4 py-2 text-left font-bold">Lab.</th>
              <th className="px-4 py-2 text-left font-bold">Originalus pavadinimas</th>
              <th className="px-4 py-2 text-left font-bold">Artimiausia atitiktis</th>
              <th className="px-4 py-2 text-right font-bold">Kaina</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((item) => (
              <tr key={item.id} className="border-b border-[#e5e5e0] last:border-0 hover:bg-[#f4f4f0]">
                <td className="px-4 py-3 font-medium text-[#1a1a1a] whitespace-nowrap">{item.lab?.name ?? '—'}</td>
                <td className="px-4 py-3 text-[#1a1a1a]">{item.raw_name}</td>
                <td className="px-4 py-3">
                  {item.suggestion ? (
                    <span className="font-mono text-[11px] text-[#1a1a1a] bg-[#f4f4f0] border border-[#e5e5e0] px-2 py-0.5">
                      {item.suggestion.name}
                      <span className="ml-1 text-[#8a8a82]">
                        ({((1 - (item.suggestion.score ?? 0)) * 100).toFixed(0)}%)
                      </span>
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-[#8a8a82]">naujas tyrimas</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[#8a8a82] tabular-nums whitespace-nowrap">
                  {item.price_eur ? `€${Number(item.price_eur).toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center font-mono text-[11px] text-[#8a8a82]">
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
