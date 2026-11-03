import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

for (const rejectDigest of [false, true]) test(`pending digest cannot affect a replacement task, rejected=${rejectDigest}`, async () => {
  const elements = new Map();
  const make = () => ({ value: '', disabled: false, hidden: true, textContent: '', children: [], elements: [],
    addEventListener(name, fn) { this[name] = fn; }, prepend(e) { this.children.unshift(e); }, replaceChildren() { this.children = []; } });
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, make()); return elements.get(id); }, createElement: make };
  const originalDocument = globalThis.document;
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  let resolveDigest, failDigest;
  globalThis.document = document;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest: () => new Promise((resolve, reject) => { resolveDigest = resolve; failDigest = reject; }) } } });
  try {
    await import(`../demo/app.mjs?reject=${rejectDigest}`);
    const $ = document.getElementById;
    $('title').value = 'Task A'; $('criteria').value = 'Return JSON'; $('budget').value = '1'; $('minutes').value = '60';
    $('task-form').submit({ preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal($('status').textContent, 'Open');
    const pending = $('deliver').onclick();
    $('reset').onclick(); $('title').value = 'Task B';
    $('task-form').submit({ preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
    const eventCount = $('events').children.length;
    if (rejectDigest) failDigest(Error('Old task digest failed'));
    else resolveDigest(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode('Task A')));
    await pending;
    assert.equal($('status').textContent, 'Open'); assert.equal($('artifact').hidden, true);
    assert.equal($('events').children.length, eventCount); assert.match($('order').textContent, /Task B/);
    assert.equal($('feedback').textContent, '');
  } finally {
    globalThis.document = originalDocument;
    Object.defineProperty(globalThis, 'crypto', originalCrypto);
  }
});
