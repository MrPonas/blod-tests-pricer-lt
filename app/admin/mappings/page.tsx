'use client';

import { useState, useCallback } from 'react';

interface QueueItem {
  id: number;
  raw_name: string;
  price_eur: number | null;
  ai_reasoning: string | null;
  ai_confidence: number | null;
  ai_suggestion_id: number | null;
  labs: { id: number; name: string } | null;
  tests: { id: number; canonical_name_lt: string } | null;
}

export default function MappingsPage() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [createName, setCreateName] = useState('');

  async function fetchQueue(t: string) {
    setLoading(true);
    setAuthError('');
    const res = await fetch('/api/admin/mappings', {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.status === 401) { setAuthError('Neteisingas slaptažodis'); setLoading(false); return; }
    const data = await res.json();
    setItems(data.items);
    setTotal(data.total);
    setAuthed(true);
    setLoading(false);
  }

  const post = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/admin/mappings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Request failed');
    }
    return res.json();
  }, [token]);

  function setBusy(id: number, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      busy ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function removeItem(id: number) {
    setItems(prev => prev.filter(i => i.id !== id));
    setTotal(prev => prev - 1);
  }

  async function handleApprove(item: QueueItem) {
    if (!item.ai_suggestion_id) return;
    setBusy(item.id, true);
    try {
      await post({ action: 'approve', id: item.id });
      removeItem(item.id);
    } catch (e) {
      setMsg(`Klaida: ${e}`);
    }
    setBusy(item.id, false);
  }

  async function handleSkip(item: QueueItem) {
    setBusy(item.id, true);
    try {
      await post({ action: 'skip', id: item.id });
      removeItem(item.id);
    } catch (e) {
      setMsg(`Klaida: ${e}`);
    }
    setBusy(item.id, false);
  }

  function downloadCsv() {
    const header = 'id,lab,raw_name,price_eur,suggested_canonical,suggested_canonical_id,ai_reasoning';
    const escape = (v: string | number | null) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = items.map(i => [
      i.id,
      escape(i.labs?.name ?? ''),
      escape(i.raw_name),
      i.price_eur ?? '',
      escape(i.tests?.canonical_name_lt ?? ''),
      i.ai_suggestion_id ?? '',
      escape(i.ai_reasoning ?? ''),
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapping-review-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function startCreate(item: QueueItem) {
    setCreatingId(item.id);
    setCreateName(item.raw_name);
  }

  async function confirmCreate() {
    if (!creatingId || !createName.trim()) return;
    setBusy(creatingId, true);
    try {
      await post({ action: 'create', id: creatingId, canonical_name: createName.trim() });
      removeItem(creatingId);
      setCreatingId(null);
    } catch (e) {
      setMsg(`Klaida: ${e}`);
    }
    setBusy(creatingId, false);
  }

  async function handleBulkApprove() {
    setBulkBusy(true);
    setMsg('');
    try {
      const res = await post({ action: 'bulk_approve' });
      setMsg(`Patvirtinta: ${res.count} įrašų`);
      await fetchQueue(token);
    } catch (e) {
      setMsg(`Klaida: ${e}`);
    }
    setBulkBusy(false);
  }

  const highConf = items.filter(i => (i.ai_confidence ?? 0) >= 0.90 && i.ai_suggestion_id).length;

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-4 py-24">
        <h1 className="font-serif italic font-bold text-xl text-[#1a1a1a] mb-6">Administratoriaus sritis</h1>
        <form onSubmit={(e) => { e.preventDefault(); fetchQueue(token); }} className="space-y-3">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Slaptažodis"
            className="w-full px-4 py-2.5 rounded-none border border-[#e5e5e0] bg-[#f4f4f0] text-sm text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a] focus:bg-white"
          />
          {authError && <p className="text-red-500 text-sm">{authError}</p>}
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif italic font-bold text-2xl text-[#1a1a1a]">Žymėjimų peržiūra</h1>
          <p className="font-mono text-[11px] text-[#8a8a82] mt-0.5">
            {total} liko · {highConf} virš 90% pasitikėjimo
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="font-mono text-[11px] text-[#8a8a82]">{msg}</span>}
          <button
            onClick={handleBulkApprove}
            disabled={bulkBusy || highConf === 0}
            className="px-4 py-2 bg-[#059669] text-white rounded-none border-2 border-[#059669] font-bold uppercase tracking-wider text-xs hover:bg-[#047857] disabled:opacity-40 transition-colors"
          >
            {bulkBusy ? 'Tvirtinama...' : `Patvirtinti visus ≥90% (${highConf})`}
          </button>
          <button
            onClick={downloadCsv}
            disabled={items.length === 0}
            className="px-4 py-2 rounded-none border-2 border-[#1a1a1a] font-bold uppercase tracking-wider text-xs text-[#1a1a1a] hover:bg-[#f4f4f0] disabled:opacity-40 transition-colors"
          >
            Atsisiųsti CSV
          </button>
          <button
            onClick={() => fetchQueue(token)}
            className="px-4 py-2 rounded-none border-2 border-[#1a1a1a] font-bold uppercase tracking-wider text-xs text-[#1a1a1a] hover:bg-[#f4f4f0] transition-colors"
          >
            Atnaujinti
          </button>
        </div>
      </div>

      {/* Create-new inline form */}
      {creatingId !== null && (
        <div className="mb-4 p-4 bg-[#f4f4f0] border-2 border-[#1a1a1a] flex items-center gap-3">
          <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-[#1a1a1a] whitespace-nowrap">Naujas kanoninis pavadinimas:</span>
          <input
            autoFocus
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmCreate(); if (e.key === 'Escape') setCreatingId(null); }}
            className="flex-1 px-3 py-1.5 rounded-none border border-[#e5e5e0] bg-white text-sm text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a]"
          />
          <button
            onClick={confirmCreate}
            disabled={busyIds.has(creatingId)}
            className="px-3 py-1.5 bg-[#1a1a1a] text-white rounded-none border-2 border-[#1a1a1a] font-bold uppercase tracking-wider text-xs hover:bg-[#333] disabled:opacity-50 transition-colors"
          >
            Sukurti
          </button>
          <button
            onClick={() => setCreatingId(null)}
            className="px-3 py-1.5 rounded-none border-2 border-[#1a1a1a] font-bold uppercase tracking-wider text-xs text-[#1a1a1a] hover:bg-[#f4f4f0] transition-colors"
          >
            Atšaukti
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#fdfdfc] rounded-none border-2 border-[#1a1a1a] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono text-[11px] uppercase tracking-wider text-[#8a8a82] bg-[#f4f4f0] border-b-2 border-[#1a1a1a]">
              <th className="px-4 py-2 text-left font-bold">Laboratorija</th>
              <th className="px-4 py-2 text-left font-bold">Originalus pavadinimas</th>
              <th className="px-4 py-2 text-left font-bold">AI komentaras</th>
              <th className="px-4 py-2 text-left font-bold">Siūloma atitiktis</th>
              <th className="px-4 py-2 text-right font-bold">Tikimybė</th>
              <th className="px-4 py-2 text-right font-bold">Veiksmai</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const conf = item.ai_confidence ?? 0;
              const busy = busyIds.has(item.id);
              const confColor = conf >= 0.90
                ? 'text-[#059669] bg-[#ecfdf5]'
                : conf >= 0.70
                ? 'text-[#856d2b] bg-[#fffcf0]'
                : 'text-red-600 bg-red-50';

              return (
                <tr key={item.id} className="border-b border-[#e5e5e0] last:border-0 hover:bg-[#f4f4f0]">
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-[#1a1a1a]">
                    {item.labs?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-[#1a1a1a] max-w-xs">
                    <span className="line-clamp-2">{item.raw_name}</span>
                    {item.price_eur && (
                      <span className="font-mono text-[10px] text-[#8a8a82] mt-0.5 block">€{Number(item.price_eur).toFixed(2)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#8a8a82] max-w-xs">
                    <span className="line-clamp-2">{item.ai_reasoning ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {item.tests ? (
                      <a
                        href={`/test/${item.tests.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#1a1a1a] hover:text-[#8a8a82] hover:underline font-mono text-[11px] line-clamp-2"
                      >
                        {item.tests.canonical_name_lt}
                      </a>
                    ) : (
                      <span className="font-mono text-[11px] text-[#8a8a82]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {item.ai_confidence != null ? (
                      <span className={`inline-block font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 tabular-nums ${confColor}`}>
                        {(conf * 100).toFixed(0)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.ai_suggestion_id && (
                        <button
                          onClick={() => handleApprove(item)}
                          disabled={busy}
                          className="px-2.5 py-1 bg-[#059669] text-white rounded-none border border-[#059669] font-mono text-[10px] uppercase tracking-wider hover:bg-[#047857] disabled:opacity-40 transition-colors"
                        >
                          Patvirtinti
                        </button>
                      )}
                      <button
                        onClick={() => startCreate(item)}
                        disabled={busy}
                        className="px-2.5 py-1 bg-[#1a1a1a] text-white rounded-none border border-[#1a1a1a] font-mono text-[10px] uppercase tracking-wider hover:bg-[#333] disabled:opacity-40 transition-colors"
                      >
                        Naujas
                      </button>
                      <button
                        onClick={() => handleSkip(item)}
                        disabled={busy}
                        className="px-2.5 py-1 rounded-none border border-[#e5e5e0] text-[#8a8a82] font-mono text-[10px] uppercase tracking-wider hover:border-[#1a1a1a] hover:text-[#1a1a1a] disabled:opacity-40 transition-colors"
                      >
                        Praleisti
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center font-mono text-[11px] text-[#8a8a82]">
                  Nėra laukiančių peržiūros ✓
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
