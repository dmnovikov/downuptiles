import { expect, it, vi } from 'vitest';
import { parseMarketTickers } from '../src/providers/market-tickers';
import { BinanceMarketDataProvider } from '../src/providers/binance';
import { MexcMarketDataProvider } from '../src/providers/mexc';
const ticker = { symbol: 'BTCUSDT', lastPrice: '110', openPrice: '100', highPrice: '120', lowPrice: '90', closeTime: 1700000000000, quoteVolume: '1000000', priceChangePercent: '0.1' };
it('normalizes both exchange percent conventions and filters inactive, invalid and zero-volume tickers', () => {
  const ids = new Map([['BTCUSDT', 'btc']]);
  const result = parseMarketTickers([ticker, { ...ticker, symbol: 'ETHUSDT' }, { ...ticker, quoteVolume: 'NaN' }, { ...ticker, openPrice: '0' }, { ...ticker, quoteVolume: '0' }], ids);
  expect(result).toHaveLength(1); expect(result[0].change24h).toBeCloseTo(10); expect(result[0].quoteVolume).toBe(1000000); expect(result[0].sparkline).toEqual([]);
});
it.each(['binance', 'mexc'])('%s loads overview in a single ticker request without candle requests', async exchange => {
  const calls: string[] = [];
  const fetcher = vi.fn<typeof fetch>(async url => {
    calls.push(String(url));
    return Response.json(String(url).includes('exchangeInfo') ? { symbols: [
      { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: exchange === 'binance' ? 'TRADING' : '1', isSpotTradingAllowed: true },
      { symbol: 'DEADUSDT', baseAsset: 'DEAD', quoteAsset: 'USDT', status: 'HALT' },
    ] } : [ticker, { ...ticker, symbol: 'DEADUSDT' }]);
  });
  const source = exchange === 'binance' ? new BinanceMarketDataProvider(fetcher) : new MexcMarketDataProvider(fetcher);
  const rows = await source.getMarketTickers();
  expect(rows.map(q => q.assetId)).toEqual([exchange === 'binance' ? 'btc' : 'mexc:BTC']);
  expect(calls).toHaveLength(2); expect(calls[1]).toMatch(/ticker\/24hr\?$/); expect(calls.some(url => url.includes('klines'))).toBe(false);
});
