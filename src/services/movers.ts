import type { ConnectionState, Quote } from '../types/market';
import { direction } from './format';
export interface MoverEntry { id: string; quote?: Quote; error?: string; status: ConnectionState }
export function rankMovers(entries: MoverEntry[], now = Date.now() / 1000) {
  const unique = [...new Map(entries.map(entry => [entry.id, entry])).values()];
  const fresh = unique.filter((entry): entry is MoverEntry & { quote: Quote } => Boolean(entry.quote)
    && !entry.error && (entry.status === 'live' || entry.status === 'polling')
    && Number.isFinite(entry.quote!.change24h) && now - entry.quote!.updatedAt <= 60 && entry.quote!.updatedAt <= now + 5);
  const tie = (a: MoverEntry, b: MoverEntry) => a.id.localeCompare(b.id);
  return {
    gainers: fresh.filter(e => direction(e.quote.change24h) === 'up').sort((a, b) => b.quote.change24h - a.quote.change24h || tie(a, b)).slice(0, 5),
    losers: fresh.filter(e => direction(e.quote.change24h) === 'down').sort((a, b) => a.quote.change24h - b.quote.change24h || tie(a, b)).slice(0, 5),
    freshCount: fresh.length, total: unique.length,
  };
}
