import { afterEach, describe, expect, it, vi } from 'vitest';
import { BinanceMarketDataProvider, parseKlines, quoteFromTicker } from '../src/providers/binance';
import type { QuoteResult } from '../src/types/market';
const end = 1790245800000;
const kline = (time: number) => [time, '100', '120', '90', '110', '25', time + 899999];
const candlePayload = [kline(end - 1800000), kline(end - 900000)];
const ticker = (symbol: string) => ({ symbol, lastPrice: '110', openPrice: '100', highPrice: '120', lowPrice: '90', closeTime: end });
const markets = { symbols: [
  { symbol: 'GRAMUSDT', baseAsset: 'GRAM', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'NEWUSDT', baseAsset: 'NEW', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'HALTUSDT', baseAsset: 'HALT', quoteAsset: 'USDT', status: 'BREAK', isSpotTradingAllowed: true },
] };
function fixture() {
  const calls: URL[] = [];
  const fetcher = vi.fn<typeof fetch>(async input => {
    const url = new URL(String(input)); calls.push(url);
    if (url.pathname.endsWith('exchangeInfo')) return Response.json(markets);
    if (url.pathname.endsWith('ticker/24hr')) return Response.json(JSON.parse(url.searchParams.get('symbols')!).map(ticker));
    if (url.pathname.endsWith('klines')) return Response.json(candlePayload);
    throw new Error('Unexpected request');
  });
  return { calls, fetcher, provider: new BinanceMarketDataProvider(fetcher) };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('Binance data normalization', () => {
  it('validates candles and converts milliseconds to seconds', () => {
    const rows = parseKlines([candlePayload[1], candlePayload[0], candlePayload[0]]);
    expect(rows).toHaveLength(2); expect(rows[0].time).toBe((end - 1800000) / 1000);
    expect(rows[0]).toMatchObject({ open: 100, close: 110, high: 120, low: 90, volume: 25 });
    expect(() => parseKlines([[end, '100', '90', '110', '100', '2', end]])).toThrow();
    expect(() => parseKlines({ code: -1 })).toThrow();
  });
  it('anchors the sparkline to the same rolling 24h baseline as the percent', () => {
    const quote = quoteFromTicker('btc', ticker('BTCUSDT'), parseKlines(candlePayload));
    expect(quote.change24h).toBeCloseTo(10);
    expect(quote.sparkline[0]).toEqual({ time: end / 1000 - 86400, value: 100 });
    expect(quote.sparkline.at(-1)).toEqual({ time: end / 1000, value: 110 });
    expect(quote.sparkline.every((point, i, points) => i === 0 || point.time > points[i - 1].time)).toBe(true);
  });
  it('batches quotes, caches history and isolates unsupported assets', async () => {
    const { provider, calls } = fixture();
    const quotes = await provider.getQuotes(['btc', 'eth', 'ltc']);
    expect(quotes.find(q => q.assetId === 'ltc')).toHaveProperty('error');
    expect(quotes.find(q => q.assetId === 'btc')).toHaveProperty('price', 110);
    expect(calls.filter(url => url.pathname.endsWith('ticker/24hr'))).toHaveLength(1);
    await provider.getQuotes(['btc', 'eth']);
    expect(calls.filter(url => url.pathname.endsWith('klines'))).toHaveLength(2);
    expect((await provider.searchAssets('new')).map(asset => asset.id)).toEqual(['binance:NEW']);
    expect(await provider.searchAssets('halt')).toEqual([]);
    expect(provider.getAsset('binance:NEW')?.symbol).toBe('NEW');
  });
  it('paginates with an exclusive endTime and honors cancellation', async () => {
    const { provider, calls } = fixture();
    await provider.getHistory('btc', { interval: '1h', before: 1700000000, limit: 1500 });
    const url = calls.at(-1)!;
    expect(url.searchParams.get('endTime')).toBe('1699999999999');
    expect(url.searchParams.get('interval')).toBe('1h'); expect(url.searchParams.get('limit')).toBe('1000');
    const controller = new AbortController(); controller.abort();
    await expect(provider.getQuotes(['btc'], controller.signal)).rejects.toThrow();
    expect(calls).toHaveLength(2);
  });
  it('respects rate-limit Retry-After instead of retrying immediately', async () => {
    const { provider, fetcher, calls } = fixture();
    await provider.searchAssets('btc');
    fetcher.mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    await expect(provider.getQuotes(['btc'])).rejects.toMatchObject({ retryAfterMs: 120000 });
    const count = fetcher.mock.calls.length;
    await expect(provider.getQuotes(['btc'])).rejects.toThrow('Rate limit');
    expect(fetcher).toHaveBeenCalledTimes(count); expect(calls).toHaveLength(1);
  });
});
it('streams real ticker values and stops publishing after unsubscribe', async () => {
  class Socket {
    static current: Socket;
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;
    closed = false;
    constructor(readonly url: string) { Socket.current = this; }
    close() { this.closed = true; }
  }
  vi.stubGlobal('WebSocket', Socket);
  const { provider } = fixture(); const updates: QuoteResult[][] = [];
  const errors = vi.fn(); const stop = provider.subscribeQuotes(['btc'], quotes => updates.push(quotes), errors);
  await vi.waitFor(() => expect(Socket.current).toBeDefined());
  expect(Socket.current.url).toContain('btcusdt@ticker');
  Socket.current.onmessage?.({ data: JSON.stringify({ data: { e: '24hrTicker', s: 'BTCUSDT', c: '115', o: '100', h: '120', l: '90', C: end + 1000 } }) });
  expect(updates.at(-1)?.[0]).toMatchObject({ assetId: 'btc', price: 115, updatedAt: end / 1000 + 1 });
  stop(); expect(Socket.current.closed).toBe(true); expect(Socket.current.onmessage).toBeNull(); expect(errors).not.toHaveBeenCalled();
});

it('maps the confirmed former Toncoin to GRAMUSDT and finds it by its old name', async () => {
  const { provider, calls } = fixture();
  expect((await provider.searchAssets('toncoin')).map(asset => asset.id)).toEqual(['gram']);
  const quote = await provider.getQuote('gram');
  expect(quote).toMatchObject({ assetId: 'gram', price: 110 });
  const tickerRequest = calls.find(url => url.pathname.endsWith('ticker/24hr'))!;
  expect(JSON.parse(tickerRequest.searchParams.get('symbols')!)).toEqual(['GRAMUSDT']);
  expect(calls.find(url => url.pathname.endsWith('klines'))?.searchParams.get('symbol')).toBe('GRAMUSDT');
  expect(await provider.getQuotes(['ton'])).toEqual([{ assetId: 'ton', error: 'Toncoin now trades as GRAM. Add GRAM instead.' }]);
});
