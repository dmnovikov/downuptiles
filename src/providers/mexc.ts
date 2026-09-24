import { parseMarketTickers } from './market-tickers';
import type { Asset, Candle, HistoryRequest, MarketDataProvider, Quote, QuoteResult } from '../types/market';
import { KNOWN_ASSETS } from './assets';
import { MarketDataError, parseKlines, quoteFromTicker } from './binance';
interface Market { symbol: string; baseAsset: string; quoteAsset: string; status: string; fullName?: string }
export class MexcMarketDataProvider implements MarketDataProvider {
  readonly name = 'MEXC';
  readonly isDemo = false;
  private assets = new Map<string, Asset>();
  private catalog?: Promise<void>;
  private catalogTime = 0;
  private cooldownUntil = 0;
  private history = new Map<string, { time: number; candles: Candle[] }>();
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args)) {}
  getAsset(id: string): Asset | undefined {
    if (!/^mexc:[A-Z0-9]{1,30}$/.test(id)) return undefined;
    const symbol = id.slice(5), known = KNOWN_ASSETS.find(a => a.symbol === symbol);
    return this.assets.get(id) ?? { id, symbol, name: known?.name ?? symbol, color: known?.color ?? '#b9c8d0' };
  }
  private async request(path: string, params: Record<string, string | number> = {}, signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted();
    if (Date.now() < this.cooldownUntil) throw new MarketDataError('MEXC rate limit reached. Retrying later.', this.cooldownUntil - Date.now());
    const controller = new AbortController(), abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await this.fetcher(`/api/mexc/${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`, { signal: controller.signal });
      if (response.status === 429 || response.status === 418) {
        const delay = Math.max(1000, (Number(response.headers.get('Retry-After')) || 60) * 1000);
        this.cooldownUntil = Date.now() + delay;
        throw new MarketDataError('MEXC rate limit reached. Retrying later.', delay);
      }
      if (!response.ok) throw new MarketDataError('MEXC market data is temporarily unavailable.');
      return await response.json();
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  private async ensureMarkets(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!this.catalog || Date.now() - this.catalogTime > 3600000) {
      this.catalogTime = Date.now();
      this.catalog = this.request('exchangeInfo').then(data => {
        const markets = (data as { symbols?: Market[] }).symbols;
        if (!Array.isArray(markets)) throw new MarketDataError('Invalid MEXC catalog');
        const assets = new Map<string, Asset>();
        for (const market of markets) {
          if (market.quoteAsset !== 'USDT' || market.status !== '1' || !/^[A-Z0-9]{1,30}$/.test(market.baseAsset)) continue;
          const id = `mexc:${market.baseAsset}`, known = this.getAsset(id)!;
          assets.set(id, { ...known, name: market.fullName || known.name });
        }
        this.assets = assets;
      }).catch(error => { this.catalog = undefined; throw error; });
    }
    await this.catalog; signal?.throwIfAborted();
  }
  async searchAssets(query: string, signal?: AbortSignal) {
    await this.ensureMarkets(signal);
    const term = query.trim().toLowerCase();
    return [...this.assets.values()].filter(a => `${a.symbol} ${a.name}`.toLowerCase().includes(term))
      .sort((a, b) => Number(b.symbol.toLowerCase() === term) - Number(a.symbol.toLowerCase() === term) || Number(!KNOWN_ASSETS.some(k => k.symbol === a.symbol)) - Number(!KNOWN_ASSETS.some(k => k.symbol === b.symbol)) || a.symbol.localeCompare(b.symbol));
  }
  async getMarketTickers(signal?: AbortSignal) {
    await this.ensureMarkets(signal);
    const ids = new Map([...this.assets.values()].map(asset => [`${asset.symbol}USDT`, asset.id]));
    return parseMarketTickers(await this.request('ticker/24hr', {}, signal), ids);
  }
  async getHistory(id: string, { interval, limit = 240, before, signal }: HistoryRequest): Promise<Candle[]> {
    const asset = this.getAsset(id);
    if (!asset) throw new MarketDataError('Unknown MEXC pair');
    const params: Record<string, string | number> = { symbol: `${asset.symbol}USDT`, interval: interval === '1h' ? '60m' : interval === '1w' ? '1W' : interval, limit: Math.max(1, Math.min(1000, Math.floor(limit))) };
    if (before !== undefined) params.endTime = Math.floor(before * 1000) - 1;
    const candles = parseKlines(await this.request('klines', params, signal));
    return before === undefined ? candles : candles.filter(c => c.time < before);
  }
  async getQuote(id: string, signal?: AbortSignal): Promise<Quote> {
    const asset = this.getAsset(id);
    if (!asset) throw new MarketDataError('Unknown MEXC pair');
    const ticker = await this.request('ticker/24hr', { symbol: `${asset.symbol}USDT` }, signal) as Parameters<typeof quoteFromTicker>[1];
    let cached = this.history.get(id);
    if (!cached || Date.now() - cached.time > 60000) {
      cached = { time: Date.now(), candles: await this.getHistory(id, { interval: '15m', limit: 100, signal }) };
      this.history.set(id, cached);
    }
    // MEXC's priceChangePercent is a fraction, so derive percent from prices as on Binance.
    return quoteFromTicker(id, ticker, cached.candles);
  }
  async getQuotes(ids: string[], signal?: AbortSignal): Promise<QuoteResult[]> {
    const unique = [...new Set(ids)], results: QuoteResult[] = [];
    for (let i = 0; i < unique.length; i += 4) {
      signal?.throwIfAborted();
      results.push(...await Promise.all(unique.slice(i, i + 4).map(async assetId => {
        try { return await this.getQuote(assetId, signal); }
        catch (error) { return { assetId, error: error instanceof Error ? error.message : 'MEXC is unavailable' }; }
      })));
    }
    signal?.throwIfAborted(); return results;
  }
}
