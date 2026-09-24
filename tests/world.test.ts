import { expect, it } from 'vitest';
import { normalizeYahoo } from '../server/world-data.mjs';
it('uses previous trading close, drops null candles and labels the actual session', () => {
  const data = { chart: { result: [{ meta: { regularMarketPrice: 110, regularMarketTime: 1500, previousClose: 100, chartPreviousClose: 50, currentTradingPeriod: { regular: { start: 1000, end: 2000 } } }, timestamp: [1100, 1200], indicators: { quote: [{ open: [100, null], high: [112, null], low: [99, null], close: [110, null], volume: [10, null] }] } }] } };
  const quote = normalizeYahoo('sp500', data, 1500);
  expect(quote.change).toBeCloseTo(10); expect(quote.candles).toHaveLength(1); expect(quote.status).toBe('Delay possible');
  expect(normalizeYahoo('sp500', data, 3000).status).toBe('Market closed');
  expect(normalizeYahoo('brent', data, 1500).note).toContain('futures');
  expect(() => normalizeYahoo('sp500', {})).toThrow();
});

it('labels futures and direct Yahoo FX quotes without spot or reference-rate claims', () => {
  const data = { chart: { result: [{ meta: { regularMarketPrice: 110, regularMarketTime: 1500, previousClose: 100 }, timestamp: [], indicators: { quote: [{}] } }] } };
  expect(normalizeYahoo('gold', data).note).toContain('futures');
  expect(normalizeYahoo('silver', data).sourceUrl).toContain('SI%3DF');
  const fx = normalizeYahoo('usd-uzs', data);
  expect(fx.sourceUrl).toContain('UZS%3DX');
  expect(fx.price).toBe(110);
  expect(fx.note).toContain('per one US dollar');
});
