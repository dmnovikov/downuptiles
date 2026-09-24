import { BinanceMarketDataProvider } from './binance';
import { MexcMarketDataProvider } from './mexc';
import { MockMarketDataProvider } from './mock';
import type { Asset, MarketDataProvider } from '../types/market';
export const binance = new BinanceMarketDataProvider();
export const mexc = new MexcMarketDataProvider();
export const demo = new MockMarketDataProvider();
export const isDemo = import.meta.env.VITE_MARKET_PROVIDER === 'mock';
export function providerFor(id: string): MarketDataProvider { return isDemo ? demo : id.startsWith('mexc:') ? mexc : binance; }
export const provider = {
  isDemo, name: isDemo ? 'Demo' : 'Spot',
  getAsset(id: string) { return providerFor(id).getAsset(id); },
};
export type ExchangeFilter = 'all' | 'binance' | 'mexc';
export async function searchCatalog(query: string, exchange: ExchangeFilter, signal?: AbortSignal): Promise<{ assets: Asset[]; warning: string }> {
  const sources = isDemo ? [demo] : exchange === 'binance' ? [binance] : exchange === 'mexc' ? [mexc] : [binance, mexc];
  const results = await Promise.allSettled(sources.map(source => source.searchAssets(query, signal)));
  signal?.throwIfAborted();
  const assets = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const failed = sources.filter((_, i) => results[i].status === 'rejected').map(source => source.name);
  const term = query.trim().toLowerCase();
  assets.sort((a, b) => Number(b.symbol.toLowerCase() === term) - Number(a.symbol.toLowerCase() === term) || Number(a.id.startsWith('mexc:')) - Number(b.id.startsWith('mexc:')));
  return { assets, warning: failed.length ? `${failed.join(' and ')} search unavailable. Try again shortly.` : '' };
}
