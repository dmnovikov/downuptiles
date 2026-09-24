import { readQuoteCache, writeQuoteCache } from '../storage/quotes';
import { binance, mexc, demo, isDemo } from '../providers/registry';
export { provider, providerFor } from '../providers/registry';
import type { ConnectionState, MarketDataProvider, Quote, QuoteResult } from '../types/market';
const primary = isDemo ? demo : binance;
/** A single subscription for the visible assets; per-asset listeners keep tile updates isolated. */
export class MarketStore {
  private quotes = new Map<string, Quote>();
  private errors = new Map<string, string>();
  private listeners = new Map<string, Set<() => void>>();
  private statusListeners = new Set<() => void>();
  private status: ConnectionState = 'paused';
  private lastSaved = 0;
  private cacheDirty = false;
  constructor(private cacheSource = primary.name) {
    for (const quote of readQuoteCache(cacheSource)) {
      this.quotes.set(quote.assetId, quote);
      this.errors.set(quote.assetId, 'Stale data');
    }
  }
  private saveCache = () => {
    if (!this.cacheDirty) return;
    writeQuoteCache(this.cacheSource, this.quotes.values());
    this.cacheDirty = false; this.lastSaved = Date.now();
  };
  getQuote = (id: string) => this.quotes.get(id);
  getStatus = () => this.status;
  getQuoteError = (id: string) => this.errors.get(id);
  subscribe = (id: string, callback: () => void) => {
    const set = this.listeners.get(id) ?? new Set(); set.add(callback); this.listeners.set(id, set);
    return () => { set.delete(callback); if (!set.size) this.listeners.delete(id); };
  };
  subscribeStatus = (callback: () => void) => { this.statusListeners.add(callback); return () => { this.statusListeners.delete(callback); }; };
  private setStatus(state: ConnectionState) { this.status = state; this.statusListeners.forEach(fn => fn()); }
  private publish = (quotes: QuoteResult[]) => {
    for (const quote of quotes) {
      if ('error' in quote) this.errors.set(quote.assetId, quote.error);
      else { this.quotes.set(quote.assetId, quote); this.errors.delete(quote.assetId); this.cacheDirty = true; }
      this.listeners.get(quote.assetId)?.forEach(fn => fn());
    }
    if (Date.now() - this.lastSaved >= 5000) this.saveCache();
  };
  connect(ids: string[], source: MarketDataProvider = primary) {
    let disposed = false, stop: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let retryLive: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let generation = 0;
    const clear = () => { generation++; stop?.(); stop = undefined; clearTimeout(timer); clearInterval(watchdog); clearTimeout(retryLive); controller?.abort(); };
    const start = () => {
      this.saveCache();
      clear();
      if (disposed) return;
      if (!navigator.onLine) { this.setStatus('offline'); return; }
      if (document.hidden || !ids.length) { this.setStatus('paused'); return; }
      controller = new AbortController();
      const token = generation;
      let failures = 0;
      const poll = async () => {
        if (disposed || token !== generation) return;
        let delay = 5000;
        try {
          const quotes = await source.getQuotes(ids, controller?.signal);
          if (disposed || token !== generation) return;
          this.publish(quotes);
          if (quotes.length && quotes.every(q => 'error' in q)) throw new Error('Market data unavailable');
          failures = 0; this.setStatus('polling');
        } catch (error) {
          failures++; delay = Math.min(60000, 5000 * 2 ** Math.min(failures, 4));
          if (error && typeof error === 'object' && 'retryAfterMs' in error) delay = Math.max(delay, Number(error.retryAfterMs) || 0);
          if (!disposed && token === generation) {
            this.publish(ids.map(assetId => ({ assetId, error: error instanceof Error ? error.message : 'Market data unavailable' })));
            this.setStatus('error');
          }
        }
        if (!disposed && token === generation) timer = setTimeout(() => void poll(), delay);
      };
      this.setStatus('connecting');
      if (!source.subscribeQuotes) { void poll(); return; }
      let lastUpdate = Date.now(), fallback = false;
      const usePolling = () => {
        if (fallback || disposed || token !== generation) return;
        fallback = true; stop?.(); clearInterval(watchdog); this.setStatus('error'); void poll();
        retryLive = setTimeout(start, 60000);
      };
      this.setStatus('connecting');
      try {
        stop = source.subscribeQuotes(ids, quotes => {
          if (disposed || fallback || token !== generation) return;
          lastUpdate = Date.now(); this.publish(quotes); this.setStatus('live');
        }, usePolling);
        watchdog = setInterval(() => { if (Date.now() - lastUpdate > 30000) usePolling(); }, 5000);
      } catch { usePolling(); }
    };
    window.addEventListener('online', start); window.addEventListener('offline', start); document.addEventListener('visibilitychange', start);
    window.addEventListener('pagehide', this.saveCache);
    start();
    return () => { this.saveCache(); window.removeEventListener('pagehide', this.saveCache); disposed = true; clear(); window.removeEventListener('online', start); window.removeEventListener('offline', start); document.removeEventListener('visibilitychange', start); };
  }
}
export const market = new MarketStore();

export const mexcMarket = new MarketStore(mexc.name);
export function marketFor(id: string) { return !isDemo && id.startsWith('mexc:') ? mexcMarket : market; }
