import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { market, mexcMarket, marketFor } from '../services/market';
import { binance, demo, mexc, isDemo } from '../providers/registry';
export function useQuote(id: string) {
  const store = marketFor(id);
  return useSyncExternalStore(useCallback(fn => store.subscribe(id, fn), [store, id]), useCallback(() => store.getQuote(id), [store, id]));
}
export function useConnection(id?: string) {
  const first = useSyncExternalStore(market.subscribeStatus, market.getStatus);
  const second = useSyncExternalStore(mexcMarket.subscribeStatus, mexcMarket.getStatus);
  if (id) return marketFor(id) === market ? first : second;
  const active = [first, second].filter(status => status !== 'paused');
  return active.find(status => status === 'offline') ?? active.find(status => status === 'error')
    ?? active.find(status => status === 'connecting') ?? active.find(status => status === 'polling') ?? active[0] ?? 'paused';
}
export function useMarket(ids: string[]) {
  const key = [...new Set(ids)].sort().join(',');
  useEffect(() => {
    const all = key ? key.split(',') : [];
    const stopPrimary = market.connect(all.filter(id => isDemo || !id.startsWith('mexc:')), isDemo ? demo : binance);
    const stopMexc = mexcMarket.connect(all.filter(id => !isDemo && id.startsWith('mexc:')), mexc);
    return () => { stopPrimary(); stopMexc(); };
  }, [key]);
}
export function useQuoteError(id: string) {
  const store = marketFor(id);
  return useSyncExternalStore(useCallback(fn => store.subscribe(id, fn), [store, id]), useCallback(() => store.getQuoteError(id), [store, id]));
}
