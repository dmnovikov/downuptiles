import { afterEach, expect, it, vi } from 'vitest';
import { MarketStore } from '../src/services/market';
import { MockMarketDataProvider } from '../src/providers/mock';
import type { MarketDataProvider, QuoteResult } from '../src/types/market';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('keeps last quotes on stream failure, polls centrally, and cleans up on disconnect', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal('navigator', { onLine: true });
  const mock = new MockMarketDataProvider();
  const quote = mock.quoteAt('btc', Math.floor(Date.now() / 1000));
  const stopStream = vi.fn();
  let failStream: (error: Error) => void = () => undefined;
  const getQuotes = vi.fn(async (): Promise<QuoteResult[]> => [quote]);
  const source: MarketDataProvider = {
    name: 'test', isDemo: false, getAsset: mock.getAsset.bind(mock), searchAssets: mock.searchAssets.bind(mock),
    getQuote: mock.getQuote.bind(mock), getHistory: mock.getHistory.bind(mock), getQuotes,
    subscribeQuotes: (_ids, onQuotes, onError) => { onQuotes([quote]); failStream = onError; return stopStream; },
  };
  const store = new MarketStore();
  const disconnect = store.connect(['btc'], source);
  expect(store.getStatus()).toBe('live'); expect(store.getQuote('btc')).toEqual(quote);
  failStream(new Error('connection lost'));
  await vi.advanceTimersByTimeAsync(0);
  expect(stopStream).toHaveBeenCalledTimes(1); expect(store.getStatus()).toBe('polling');
  expect(store.getQuote('btc')).toEqual(quote); expect(getQuotes).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5000); expect(getQuotes).toHaveBeenCalledTimes(2);
  disconnect(); const count = getQuotes.mock.calls.length;
  await vi.advanceTimersByTimeAsync(120000); expect(getQuotes).toHaveBeenCalledTimes(count);
});
