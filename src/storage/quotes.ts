import type { Quote } from '../types/market';

export function quoteCacheKey(source: string) { return `cryptotiles.quotes.v1.${source}`; }

function validQuote(value: unknown): value is Quote {
  if (!value || typeof value !== 'object') return false;
  const q = value as Quote;
  return typeof q.assetId === 'string' && q.assetId.length > 0 && q.assetId.length <= 128
    && [q.price, q.change24h, q.updatedAt, q.high24h, q.low24h].every(Number.isFinite)
    && q.price > 0 && q.updatedAt > 0 && q.low24h > 0 && q.high24h >= q.low24h
    && Array.isArray(q.sparkline) && q.sparkline.length > 0 && q.sparkline.length <= 200
    && q.sparkline.every(p => p && Number.isFinite(p.time) && Number.isFinite(p.value) && p.value > 0);
}

export function readQuoteCache(source: string): Quote[] {
  try {
    const raw = localStorage.getItem(quoteCacheKey(source));
    if (!raw || raw.length > 2_000_000) return [];
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(validQuote).slice(0, 100) : [];
  } catch { return []; }
}

export function writeQuoteCache(source: string, quotes: Iterable<Quote>) {
  try {
    const recent = [...quotes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 100);
    localStorage.setItem(quoteCacheKey(source), JSON.stringify(recent));
  } catch { /* Storage may be disabled or full; live quotes still work. */ }
}
