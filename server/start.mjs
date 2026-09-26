import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { worldData } from './world-data.mjs';
import { mexcProxy } from './mexc-proxy.mjs';
const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
createServer((req, res) => mexcProxy(req, res, () => worldData(req, res, async () => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(root + sep) && path !== root) { res.writeHead(403); res.end(); return; }
    const file = path === root ? resolve(root, 'index.html') : path;
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
}))).listen(Number(process.env.PORT || 5173), process.env.HOST || '0.0.0.0', () => console.log('downuptiles server ready'));
