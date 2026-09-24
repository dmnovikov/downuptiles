import { useEffect, useState } from 'react';
import { binance, mexc, demo, isDemo } from '../providers/registry';
import { rankMarketMovers } from '../services/movers';
import type { MarketTicker } from '../types/market';
export type MarketExchange = 'binance' | 'mexc';
interface Snapshot { gainers: MarketTicker[]; losers: MarketTicker[]; count: number; loadedAt: number }
const cache = new Map<MarketExchange, Snapshot>();
export function useMarketMovers(exchange: MarketExchange) {
  const [data, setData] = useState<Snapshot | undefined>(() => cache.get(exchange));
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [historyFailed, setHistoryFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const source = isDemo ? demo : exchange === 'binance' ? binance : mexc;
    let controller: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const stop = () => { clearTimeout(timer); controller?.abort(); };
    const run = async (useCache = false) => {
      stop();
      if (disposed) return;
      if (!navigator.onLine || document.hidden) { setLoading(false); setError(!navigator.onLine ? 'Offline · Showing the last ranking.' : 'Updates paused.'); return; }
      controller = new AbortController(); const signal = controller.signal;
      const previous = cache.get(exchange);
      if (useCache && previous && Date.now() - previous.loadedAt < 60000) {
        setData(previous); setLoading(false); setError('');
        timer = setTimeout(() => void run(), 60000 - (Date.now() - previous.loadedAt)); return;
      }
      setLoading(true); setError(''); setHistoryFailed(false);
      let delay = 60000;
      try {
        const tickers = await source.getMarketTickers(signal);
        if (signal.aborted) return;
        const ranked = rankMarketMovers(tickers);
        if (!ranked.count) throw new Error('No fresh market data is available.');
        const snapshot: Snapshot = { ...ranked, loadedAt: Date.now() };
        cache.set(exchange, snapshot); setData(snapshot); setLoading(false);
        // Prices/ranking are one coherent snapshot; candles enrich only the displayed pairs.
        const visible = [...snapshot.gainers, ...snapshot.losers];
        const enriched = new Map<string, MarketTicker>();
        for (let offset = 0; offset < visible.length; offset += 4) {
          if (signal.aborted) return;
          await Promise.all(visible.slice(offset, offset + 4).map(async quote => {
            try {
              const candles = await source.getHistory(quote.assetId, { interval: '15m', limit: 100, signal });
              if (signal.aborted) return;
              const end = quote.updatedAt, start = end - 86400;
              const sparkline = [{ time: start, value: quote.price / (1 + quote.change24h / 100) },
                ...candles.filter(c => c.time + 900 > start && c.time + 900 < end).map(c => ({ time: c.time + 900, value: c.close })),
                { time: end, value: quote.price }];
              enriched.set(quote.assetId, { ...quote, sparkline });
            } catch { if (!signal.aborted) setHistoryFailed(true); }
          }));
          if (signal.aborted) return;
          const next = { ...snapshot, gainers: snapshot.gainers.map(q => enriched.get(q.assetId) ?? q), losers: snapshot.losers.map(q => enriched.get(q.assetId) ?? q) };
          cache.set(exchange, next); setData(next);
        }
        delay = Math.max(1000, 60000 - (Date.now() - snapshot.loadedAt));
      } catch (failure) {
        if (signal.aborted) return;
        setError(failure instanceof Error ? failure.message : 'Market ranking is unavailable.');
        if (failure && typeof failure === 'object' && 'retryAfterMs' in failure) delay = Math.max(delay, Number(failure.retryAfterMs) || 0);
      } finally {
        if (!signal.aborted && !disposed) { setLoading(false); timer = setTimeout(() => void run(), delay); }
      }
    };
    const resume = () => void run();
    window.addEventListener('online', resume); window.addEventListener('offline', resume); document.addEventListener('visibilitychange', resume);
    void run(retry === 0);
    return () => { disposed = true; stop(); window.removeEventListener('online', resume); window.removeEventListener('offline', resume); document.removeEventListener('visibilitychange', resume); };
  }, [exchange, retry]);
  return { data, loading, error, historyFailed, retry: () => setRetry(n => n + 1) };
}
