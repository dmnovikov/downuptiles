import { expect, it, vi } from 'vitest';
import { MexcMarketDataProvider } from '../src/providers/mexc';
const candle = [1700000000000, '10', '12', '9', '11', '50', 1700000900000];
it('uses MEXC identifiers and full names and excludes suspended/non-USDT pairs', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ symbols: [
    { symbol: 'NEWUSDT', baseAsset: 'NEW', quoteAsset: 'USDT', status: '1', fullName: 'New Coin' },
    { symbol: 'OLDUSDT', baseAsset: 'OLD', quoteAsset: 'USDT', status: '2' },
    { symbol: 'NEWBTC', baseAsset: 'NEW', quoteAsset: 'BTC', status: '1' },
  ] })));
  const provider = new MexcMarketDataProvider(fetcher);
  expect((await provider.searchAssets('New Coin')).map(a => a.id)).toEqual(['mexc:NEW']);
  expect((await provider.searchAssets('')).length).toBe(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(provider.getAsset('mexc:BTC')?.symbol).toBe('BTC');
  expect(provider.getAsset('btc')).toBeUndefined();
});
it('maps hourly/weekly intervals, paginates exclusively, and computes percentage from prices', async () => {
  const urls: string[] = [];
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    urls.push(String(url));
    return new Response(JSON.stringify(String(url).includes('klines') ? [candle] : {
      symbol: 'BTCUSDT', lastPrice: '11', openPrice: '10', highPrice: '12', lowPrice: '9', closeTime: 1700000900000, priceChangePercent: '0.1',
    }));
  });
  const provider = new MexcMarketDataProvider(fetcher);
  await provider.getHistory('mexc:BTC', { interval: '1h', before: 1700000000 });
  expect(urls[0]).toContain('interval=60m'); expect(urls[0]).toContain('endTime=1699999999999');
  await provider.getHistory('mexc:BTC', { interval: '1w' }); expect(urls[1]).toContain('interval=1W');
  const quote = await provider.getQuote('mexc:BTC');
  expect(quote.change24h).toBeCloseTo(10); expect(quote.assetId).toBe('mexc:BTC');
  await provider.getQuote('mexc:BTC');
  expect(urls.filter(u => u.includes('interval=15m'))).toHaveLength(1);
});
it('isolates failures and respects exchange rate limiting', async () => {
  const fetcher = vi.fn(async () => new Response('', { status: 429, headers: { 'Retry-After': '60' } }));
  const provider = new MexcMarketDataProvider(fetcher);
  expect((await provider.getQuotes(['mexc:BTC']))[0]).toHaveProperty('error');
  await provider.getQuotes(['mexc:BTC']); expect(fetcher).toHaveBeenCalledTimes(1);
});
