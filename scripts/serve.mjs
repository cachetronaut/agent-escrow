// First-party static demo server. Binds loopback only and serves an explicit allowlist.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const js = 'text/javascript', css = 'text/css', html = 'text/html';
const routes = {
  '/': ['../demo/index.html', html], '/stage.mjs': ['../demo/stage.mjs', js], '/scene.mjs': ['../demo/scene.mjs', js], '/stage.css': ['../demo/stage.css', css],
  '/vendor/three.module.js': ['../demo/vendor/three.module.js', js], '/vendor/three.core.js': ['../demo/vendor/three.core.js', js],
  '/vendor/fonts/archivo.woff2': ['../demo/vendor/fonts/archivo.woff2', 'font/woff2'], '/vendor/fonts/plexmono-400.woff2': ['../demo/vendor/fonts/plexmono-400.woff2', 'font/woff2'], '/vendor/fonts/plexmono-600.woff2': ['../demo/vendor/fonts/plexmono-600.woff2', 'font/woff2'],
  '/offline.html': ['../demo/offline.html', html], '/app.mjs': ['../demo/app.mjs', js], '/escrow.mjs': ['../demo/escrow.mjs', js], '/style.css': ['../demo/style.css', css],
  // Evidence is wrapped as a module so the page keeps connect-src 'none'.
  '/evidence.mjs': [null, js]
};
const evidence = new URL('../docs/warranty-verification.json', import.meta.url);
async function body(path) {
  if (path !== '/evidence.mjs') return readFile(new URL(routes[path][0], import.meta.url));
  try { return `export default ${JSON.stringify(JSON.parse(await readFile(evidence, 'utf8')))};\n`; }
  catch (e) { if (e.code === 'ENOENT') return 'export default null;\n'; throw e; }
}
createServer(async (req, res) => {
  const path = req.url.split('?')[0], route = Object.hasOwn(routes, path) ? routes[path] : null;
  if (!route || req.method !== 'GET') { res.writeHead(404); res.end('Not found'); return; }
  try { const data = await body(path); res.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff' }); res.end(data); }
  catch { res.writeHead(500); res.end('Read failed'); }
}).listen(4173, '127.0.0.1', () => console.log('Demo: http://127.0.0.1:4173  (offline model: /offline.html)'));
