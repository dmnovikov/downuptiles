import { type Asset, type Candle, type HistoryRequest, type Interval, type MarketDataProvider, type Point, type Quote, type QuoteResult } from '../types/market';
import { KNOWN_ASSETS } from './assets';

const REST = 'https://data-api.binance.vision/api/v3';
const SOCKET = 'wss://data-stream.binance.vision/stream?streams=';
const DAY = 86400;
interface ExchangeSymbol { symbol: string; baseAsset: string; quoteAsset: string; status: string; isSpotTradingAllowed?: boolean }
interface Ticker { symbol: string; lastPrice: string; openPrice: string; highPrice: string; lowPrice: string; closeTime: number }
interface SparkCache { candles: Candle[]; fetchedAt: number }
export class MarketDataError extends Error {
  constructor(message: string, readonly retryAfterMs = 0) { super(message); }
}
function finite(value: unknown, label: string): number {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n)) throw new MarketDataError(`Invalid ${label} in market data`);
  return n;
}
export function parseKlines(payload: unknown): Candle[] {
  if (!Array.isArray(payload)) throw new MarketDataError('Invalid candle response');
  const byTime = new Map<number, Candle>();
  for (const row of payload) {
    if (!Array.isArray(row) || row.length < 7) throw new MarketDataError('Invalid candle');
    const candle: Candle = { time: finite(row[0], 'time') / 1000, open: finite(row[1], 'open'), high: finite(row[2], 'high'), low: finite(row[3], 'low'), close: finite(row[4], 'close'), volume: finite(row[5], 'volume') };
    if (candle.time < 0 || candle.low <= 0 || candle.low > Math.min(candle.open, candle.close) || candle.high < Math.max(candle.open, candle.close) || candle.volume < 0) throw new MarketDataError('Invalid candle values');
    byTime.set(candle.time, candle);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
export function quoteFromTicker(id: string, ticker: Ticker, candles: Candle[]): Quote {
  const price = finite(ticker.lastPrice, 'price'), open = finite(ticker.openPrice, '24h open');
  if (price <= 0 || open <= 0) throw new MarketDataError('Invalid ticker price');
  const now = Math.floor(finite(ticker.closeTime, 'ticker time') / 1000), start = now - DAY;
  const sparkline: Point[] = [{ time: start, value: open }];
  for (const candle of candles) {
    const closeTime = candle.time + 900;
    if (closeTime > start && closeTime < now) sparkline.push({ time: closeTime, value: candle.close });
  }
  sparkline.push({ time: now, value: price });
  return { assetId: id, price, change24h: (price / open - 1) * 100, updatedAt: now, high24h: finite(ticker.highPrice, 'high'), low24h: finite(ticker.lowPrice, 'low'), sparkline };
}

export class BinanceMarketDataProvider implements MarketDataProvider {
  readonly name = 'Binance';
  readonly isDemo = false;
  private assets = new Map(KNOWN_ASSETS.map(asset => [asset.id, asset]));
  private markets = new Map<string, ExchangeSymbol>();
  private catalogPromise?: Promise<void>;
  private catalogTime = 0;
  private sparkCache = new Map<string, SparkCache>();
  private sparkRequests = new Map<string, Promise<Candle[]>>();
  private cooldownUntil = 0;
  constructor(private readonly fetcher: typeof fetch = (...args) => fetch(...args)) {}

  getAsset(id: string): Asset | undefined {
    const known = this.assets.get(id);
    if (known) return known;
    if (/^binance:[A-Z0-9]{1,30}$/.test(id)) {
      const symbol = id.slice(8);
      return { id, symbol, name: symbol, color: '#b9c8d0' };
    }
    return undefined;
  }
  private symbolFor(id: string): string | undefined {
    // User confirmed the native TON coin, formerly Toncoin; Binance rebranded it to GRAM.
    // Explicit mapping verified against the exchange announcement and exchangeInfo.
    if (id === 'gram') return 'GRAMUSDT';
    const asset = this.getAsset(id);
    return asset ? `${asset.symbol}USDT` : undefined;
  }
  private unavailable(id: string): string {
    return id === 'ton' ? 'Toncoin now trades as GRAM. Add GRAM instead.' : 'This USDT pair is not available on Binance Spot.';
  }
  private async request(path: string, params: Record<string, string | number>, signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted();
    if (this.cooldownUntil > Date.now()) throw new MarketDataError('Rate limit reached. Waiting before retrying.', this.cooldownUntil - Date.now());
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error('Market data request timed out')), 12000);
    try {
      const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
      const response = await this.fetcher(`${REST}/${path}?${query}`, { signal: controller.signal });
      if (response.status === 429 || response.status === 418) {
        const retry = Number(response.headers.get('Retry-After'));
        const delay = Number.isFinite(retry) && retry > 0 ? retry * 1000 : 60000;
        this.cooldownUntil = Date.now() + delay;
        throw new MarketDataError('Binance rate limit reached. Retrying later.', delay);
      }
      if (!response.ok) throw new MarketDataError(response.status === 451 || response.status === 403 ? 'Binance market data is unavailable in this region or network.' : `Market data request failed (${response.status}).`);
      return await response.json();
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  private async ensureMarkets(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!this.catalogPromise || Date.now() - this.catalogTime > 3600000) {
      this.catalogTime = Date.now();
      this.catalogPromise = this.request('exchangeInfo', { permissions: 'SPOT', showPermissionSets: 'false', symbolStatus: 'TRADING' }).then(data => {
        const symbols = (data as { symbols?: ExchangeSymbol[] }).symbols;
        if (!Array.isArray(symbols)) throw new MarketDataError('Invalid exchange catalog');
        const markets = new Map<string, ExchangeSymbol>();
        for (const market of symbols) {
          if (market.quoteAsset !== 'USDT' || market.status !== 'TRADING' || market.isSpotTradingAllowed === false || !/^[A-Z0-9]{1,30}$/.test(market.baseAsset)) continue;
          markets.set(market.symbol, market);
          const known = KNOWN_ASSETS.find(asset => asset.symbol === market.baseAsset);
          const asset = known ?? { id: `binance:${market.baseAsset}`, symbol: market.baseAsset, name: market.baseAsset, color: '#b9c8d0' };
          this.assets.set(asset.id, asset);
        }
        this.markets = markets;
      }).catch(error => { this.catalogPromise = undefined; throw error; });
    }
    await this.catalogPromise;
    signal?.throwIfAborted();
  }
  async searchAssets(query: string, signal?: AbortSignal): Promise<Asset[]> {
    await this.ensureMarkets(signal);
    const term = query.trim().toLowerCase();
    return [...this.assets.values()].filter(asset => {
      const symbol = this.symbolFor(asset.id);
      return symbol && this.markets.has(symbol) && `${asset.symbol} ${asset.name}`.toLowerCase().includes(term);
    }).sort((a, b) => Number(b.symbol.toLowerCase() === term) - Number(a.symbol.toLowerCase() === term) || Number(!KNOWN_ASSETS.some(asset => asset.id === a.id)) - Number(!KNOWN_ASSETS.some(asset => asset.id === b.id)) || a.symbol.localeCompare(b.symbol));
  }
  async getHistory(id: string, { interval, before, limit = 240, signal }: HistoryRequest): Promise<Candle[]> {
    await this.ensureMarkets(signal);
    const symbol = this.symbolFor(id);
    if (!symbol || !this.markets.has(symbol)) throw new MarketDataError(this.unavailable(id));
    const params: Record<string, string | number> = { symbol, interval, limit: Math.max(1, Math.min(1000, Math.floor(limit))) };
    if (before !== undefined) params.endTime = Math.floor(before * 1000) - 1;
    return parseKlines(await this.request('klines', params, signal));
  }
  private async sparkHistory(id: string): Promise<Candle[]> {
    const cached = this.sparkCache.get(id);
    if (cached && Date.now() - cached.fetchedAt < 60000) return cached.candles;
    let pending = this.sparkRequests.get(id);
    if (!pending) {
      pending = this.getHistory(id, { interval: '15m', limit: 100 }).then(candles => {
        this.sparkCache.set(id, { candles, fetchedAt: Date.now() }); return candles;
      }).finally(() => this.sparkRequests.delete(id));
      this.sparkRequests.set(id, pending);
    }
    return pending;
  }
  async getQuote(id: string, signal?: AbortSignal): Promise<Quote> {
    const result = (await this.getQuotes([id], signal))[0];
    if (!result || 'error' in result) throw new MarketDataError(result && 'error' in result ? result.error : 'Quote unavailable');
    return result;
  }
  async getQuotes(ids: string[], signal?: AbortSignal): Promise<QuoteResult[]> {
    await this.ensureMarkets(signal);
    const unique = [...new Set(ids)];
    const valid = unique.filter(id => { const symbol = this.symbolFor(id); return symbol && this.markets.has(symbol); });
    const results: QuoteResult[] = unique.filter(id => !valid.includes(id)).map(assetId => ({ assetId, error: this.unavailable(assetId) }));
    for (let offset = 0; offset < valid.length; offset += 20) {
      const batch = valid.slice(offset, offset + 20);
      const data = await this.request('ticker/24hr', { symbols: JSON.stringify(batch.map(id => this.symbolFor(id))) }, signal);
      if (!Array.isArray(data)) throw new MarketDataError('Invalid ticker response');
      const tickers = new Map((data as Ticker[]).map(ticker => [ticker.symbol, ticker]));
      // Four concurrent history loads at most; no request loop per React tile.
      for (let i = 0; i < batch.length; i += 4) {
        const rows = await Promise.all(batch.slice(i, i + 4).map(async id => {
          try {
            const ticker = tickers.get(this.symbolFor(id)!);
            if (!ticker) throw new MarketDataError('No quote available for this asset.');
            return quoteFromTicker(id, ticker, await this.sparkHistory(id));
          } catch (error) { return { assetId: id, error: error instanceof Error ? error.message : 'Quote unavailable' }; }
        }));
        signal?.throwIfAborted(); results.push(...rows);
      }
    }
    return results;
  }
  private socket(streams: string[], onMessage: (data: Record<string, unknown>) => void, onError: (error: Error) => void): () => void {
    let stopped = false, failed = false;
    const ws = new WebSocket(SOCKET + streams.join('/'));
    const fail = () => { if (!stopped && !failed) { failed = true; ws.close(); onError(new MarketDataError('Live connection interrupted.')); } };
    ws.onmessage = event => {
      if (stopped || failed) return;
      try { const data = JSON.parse(event.data).data; if (data?.e === 'serverShutdown') fail(); else if (data) onMessage(data); } catch { fail(); }
    };
    ws.onerror = fail; ws.onclose = fail;
    return () => { stopped = true; ws.onmessage = null; ws.onerror = null; ws.onclose = null; ws.close(); };
  }
  subscribeQuotes(ids: string[], onQuotes: (quotes: QuoteResult[]) => void, onError: (error: Error) => void): () => void {
    const controller = new AbortController(); let stop: (() => void) | undefined;
    void this.getQuotes(ids, controller.signal).then(initial => {
      if (controller.signal.aborted) return;
      onQuotes(initial);
      const valid = ids.filter(id => { const symbol = this.symbolFor(id); return symbol && this.markets.has(symbol); });
      if (!valid.length) return;
      if (initial.some(result => 'error' in result && valid.includes(result.assetId))) throw new MarketDataError('Some asset histories could not be loaded. Retrying with polling.');
      const bySymbol = new Map(valid.map(id => [this.symbolFor(id)!, id]));
      stop = this.socket(valid.flatMap(id => [`${this.symbolFor(id)!.toLowerCase()}@ticker`, `${this.symbolFor(id)!.toLowerCase()}@kline_15m`]), data => {
        const id = bySymbol.get(String(data.s)); if (!id) return;
        if (data.e === 'kline') {
          const candle = this.streamCandle(data);
          const cache = this.sparkCache.get(id);
          if (cache) { cache.candles = [...cache.candles.filter(c => c.time !== candle.time), candle].sort((a, b) => a.time - b.time).slice(-100); cache.fetchedAt = Date.now(); }
        } else if (data.e === '24hrTicker') {
          const history = this.sparkCache.get(id)?.candles;
          if (!history) return;
          const ticker: Ticker = { symbol: String(data.s), lastPrice: String(data.c), openPrice: String(data.o), highPrice: String(data.h), lowPrice: String(data.l), closeTime: Number(data.C ?? data.E) };
          onQuotes([quoteFromTicker(id, ticker, history)]);
        }
      }, onError);
    }).catch(error => { if (!controller.signal.aborted) onError(error); });
    return () => { controller.abort(); stop?.(); };
  }
  private streamCandle(data: Record<string, unknown>): Candle {
    const k = data.k as Record<string, unknown>;
    return parseKlines([[k.t, k.o, k.h, k.l, k.c, k.v, k.T]])[0];
  }
  subscribeHistory(id: string, interval: Interval, onCandle: (candle: Candle) => void, onError: (error: Error) => void): () => void {
    let stopped = false, stop: (() => void) | undefined;
    void this.ensureMarkets().then(() => {
      if (stopped) return;
      const symbol = this.symbolFor(id);
      if (!symbol || !this.markets.has(symbol)) throw new MarketDataError(this.unavailable(id));
      stop = this.socket([`${symbol.toLowerCase()}@kline_${interval}`], data => { if (data.e === 'kline') onCandle(this.streamCandle(data)); }, onError);
    }).catch(error => { if (!stopped) onError(error); });
    return () => { stopped = true; stop?.(); };
  }
}
