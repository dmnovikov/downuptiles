import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WorldQuote } from '../src/types/world';
export function worldData(req: IncomingMessage, res: ServerResponse, next: () => void): void;
export function normalizeYahoo(id: string, payload: unknown, now?: number, interval?: string): WorldQuote;
export function worldQuote(id: string, interval?: string): Promise<WorldQuote>;
export const worldIds: string[];
