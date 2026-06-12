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
        <h1 className="text-xl font-bold text-gray-900 mb-6">Administratoriaus sritis</h1>
        <form onSubmit={(e) => { e.preventDefault(); fetchQueue(token); }} className="space-y-3">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Slaptažodis"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {authError && <p className="text-red-500 text-sm">{authError}</p>}
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Žymėjimų peržiūra</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} liko · {highConf} virš 90% pasitikėjimo
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm text-gray-500">{msg}</span>}
          <button
            onClick={handleBulkApprove}
            disabled={bulkBusy || highConf === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {bulkBusy ? 'Tvirtinama...' : `Patvirtinti visus ≥90% (${highConf})`}
          </button>
          <button
            onClick={downloadCsv}
            disabled={items.length === 0}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Atsisiųsti CSV
          </button>
          <button
            onClick={() => fetchQueue(token)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Atnaujinti
          </button>
        </div>
      </div>

      {/* Create-new inline form */}
      {creatingId !== null && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
          <span className="text-sm font-medium text-blue-800 whitespace-nowrap">Naujas kanoninis pavadinimas:</span>
          <input
            autoFocus
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmCreate(); if (e.key === 'Escape') setCreatingId(null); }}
            className="flex-1 px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={confirmCreate}
            disabled={busyIds.has(creatingId)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Sukurti
          </button>
          <button
            onClick={() => setCreatingId(null)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Atšaukti
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-2 text-left font-medium">Laboratorija</th>
              <th className="px-4 py-2 text-left font-medium">Originalus pavadinimas</th>
              <th className="px-4 py-2 text-left font-medium">AI komentaras</th>
              <th className="px-4 py-2 text-left font-medium">Siūloma atitiktis</th>
              <th className="px-4 py-2 text-right font-medium">Tikimybė</th>
              <th className="px-4 py-2 text-right font-medium">Veiksmai</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const conf = item.ai_confidence ?? 0;
              const busy = busyIds.has(item.id);
              const confColor = conf >= 0.90
                ? 'text-green-700 bg-green-50'
                : conf >= 0.70
                ? 'text-yellow-700 bg-yellow-50'
                : 'text-red-700 bg-red-50';

              return (
                <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-700">
                    {item.labs?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-800 max-w-xs">
                    <span className="line-clamp-2">{item.raw_name}</span>
                    {item.price_eur && (
                      <span className="text-xs text-gray-400 mt-0.5 block">€{Number(item.price_eur).toFixed(2)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">
                    <span className="line-clamp-2">{item.ai_reasoning ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {item.tests ? (
                      <a
                        href={`/test/${item.tests.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline text-xs line-clamp-2"
                      >
                        {item.tests.canonical_name_lt}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {item.ai_confidence != null ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium tabular-nums ${confColor}`}>
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
                          className="px-2.5 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
                        >
                          Patvirtinti
                        </button>
                      )}
                      <button
                        onClick={() => startCreate(item)}
                        disabled={busy}
                        className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                      >
                        Naujas
                      </button>
                      <button
                        onClick={() => handleSkip(item)}
                        disabled={busy}
                        className="px-2.5 py-1 border border-gray-300 text-gray-600 rounded text-xs font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors"
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
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
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
