import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTask } from '../scripts/read-task.mjs';
test('RPC client verifies testnet before requesting a task', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://rpc.testnet.near.org');
    const payload = JSON.parse(options.body); calls.push(payload);
    return { ok: true, json: async () => ({ result: payload.method === 'status' ? { chain_id: 'testnet' } :
      { result: [...Buffer.from('{"status":"Paid"}')], block_hash: 'hash', block_height: 1 } }) };
  };
  const task = await readTask('escrow.testnet', '0', fetcher);
  assert.equal(task.task.status, 'Paid'); assert.equal(task.read_only, true);
  assert.equal(calls.length, 2); assert.equal(calls[1].method, 'query');
  assert.deepEqual(JSON.parse(Buffer.from(calls[1].params.args_base64, 'base64')), { task_id: '0' });
});
test('RPC client refuses a non-testnet chain without a follow-up request', async () => {
  let calls = 0;
  await assert.rejects(readTask('escrow.testnet', '0', async () => { calls++; return { ok: true, json: async () => ({ result: { chain_id: 'mainnet' } }) }; }), /not testnet/);
  assert.equal(calls, 1);
});
test('RPC errors and malformed view data fail without a signing fallback', async () => {
  await assert.rejects(readTask(undefined, undefined, async () => ({ ok: false })), /HTTP failure/);
  await assert.rejects(readTask(undefined, undefined, async () => ({ ok: true, json: async () => ({ error: {} }) })), /rejected/);
  await assert.rejects(readTask('escrow.testnet', '0', async (_, options) => ({ ok: true, json: async () => ({ result: JSON.parse(options.body).method === 'status' ? { chain_id: 'testnet' } : { result: [256] } }) })), /Invalid RPC/);
});
