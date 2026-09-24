// Only public market data paths are accepted; this is not a general-purpose proxy.
const paths = new Set(['exchangeInfo', 'ticker/24hr', 'klines']);
const cache = new Map();
const pending = new Map();
export function mexcProxy(req, res, next) {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/mexc/')) return next();
  const path = url.pathname.slice('/api/mexc/'.length);
  if (req.method !== 'GET' || !paths.has(path)) { res.writeHead(404); res.end(); return; }
  if ([...url.searchParams.keys()].some(key => !['symbol', 'interval', 'limit', 'endTime'].includes(key)) || url.search.length > 256) {
    res.writeHead(400); res.end(); return;
  }
  const key = path + url.search;
  const send = result => {
    if (res.destroyed) return;
    res.writeHead(result.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(result.retry ? { 'Retry-After': result.retry } : {}) });
    res.end(result.body);
  };
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) { send(existing); return; }
  let request = pending.get(key);
  if (!request) {
    request = fetch(`https://api.mexc.com/api/v3/${key}`, { signal: AbortSignal.timeout(10000), redirect: 'error' })
      .then(async response => {
        const result = { status: response.status, body: await response.text(), retry: response.headers.get('Retry-After'), expires: Date.now() + (path === 'exchangeInfo' ? 3600000 : path === 'ticker/24hr' && !url.searchParams.has('symbol') ? 30000 : 3000) };
        if (response.ok) { if (cache.size >= 500) cache.delete(cache.keys().next().value); cache.set(key, result); }
        return result;
      }).catch(() => ({ status: 502, body: JSON.stringify({ message: 'MEXC is temporarily unavailable.' }) }))
      .finally(() => pending.delete(key));
    pending.set(key, request);
  }
  void request.then(send);
}
