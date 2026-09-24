import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { market } from '../services/market';
export function useQuote(id: string) {
  return useSyncExternalStore(useCallback(fn => market.subscribe(id, fn), [id]), useCallback(() => market.getQuote(id), [id]));
}
export function useConnection() { return useSyncExternalStore(market.subscribeStatus, market.getStatus); }
export function useMarket(ids: string[]) {
  const key = [...new Set(ids)].sort().join(',');
  useEffect(() => market.connect(key ? key.split(',') : []), [key]);
}

export function useQuoteError(id: string) {
  return useSyncExternalStore(useCallback(fn => market.subscribe(id, fn), [id]), useCallback(() => market.getQuoteError(id), [id]));
}
