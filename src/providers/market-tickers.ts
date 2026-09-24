import type { MarketTicker } from '../types/market';
/** Both exchanges expose quoteVolume in USDT; their percent fields use different units. */
export function parseMarketTickers(payload: unknown, ids: Map<string, string>): MarketTicker[] {
  if (!Array.isArray(payload)) throw new Error('Invalid market ticker response');
  const result = new Map<string, MarketTicker>();
  for (const row of payload) {
    if (!row || typeof row !== 'object') continue;
    const id = ids.get(row.symbol);
    const price = Number(row.lastPrice), open = Number(row.openPrice), quoteVolume = Number(row.quoteVolume);
    const high24h = Number(row.highPrice), low24h = Number(row.lowPrice), updatedAt = Number(row.closeTime) / 1000;
    if (!id || ![price, open, quoteVolume, high24h, low24h, updatedAt].every(Number.isFinite)
      || price <= 0 || open <= 0 || quoteVolume <= 0 || low24h <= 0 || high24h < low24h || updatedAt <= 0) continue;
    const change24h = (price / open - 1) * 100;
    if (!Number.isFinite(change24h)) continue;
    result.set(id, { assetId: id, price, change24h, quoteVolume, high24h, low24h, updatedAt, sparkline: [] });
  }
  return [...result.values()];
}
