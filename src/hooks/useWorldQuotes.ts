import { useEffect, useState } from 'react';
import { WORLD_ASSETS, type WorldQuote } from '../types/world';
interface Entry { quote?: WorldQuote; error?: string; refreshing: boolean }
const KEY = 'downuptiles.world-quotes.yahoo.v1';
function valid(q: WorldQuote): boolean {
  return q && WORLD_ASSETS.some(a => a.id === q.id) && Number.isFinite(q.price) && q.price > 0
    && (q.change === null || Number.isFinite(q.change)) && Number.isFinite(Date.parse(q.asOf))
    && ['status', 'period', 'historyLabel', 'note', 'sourceUrl'].every(key => typeof q[key as keyof WorldQuote] === 'string')
    && Array.isArray(q.points) && q.points.length <= 1000 && q.points.every(p => Number.isFinite(p.time) && Number.isFinite(p.value) && p.value > 0)
    && Array.isArray(q.candles) && q.candles.length <= 1000 && q.candles.every(c => [c.time, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite));
}
function readCache(): Record<string, WorldQuote> {
  try {
    const raw = localStorage.getItem(KEY); if (!raw || raw.length > 2000000) return {};
    const values: unknown = JSON.parse(raw); if (!Array.isArray(values)) return {};
    return Object.fromEntries(values.filter(valid).map(q => [q.id, q]));
  } catch { return {}; }
}
const cached = readCache();
function save() { try { localStorage.setItem(KEY, JSON.stringify(Object.values(cached))); } catch { /* Optional cache. */ } }
export function useWorldQuotes(ids: string[], interval = '15m') {
  const key = ids.join(',');
  const [entries, setEntries] = useState<Record<string, Entry>>(() => Object.fromEntries(ids.map(id => [id, { quote: cached[id], refreshing: true }])));
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const selected = key.split(',').filter(Boolean);
    let controller: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined, disposed = false;
    const stop = () => { clearTimeout(timer); controller?.abort(); };
    const run = async () => {
      stop(); if (disposed) return;
      if (!navigator.onLine || document.hidden) {
        setEntries(previous => Object.fromEntries(selected.map(id => [id, { ...previous[id], quote: previous[id]?.quote ?? cached[id], refreshing: false, error: !navigator.onLine ? 'Offline' : 'Updates paused' }]))); return;
      }
      controller = new AbortController(); const signal = controller.signal;
      setEntries(previous => Object.fromEntries(selected.map(id => [id, { ...previous[id], quote: previous[id]?.quote ?? cached[id], refreshing: true }])));
      await Promise.all(selected.map(async id => {
        const timeout = setTimeout(() => request.abort(), 30000), request = new AbortController();
        const abort = () => request.abort(); signal.addEventListener('abort', abort, { once: true });
        try {
          const response = await fetch(`/api/world/quote?id=${encodeURIComponent(id)}&interval=${encodeURIComponent(interval)}`, { signal: request.signal });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Source unavailable');
          if (!valid(data) || data.id !== id) throw new Error('Invalid market quote');
          if (signal.aborted) return;
          cached[id] = data; setEntries(previous => ({ ...previous, [id]: { quote: data, refreshing: false } }));
        } catch (failure) {
          if (!signal.aborted) setEntries(previous => ({ ...previous, [id]: { quote: previous[id]?.quote ?? cached[id], refreshing: false, error: failure instanceof Error ? failure.message : 'Source unavailable' } }));
        } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
      }));
      if (!signal.aborted && !disposed) { save(); timer = setTimeout(() => void run(), 60000); }
    };
    const resume = () => void run();
    window.addEventListener('online', resume); window.addEventListener('offline', resume); document.addEventListener('visibilitychange', resume);
    void run();
    return () => { disposed = true; stop(); save(); window.removeEventListener('online', resume); window.removeEventListener('offline', resume); document.removeEventListener('visibilitychange', resume); };
  }, [key, interval, retry]);
  return { entries, retry: () => setRetry(n => n + 1) };
}
