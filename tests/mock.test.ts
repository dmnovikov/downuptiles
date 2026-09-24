import { expect, it, vi } from 'vitest';
import { MockMarketDataProvider } from '../src/providers/mock';
import { INTERVALS } from '../src/types/market';
it('keeps quote, daily sparkline, percent and current candle aligned', async () => {
  const now = new Date('2026-09-24T12:34:12Z'); vi.useFakeTimers(); vi.setSystemTime(now);
  try {
    const provider = new MockMarketDataProvider(now.getTime());
    const q = await provider.getQuote('btc');
    expect(q.sparkline.at(-1)?.value).toBe(q.price);
    expect(q.sparkline.at(-1)!.time - q.sparkline[0].time).toBe(86400);
    expect(q.change24h).toBeCloseTo((q.price / q.sparkline[0].value - 1) * 100);
    for (const interval of Object.keys(INTERVALS) as (keyof typeof INTERVALS)[]) {
      const candles = await provider.getHistory('btc', { interval, limit: 15 });
      expect(candles.at(-1)?.close).toBe(q.price);
      expect(candles.every(c => c.low <= Math.min(c.open, c.close) && c.high >= Math.max(c.open, c.close) && c.volume >= 0)).toBe(true);
      expect(candles[1].time - candles[0].time).toBe(INTERVALS[interval]);
      const older = await provider.getHistory('btc', { interval, before: candles[0].time, limit: 5 });
      expect(older.at(-1)!.time).toBe(candles[0].time - INTERVALS[interval]);
    }
  } finally { vi.useRealTimers(); }
});
it('searches by symbol/name and honors cancellation', async () => {
  const provider = new MockMarketDataProvider();
  expect((await provider.searchAssets('DOG')).map(a => a.id)).toEqual(['doge']);
  expect((await provider.searchAssets('bitcoin')).map(a => a.id)).toEqual(['btc']);
  const controller = new AbortController(); controller.abort();
  await expect(provider.getQuotes(['btc'], controller.signal)).rejects.toThrow();
});
