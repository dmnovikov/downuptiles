import { afterEach, expect, it, vi } from 'vitest';
import { readQuoteCache, writeQuoteCache, quoteCacheKey } from '../src/storage/quotes';
import { MockMarketDataProvider } from '../src/providers/mock';
import { MarketStore } from '../src/services/market';
afterEach(() => vi.unstubAllGlobals());
it('restores quotes as stale and separates exchange caches', () => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  const quote = new MockMarketDataProvider().quoteAt('btc', Math.floor(Date.now() / 1000));
  writeQuoteCache('Binance', [quote]);
  const store = new MarketStore('Binance');
  expect(store.getQuote('btc')).toEqual(quote);
  expect(store.getQuoteError('btc')).toBe('Stale data');
  expect(readQuoteCache('Demo')).toEqual([]);
  values.set(quoteCacheKey('Binance'), JSON.stringify([{ ...quote, sparkline: [] }, { ...quote, price: 'bad' }]));
  expect(readQuoteCache('Binance')).toEqual([]);
  values.set(quoteCacheKey('Binance'), '{broken');
  expect(readQuoteCache('Binance')).toEqual([]);
});
it('tolerates unavailable storage', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } });
  expect(readQuoteCache('Binance')).toEqual([]);
  expect(() => writeQuoteCache('Binance', [])).not.toThrow();
});
