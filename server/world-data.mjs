const USER_AGENT = 'downuptiles/0.1 (+https://github.com/dmnovikov/downuptiles)';
const cache = new Map(), pending = new Map();
const yahooSymbols = { gold: 'GC=F', silver: 'SI=F', sp500: '^GSPC', nasdaq100: '^NDX', brent: 'BZ=F',
  'usd-eur': 'EUR=X', 'usd-rub': 'RUB=X', 'usd-uzs': 'UZS=X', 'usd-cny': 'CNY=X', 'usd-kzt': 'KZT=X' };
export const worldIds = Object.keys(yahooSymbols);
let active = 0; const queue = [];
async function limited(task) {
  if (active >= 4) {
    if (queue.length >= 40) throw new Error('Market data is busy. Try again shortly.');
    await new Promise(resolve => queue.push(resolve));
  }
  active++;
  try { return await task(); }
  finally { active--; queue.shift()?.(); }
}
async function json(url, ttl) {
  const stored = cache.get(url);
  if (stored && stored.until > Date.now()) return stored.value;
  if (pending.has(url)) return pending.get(url);
  const promise = limited(async () => {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) throw new Error(response.status === 429 ? 'Source rate limit reached. Please retry later.' : 'Source is temporarily unavailable.');
    const value = await response.json();
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    cache.set(url, { value, until: Date.now() + ttl });
    return value;
  }).finally(() => pending.delete(url));
  pending.set(url, promise); return promise;
}
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
export function normalizeYahoo(id, payload, now = Date.now() / 1000, interval = '15m') {
  const result = payload?.chart?.result?.[0], meta = result?.meta;
  const rows = result?.indicators?.quote?.[0], timestamps = result?.timestamp;
  if (!meta || !positive(meta.regularMarketPrice) || !Number.isFinite(meta.regularMarketTime) || !Array.isArray(timestamps) || !rows) throw new Error('Invalid market data.');
  const candles = timestamps.flatMap((time, i) => {
    const open = rows.open?.[i], high = rows.high?.[i], low = rows.low?.[i], close = rows.close?.[i];
    if (!Number.isFinite(time) || ![open, high, low, close].every(positive) || low > Math.min(open, close) || high < Math.max(open, close)) return [];
    return [{ time, open, high, low, close, volume: Number.isFinite(rows.volume?.[i]) ? Math.max(0, rows.volume[i]) : 0 }];
  }).sort((a, b) => a.time - b.time);
  const previous = positive(meta.previousClose) ? meta.previousClose : candles.filter(c => c.time < meta.currentTradingPeriod?.regular?.start).at(-1)?.close;
  const session = meta.currentTradingPeriod?.regular;
  const closed = session && (now < session.start || now >= session.end);
  return { id, price: meta.regularMarketPrice, change: positive(previous) ? (meta.regularMarketPrice / previous - 1) * 100 : null,
    asOf: new Date(meta.regularMarketTime * 1000).toISOString(), status: closed ? 'Market closed' : 'Delay possible', period: 'Day',
    historyLabel: interval === '15m' ? '5 days · 15m candles' : interval === '1h' ? '1 month · 1h candles' : '1 year · Daily candles',
    note: id.startsWith('usd-') ? 'Currency units per one US dollar, as quoted by Yahoo Finance. Updates may be delayed or infrequent. Not a bank buy/sell quote.' : ['gold', 'silver'].includes(id) ? 'Metal futures in USD per troy ounce, not a spot metal quote. Data may be delayed.' : id === 'brent' ? 'Brent crude oil futures, quoted in USD per barrel. Price may differ from physical spot oil. Data may be delayed.' : 'Index level in points. Day change is relative to the previous close. Data may be delayed.',
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbols[id])}/`,
    points: candles.map(c => ({ time: c.time, value: c.close })), candles };
}
export async function worldQuote(id, interval = '15m') {
  if (!Object.hasOwn(yahooSymbols, id)) throw new Error('Unknown instrument.');
  const range = interval === '1d' ? '1y' : interval === '1h' ? '1mo' : '5d';
  const result = await json(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbols[id])}?interval=${interval}&range=${range}`, 60000);
  return normalizeYahoo(id, result, Date.now() / 1000, interval);
}
export function worldData(req, res, next) {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/world/')) return next();
  const id = url.searchParams.get('id'), interval = url.searchParams.get('interval') || '15m';
  if (req.method !== 'GET' || url.pathname !== '/api/world/quote' || !worldIds.includes(id) || !['15m', '1h', '1d'].includes(interval)
    || [...url.searchParams.keys()].some(k => !['id', 'interval'].includes(k))) { res.writeHead(400); res.end(); return; }
  void worldQuote(id, interval).then(quote => {
    if (!res.destroyed) { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(quote)); }
  }).catch(error => {
    if (!res.destroyed) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); }
  });
}
