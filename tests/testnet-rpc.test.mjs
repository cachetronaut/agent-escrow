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

test('warranty evidence preserves claim, resolution and fix events with only task IDs',()=>{
  const names=['claimed','claim_resolved','fix_delivered'];
  const logs=names.map(event=>'EVENT_JSON:'+JSON.stringify({standard:'agent_escrow',version:'1.0.0',event,data:[{task_id:'2',evidence:'SENSITIVE_EVIDENCE'}]}));
  const result=transactionEvidence('hash',{status:{SuccessValue:''},transaction_outcome:{id:'hash',block_hash:'block',outcome:{executor_id:'contract.testnet',gas_burnt:1,status:{SuccessValue:''},logs}}});
  assert.deepEqual(result.receipts[0].events,names.map(event=>({event,task_id:'2'})));
  assert.ok(!JSON.stringify(result).includes('SENSITIVE'));
});

test('an HTTP 429 signed broadcast is never automatically resent', async () => {
  let calls=0;
  const rpc=new TestnetRpc(async()=>{calls++;return{status:429,ok:false};});
  await assert.rejects(rpc.request('broadcast_tx_commit',['unsigned-test-placeholder']),/HTTP 429/);
  assert.equal(calls,1);
});

test('RPC selection only allows the two fixed testnet endpoints',async()=>{
  assert.throws(()=>new TestnetRpc(globalThis.fetch,'https://rpc.mainnet.fastnear.com'),/Unapproved/);
  const rpc=new TestnetRpc(async url=>{assert.equal(url,'https://rpc.testnet.fastnear.com');return{ok:true,json:async()=>({result:{chain_id:'testnet'}})};},'https://rpc.testnet.fastnear.com');
  assert.equal((await rpc.preflight()).chain_id,'testnet');
});
