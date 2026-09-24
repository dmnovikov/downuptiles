import { expect, it } from 'vitest';
import { rankMovers, type MoverEntry } from '../src/services/movers';
const now = 1700000000;
function entry(id: string, change24h: number, extra: Partial<MoverEntry> = {}): MoverEntry {
  return { id, status: 'live', quote: { assetId: id, change24h, price: 10, updatedAt: now, high24h: 12, low24h: 9, sparkline: [{ time: now, value: 10 }] }, ...extra };
}
it('ranks at most five positive and negative pairs from strongest moves, with deterministic ties', () => {
  const result = rankMovers([...Array.from({ length: 8 }, (_, i) => entry(`up${i}`, i + 1)), ...Array.from({ length: 8 }, (_, i) => entry(`down${i}`, -i - 1)), entry('flat', .001)], now);
  expect(result.gainers.map(e => e.id)).toEqual(['up7', 'up6', 'up5', 'up4', 'up3']);
  expect(result.losers.map(e => e.id)).toEqual(['down7', 'down6', 'down5', 'down4', 'down3']);
  expect(rankMovers([entry('b', 2), entry('a', 2)], now).gainers.map(e => e.id)).toEqual(['a', 'b']);
});
it('deduplicates exchange pairs but keeps the same symbol from different exchanges', () => {
  const result = rankMovers([entry('btc', 2), entry('btc', 2), entry('mexc:BTC', 3)], now);
  expect(result.total).toBe(2);
  expect(result.gainers.map(e => e.id)).toEqual(['mexc:BTC', 'btc']);
});
it('excludes missing, cached, stale, offline and failed prices without hiding healthy exchange data', () => {
  const old = entry('old', 99); old.quote!.updatedAt = now - 61;
  const result = rankMovers([old, entry('cached', 80, { error: 'Stale data' }), entry('offline', 90, { status: 'offline' }), entry('connecting', 75, { status: 'connecting' }), entry('failed', 100, { status: 'error' }), entry('missing', 5, { quote: undefined }), entry('mexc:BTC', 2, { status: 'polling' }), entry('btc', -3)], now);
  expect(result.freshCount).toBe(2); expect(result.gainers.map(e => e.id)).toEqual(['mexc:BTC']); expect(result.losers.map(e => e.id)).toEqual(['btc']);
  expect(rankMovers([], now)).toEqual({ gainers: [], losers: [], total: 0, freshCount: 0 });
});
