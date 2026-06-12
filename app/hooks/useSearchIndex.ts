'use client';

import { useState, useEffect, useCallback } from 'react';
import Fuse from 'fuse.js';

export interface SearchEntry {
  id: number;
  name_lt: string;
  name_en: string | null;
  aliases: string[];
  category: string | null;
  min_price: number | null;
  lab_count: number;
}

// Module-level cache — loaded once per browser session, shared across all consumers.
let _fuse: Fuse<SearchEntry> | null = null;
let _loading = false;
const _listeners: Array<(fuse: Fuse<SearchEntry>) => void> = [];

function loadIndex(onReady: (fuse: Fuse<SearchEntry>) => void): void {
  if (_fuse) { onReady(_fuse); return; }
  _listeners.push(onReady);
  if (_loading) return;
  _loading = true;
  fetch('/test-index.json')
    .then(r => r.json())
    .then((data: SearchEntry[]) => {
      _fuse = new Fuse(data, {
        keys: [
          { name: 'name_lt', weight: 3 },
          { name: 'name_en', weight: 2 },
          { name: 'aliases', weight: 1.5 },
        ],
        threshold: 0.28,
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 2,
      });
      _listeners.splice(0).forEach(cb => cb(_fuse!));
    })
    .catch(err => { _loading = false; console.error('search index load failed:', err); });
}

export function useSearchIndex() {
  const [fuse, setFuse] = useState<Fuse<SearchEntry> | null>(_fuse);

  useEffect(() => {
    if (_fuse) { setFuse(_fuse); return; }
    loadIndex(setFuse);
  }, []);

  const search = useCallback(
    (query: string, limit = 20): SearchEntry[] => {
      if (!fuse || !query.trim()) return [];
      return fuse.search(query.trim(), { limit }).map(r => r.item);
    },
    [fuse]
  );

  return { search, ready: !!fuse };
}
