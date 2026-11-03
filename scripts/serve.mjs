// First-party static demo server. Binds loopback only and serves an explicit allowlist.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const routes = { '/': ['../demo/index.html', 'text/html'], '/app.mjs': ['../demo/app.mjs', 'text/javascript'], '/escrow.mjs': ['../demo/escrow.mjs', 'text/javascript'], '/style.css': ['../demo/style.css', 'text/css'] };
createServer(async (req, res) => {
  const route = routes[req.url];
  if (!route || req.method !== 'GET') { res.writeHead(404); res.end('Not found'); return; }
  try { const body = await readFile(new URL(route[0], import.meta.url)); res.writeHead(200, { 'Content-Type': route[1], 'Content-Security-Policy': "default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff' }); res.end(body); }
  catch { res.writeHead(500); res.end('Read failed'); }
}).listen(4173, '127.0.0.1', () => console.log('Offline demo: http://127.0.0.1:4173'));
