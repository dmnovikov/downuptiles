export interface Asset { id: string; symbol: string; name: string; color: string }
export interface Point { time: number; value: number }
export interface Quote {
  assetId: string; price: number; change24h: number; updatedAt: number;
  high24h: number; low24h: number; sparkline: Point[];
}
export interface QuoteError { assetId: string; error: string }
export type QuoteResult = Quote | QuoteError;
export interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }
export const INTERVALS = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800 } as const;
export type Interval = keyof typeof INTERVALS;
export interface HistoryRequest { interval: Interval; limit?: number; before?: number; signal?: AbortSignal }
export interface MarketDataProvider {
  readonly name: string;
  readonly isDemo: boolean;
  searchAssets(query: string, signal?: AbortSignal): Promise<Asset[]>;
  getAsset(id: string): Asset | undefined;
  getQuote(id: string, signal?: AbortSignal): Promise<Quote>;
  getQuotes(ids: string[], signal?: AbortSignal): Promise<QuoteResult[]>;
  getHistory(id: string, request: HistoryRequest): Promise<Candle[]>;
  /** Optional live transport (WebSocket in a real provider). Errors switch the service to polling. */
  subscribeQuotes?(ids: string[], onQuotes: (quotes: QuoteResult[]) => void, onError: (error: Error) => void): () => void;
  subscribeHistory?(id: string, interval: Interval, onCandle: (candle: Candle) => void, onError: (error: Error) => void): () => void;
}
export type ConnectionState = 'connecting' | 'live' | 'polling' | 'offline' | 'paused' | 'error';
