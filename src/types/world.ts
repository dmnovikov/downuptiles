import type { Candle, Point } from './market';
export const WORLD_ASSETS = [
  { id: 'gold', name: 'Gold futures', symbol: 'GC=F', unit: 'USD/oz', source: 'YAHOO' },
  { id: 'silver', name: 'Silver futures', symbol: 'SI=F', unit: 'USD/oz', source: 'YAHOO' },
  { id: 'sp500', name: 'S&P 500', symbol: 'SPX', unit: 'points', source: 'YAHOO' },
  { id: 'nasdaq100', name: 'Nasdaq-100', symbol: 'NDX', unit: 'points', source: 'YAHOO' },
  { id: 'brent', name: 'Brent futures', symbol: 'BRENT', unit: 'USD/bbl', source: 'YAHOO' },
  ...['EUR', 'RUB', 'UZS', 'CNY', 'KZT'].map(currency => ({ id: `usd-${currency.toLowerCase()}`, name: `USD/${currency}`, symbol: `USD/${currency}`, unit: `${currency} per USD`, source: 'YAHOO' })),
];
export interface WorldQuote {
  id: string; price: number; change: number | null; asOf: string;
  status: string; period: string; historyLabel: string; note: string; sourceUrl: string;
  points: Point[]; candles: Candle[];
}
export interface WorldResult { id: string; quote?: WorldQuote; error?: string }
