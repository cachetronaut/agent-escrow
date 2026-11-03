import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('demo server serves only first-party assets with no network or framing capability', async () => {
  const child = spawn(process.execPath, ['scripts/serve.mjs'], { stdio: ['ignore', 'pipe', 'pipe'], cwd: new URL('..', import.meta.url) });
  try {
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw Error('Server failed to start'); }), new Promise((_, reject) => { const t = setTimeout(() => reject(Error('Server startup timeout')), 30000); t.unref(); })]);
    for (const path of ['/', '/style.css', '/app.mjs', '/escrow.mjs']) {
      const r = await fetch('http://127.0.0.1:4173' + path);
      assert.equal(r.status, 200);
      assert.match(r.headers.get('content-security-policy'), /connect-src 'none'/);
      assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      assert.ok((await r.text()).length > 0);
    }
    for (const path of ['/package.json', '/.env', '/contract/src/lib.rs', '/%2e%2e/README.md']) {
      const r = await fetch('http://127.0.0.1:4173' + path); assert.equal(r.status, 404);
    }
    assert.equal((await fetch('http://127.0.0.1:4173/', { method: 'POST' })).status, 404);
  } finally { if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } }
});
