import test from 'node:test';
import assert from 'node:assert/strict';
import { TestnetRpc, requireTestnetId, transactionEvidence } from '../scripts/testnet-rpc.mjs';

test('a wrong-chain response stops signing and broadcasting', async () => {
  const methods = [];
  const rpc = new TestnetRpc(async (url, options) => {
    assert.equal(url, 'https://rpc.testnet.near.org');
    methods.push(JSON.parse(options.body).method);
    return { ok: true, json: async () => ({ result: { chain_id: 'mainnet' } }) };
  });
  await assert.rejects(rpc.send({ signer: 'client.testnet', receiver: 'contract.testnet', key: {}, actions: [] }), /not testnet/);
  assert.deepEqual(methods, ['status']);
  assert.throws(() => requireTestnetId('contract.near'));
});

test('remote error text cannot disclose signing material', async () => {
  const rpc = new TestnetRpc(async () => ({ ok: true, json: async () => ({ error: { message: 'SENSITIVE_REMOTE_ECHO' } }) }));
  await assert.rejects(rpc.preflight(), error => !error.message.includes('SENSITIVE_REMOTE_ECHO'));
});

test('receipt evidence retains only constrained events and transaction facts', () => {
  const item = {
    id: 'transaction-hash', block_hash: 'block-hash',
    outcome: { executor_id: 'contract.testnet', gas_burnt: 123, status: { SuccessValue: '' },
      logs: ['SENSITIVE_LOG', 'EVENT_JSON:{"standard":"agent_escrow","version":"1.0.0","event":"created","data":[{"task_id":"0","extra":"SENSITIVE_EXTRA"}]}',
        'EVENT_JSON:{"standard":"agent_escrow","version":"1.0.0","event":"SENSITIVE_EVENT","data":[{"task_id":"0"}]}'] },
  };
  const evidence = transactionEvidence('transaction-hash', { status: { SuccessValue: '' }, transaction_outcome: item, transaction: { secret: 'SENSITIVE_TRANSACTION' } });
  assert.equal(evidence.status, 'success');
  assert.deepEqual(evidence.receipts[0].events, [{ event: 'created', task_id: '0' }]);
  assert.ok(!JSON.stringify(evidence).includes('SENSITIVE'));
  assert.throws(() => transactionEvidence('wrong-hash', { transaction_outcome: item }), /hash mismatch/);
});
