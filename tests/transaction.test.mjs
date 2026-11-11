import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateEnvKey, keyFromEnv, base58, unbase58, uint, action, signedTransaction } from '../scripts/near-transaction.mjs';
test('base58 canonical zero handling and roundtrip', () => {
  assert.equal(base58(Buffer.alloc(32)), '1'.repeat(32));
  for (const bytes of [Buffer.from([0]), Buffer.from([0, 0, 5]), Buffer.from([255]), Buffer.from('NEAR')]) assert.deepEqual(unbase58(base58(bytes)), bytes);
  assert.throws(() => unbase58('0OIl'));
});
test('integer encodings reject overflow and use little endian', () => {
  assert.equal(uint(258, 4).toString('hex'), '02010000');
  assert.throws(() => uint(-1, 8)); assert.throws(() => uint(1n << 64n, 8));
});
test('environment-only keys sign canonical testnet transactions without exposing credentials', () => {
  const name = 'AGENT_ESCROW_EPHEMERAL_TEST_KEY';
  try {
    const key = generateEnvKey(name);
    assert.deepEqual(keyFromEnv(name).publicBytes, key.publicBytes);
    const request = { signer: 'client.testnet', receiver: 'escrow.testnet', nonce: 1n, blockHash: '1'.repeat(32), actions: [action('call', { method: 'pay', args: { task_id: '0' } })], key };
    const signed = signedTransaction(request);
    assert.equal(signed.hash.length >= 32, true); assert.equal(signed.bytes.subarray(-65)[0], 0);
    assert.equal(signed.bytes.readUInt32LE(0), Buffer.byteLength(request.signer));
    assert.throws(() => signedTransaction({ ...request, receiver: 'escrow.near' }));
    assert.throws(() => generateEnvKey(name));
  } finally { delete process.env[name]; }
});
