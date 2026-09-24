import { INTERVALS, type Asset, type Candle, type HistoryRequest, type MarketDataProvider, type Quote } from '../types/market';
const catalog = [
  ['btc', 'BTC', 'Bitcoin', '#f3ac57', 67432.50, 2.84],
  ['eth', 'ETH', 'Ethereum', '#9faafa', 3521.08, -1.62],
  ['sol', 'SOL', 'Solana', '#b393fb', 172.46, 18.42],
  ['ltc', 'LTC', 'Litecoin', '#aabbd6', 82.37, -3.17],
  ['gram', 'GRAM', 'Gram', '#6ac6ed', 0.008421, 54.82],
  ['trx', 'TRX', 'TRON', '#ec7581', 0.12842, 0.73],
  ['bnb', 'BNB', 'BNB', '#edc864', 598.12, -0.84],
  ['xrp', 'XRP', 'XRP', '#b9c8d0', 0.58324, 33.21],
  ['doge', 'DOGE', 'Dogecoin', '#c8af69', 0.1428, 8.34],
  ['ada', 'ADA', 'Cardano', '#689dec', 0.4382, -4.12],
  ['avax', 'AVAX', 'Avalanche', '#ed7979', 36.42, 5.21],
  ['link', 'LINK', 'Chainlink', '#7c9ffa', 17.24, 1.42],
  ['dot', 'DOT', 'Polkadot', '#e887bb', 6.73, -2.82],
  ['ton', 'TON', 'Toncoin', '#62c0eb', 7.12, 7.21],
  ['uni', 'UNI', 'Uniswap', '#ec8ebd', 10.24, -6.18],
  ['near', 'NEAR', 'NEAR Protocol', '#bcdccc', 5.48, 12.84],
  ['atom', 'ATOM', 'Cosmos', '#c1b2df', 8.43, -1.8],
  ['arb', 'ARB', 'Arbitrum', '#7fb4e1', 1.12, 3.14],
  ['op', 'OP', 'Optimism', '#ec827e', 2.48, 6.31],
  ['sui', 'SUI', 'Sui', '#7dbeed', 1.08, 22.1],
  ['pepe', 'PEPE', 'Pepe', '#99bd6c', 0.00001234, 42.3],
  ['shib', 'SHIB', 'Shiba Inu', '#eda36d', 0.00002412, -8.2],
  ['aave', 'AAVE', 'Aave', '#a695de', 102.35, 4.7],
  ['apt', 'APT', 'Aptos', '#b2dbd8', 8.32, -2.4],
] as const;
const DAY = 86400;
export class MockMarketDataProvider implements MarketDataProvider {
  readonly name = 'Demo';
  readonly isDemo = true;
  private readonly origin: number;
  constructor(now = Date.now()) { this.origin = Math.floor(now / 1000 / DAY) * DAY; }
  getAsset(id: string): Asset | undefined {
    const row = catalog.find(a => a[0] === id);
    return row ? { id: row[0], symbol: row[1], name: row[2], color: row[3] } : undefined;
  }
  async searchAssets(query: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    return catalog.filter(a => `${a[1]} ${a[2]}`.toLowerCase().includes(query.trim().toLowerCase())).map(a => this.getAsset(a[0])!);
  }
  async getMarketTickers(signal?: AbortSignal) {
    signal?.throwIfAborted();
    return catalog.map((asset, i) => ({ ...this.quoteAt(asset[0], Math.floor(Date.now() / 1000)), quoteVolume: (catalog.length - i) * 1000000 }));
  }
  /** One deterministic price function backs quotes, all candle intervals, and sparklines. */
  priceAt(id: string, time: number): number {
    const i = catalog.findIndex(a => a[0] === id);
    if (i < 0) throw new Error('Unknown asset');
    const row = catalog[i];
    const days = (time - this.origin) / DAY;
    const phase = i * 2.17;
    const wave = .018 * Math.sin(days * 9 + phase) + .008 * Math.sin(days * 31 + phase) + .003 * Math.sin(days * 113 + phase) + .0006 * Math.sin(days * 1807 + phase);
    const drift = Math.log(1 + row[5] / 100) * 12 * Math.tanh(days / 12);
    return row[4] * Math.exp(drift + wave);
  }
  quoteAt(id: string, now: number): Quote {
    const start = now - DAY;
    const sparkline = [{ time: start, value: this.priceAt(id, start) }];
    for (let time = Math.floor(start / 900) * 900 + 900; time < now; time += 900) sparkline.push({ time, value: this.priceAt(id, time) });
    const price = this.priceAt(id, now);
    sparkline.push({ time: now, value: price });
    // Minute samples provide the same daily high/low source as the candles.
    let high24h = price, low24h = price;
    for (let time = start; time <= now; time += 60) {
      const p = this.priceAt(id, time); high24h = Math.max(high24h, p); low24h = Math.min(low24h, p);
    }
    return { assetId: id, price, change24h: (price / sparkline[0].value - 1) * 100, updatedAt: now, high24h, low24h, sparkline };
  }
  async getQuote(id: string, signal?: AbortSignal) { signal?.throwIfAborted(); return this.quoteAt(id, Math.floor(Date.now() / 1000)); }
  async getQuotes(ids: string[], signal?: AbortSignal) {
    signal?.throwIfAborted(); const now = Math.floor(Date.now() / 1000);
    return ids.map(id => this.quoteAt(id, now));
  }
  async getHistory(id: string, { interval, limit = 240, before, signal }: HistoryRequest): Promise<Candle[]> {
    signal?.throwIfAborted();
    const now = Math.floor(Date.now() / 1000), step = INTERVALS[interval];
    const last = before === undefined ? Math.floor(now / step) * step : Math.floor(before / step) * step - step;
    return Array.from({ length: Math.min(limit, 1000) }, (_, index) => {
      const time = last - (Math.min(limit, 1000) - 1 - index) * step;
      const end = Math.min(time + step, now);
      const open = this.priceAt(id, time), close = this.priceAt(id, end);
      let high = Math.max(open, close), low = Math.min(open, close);
      const sampleStep = Math.max(60, step / 240);
      for (let t = time + sampleStep; t < end; t += sampleStep) {
        const price = this.priceAt(id, t); high = Math.max(high, price); low = Math.min(low, price);
      }
      const volume = (18000 + Math.abs(Math.sin(time / step * 1.78)) * 80000) / open * ((end - time) / step);
      return { time, open, high, low, close, volume };
    });
  }
  subscribeQuotes(ids: string[], onQuotes: (quotes: Quote[]) => void, onError: (error: Error) => void) {
    let stopped = false;
    const tick = () => { this.getQuotes(ids).then(quotes => { if (!stopped) onQuotes(quotes); }).catch(onError); };
    tick(); const timer = setInterval(tick, 2000);
    return () => { stopped = true; clearInterval(timer); };
  }
}
