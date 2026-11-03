import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EscrowModel, FEE, account } from '../demo/escrow.mjs';
import { plan } from '../scripts/plan.mjs';
import { runDemo } from '../scripts/agents.mjs';
const now = 1000n, deadline = 2000n, hash = 'a'.repeat(64);
const input = () => ({ client: 'client.testnet', worker: 'worker.testnet', verifier: 'verifier.testnet', title: 'Task', criteria: 'Return JSON', budget: '100', deadline_ns: String(deadline) });
function setup() { const e = new EscrowModel(); const id = e.create(input(), 100n + FEE, now); return { e, id }; }
test('release only after worker evidence and named verifier approval', () => {
  const { e, id } = setup();
  assert.throws(() => e.approve(id, 'verifier.testnet', now));
  assert.throws(() => e.deliver(id, 'client.testnet', hash, now));
  e.deliver(id, 'worker.testnet', hash, now);
  for (const actor of ['worker.testnet', 'client.testnet', 'attacker.testnet']) assert.throws(() => e.approve(id, actor, now));
  assert.deepEqual(e.approve(id, 'verifier.testnet', now), { recipient: 'worker.testnet', amount: '100' });
  assert.throws(() => e.pay(id)); assert.throws(() => e.expire(id, deadline));
  e.callback(id, true); assert.equal(e.get(id).status, 'Paid');
  assert.throws(() => e.pay(id)); assert.throws(() => e.callback(id, true));
});
test('failed approved payout cannot be stolen by expiry, retries original worker', () => {
  const { e, id } = setup(); e.deliver(id, 'worker.testnet', hash, now); e.approve(id, 'verifier.testnet', now);
  e.callback(id, false); assert.equal(e.get(id).status, 'Approved');
  assert.throws(() => e.expire(id, deadline));
  assert.equal(e.pay(id).recipient, 'worker.testnet'); e.callback(id, true); assert.equal(e.get(id).status, 'Paid');
});
for (const delivered of [false, true]) test(`deadline refunds original client, delivered=${delivered}`, () => {
  const { e, id } = setup(); if (delivered) e.deliver(id, 'worker.testnet', hash, now);
  assert.throws(() => e.expire(id, deadline - 1n));
  assert.throws(() => e.deliver(id, 'worker.testnet', hash, deadline));
  assert.throws(() => e.approve(id, 'verifier.testnet', deadline));
  assert.equal(e.expire(id, deadline).recipient, 'client.testnet');
  e.callback(id, false); assert.equal(e.get(id).status, 'Refundable');
  assert.equal(e.pay(id).recipient, 'client.testnet'); e.callback(id, true); assert.equal(e.get(id).status, 'Refunded');
  assert.throws(() => e.pay(id));
});
test('invalid creation cannot consume IDs or alter existing tasks', () => {
  const { e, id } = setup();
  for (const patch of [{ budget: '0' }, { worker: 'worker.near' }, { verifier: 'client.testnet' }, { title: ' ' }, { criteria: 'x'.repeat(2049) }, { deadline_ns: '1000' }, { budget: String(1n << 128n) }]) {
    assert.throws(() => e.create({ ...input(), ...patch }, FEE + 100n, now));
  }
  assert.throws(() => e.create(input(), 99n + FEE, now));
  assert.equal(e.next, 1); assert.equal(e.get(id).status, 'Open');
});
test('evidence format rejects malformed and replacement evidence', () => {
  const { e, id } = setup();
  for (const h of ['', 'A'.repeat(64), 'a'.repeat(63), '<script>']) assert.throws(() => e.deliver(id, 'worker.testnet', h, now));
  e.deliver(id, 'worker.testnet', hash, now); assert.throws(() => e.deliver(id, 'worker.testnet', 'b'.repeat(64), now));
});
test('account validation denies mainnet, implicit, suffix tricks and malformed names', () => {
  for (const a of ['a.near', 'testnet', 'a.testnet.evil', 'A.testnet', 'a..testnet', '-a.testnet', 'a_-.testnet', 'a'.repeat(64)]) assert.throws(() => account(a));
  assert.equal(account('sub.worker.testnet'), 'sub.worker.testnet');
});
test('read result cannot mutate escrow', () => { const { e, id } = setup(); e.get(id).status = 'Paid'; assert.equal(e.get(id).status, 'Open'); });
test('unsigned plans fail closed to testnet and expose exact budget plus fee', () => {
  const env = { NEAR_NETWORK: 'testnet', ESCROW_CONTRACT_ID: 'escrow.testnet', NEAR_SIGNER_ID: 'client.testnet' };
  const { client, ...args } = input();
  const p = plan('create_task', args, env, now);
  assert.equal(p.actions[0].deposit, String(100n + FEE)); assert.equal(p.signed, false); assert.equal(p.broadcast, false);
  assert.throws(() => plan('create_task', args, { ...env, NEAR_NETWORK: 'mainnet' }));
  assert.throws(() => plan('create_task', args, { ...env, ESCROW_CONTRACT_ID: 'escrow.near' }));
  assert.throws(() => plan('on_paid', { task_id: '0' }, env));
  assert.throws(() => plan('pay', { task_id: 0 }, env));
});
test('deterministic agent loop demonstrates release, refund and failed-transfer retry', () => {
  for (const refund of [false, true]) for (const failTransfer of [false, true]) {
    const r = runDemo({ refund, failTransfer });
    assert.equal(r.mode, 'offline-simulation'); assert.equal(r.result.status, refund ? 'Refunded' : 'Paid');
    assert.equal(r.trace.some(x => x.action === 'retry'), failTransfer);
  }
});
test('independent task settlements preserve each original beneficiary and budget', () => {
  const { e, id } = setup();
  const second = e.create({ ...input(), client: 'buyer2.testnet', worker: 'seller2.testnet', budget: '900' }, 900n + FEE, now);
  e.deliver(id, 'worker.testnet', hash, now);
  assert.deepEqual(e.approve(id, 'verifier.testnet', now), { recipient: 'worker.testnet', amount: '100' });
  assert.deepEqual(e.expire(second, deadline), { recipient: 'buyer2.testnet', amount: '900' });
  e.callback(second, false); e.callback(id, true);
  assert.equal(e.get(id).status, 'Paid'); assert.equal(e.get(second).status, 'Refundable');
  assert.deepEqual(e.pay(second), { recipient: 'buyer2.testnet', amount: '900' });
});
test('maximum task byte limits and 30-day boundary are enforced', () => {
  const e = new EscrowModel();
  const args = { ...input(), title: 'x'.repeat(160), criteria: 'x'.repeat(2048), deadline_ns: String(now + 30n * 86400n * 10n ** 9n) };
  assert.equal(e.create(args, FEE + 100n, now), '0');
  assert.throws(() => e.create({ ...args, title: 'é'.repeat(81) }, FEE + 100n, now));
  assert.throws(() => e.create({ ...args, deadline_ns: String(BigInt(args.deadline_ns) + 1n) }, FEE + 100n, now));
});
test('planner enforces u64 deadline and the exact 30-day creation window', () => {
  const env = { NEAR_NETWORK: 'testnet', ESCROW_CONTRACT_ID: 'escrow.testnet', NEAR_SIGNER_ID: 'client.testnet' };
  const { client, ...args } = input();
  const end = now + 30n * 86400n * 10n ** 9n;
  for (const d of [1n, now, end + 1n, 1n << 64n]) assert.throws(() => plan('create_task', { ...args, deadline_ns: String(d) }, env, now), /deadline/);
  for (const d of [now + 1n, end]) assert.equal(plan('create_task', { ...args, deadline_ns: String(d) }, env, now).signed, false);
});
test('non-string evidence is rejected without changing task or producing a plan', () => {
  const env = { NEAR_NETWORK: 'testnet', ESCROW_CONTRACT_ID: 'escrow.testnet', NEAR_SIGNER_ID: 'worker.testnet' };
  for (const value of [[hash], { hash }, null, 123]) {
    const { e, id } = setup();
    assert.throws(() => e.deliver(id, 'worker.testnet', value, now));
    assert.equal(e.get(id).status, 'Open'); assert.equal(e.get(id).evidence_sha256, null);
    assert.throws(() => plan('deliver', { task_id: id, evidence_sha256: value }, env));
  }
});
for (const refund of [false, true]) test(`lost callback preserves pending lock without unsafe retry, refund=${refund}`, () => {
  const { e, id } = setup();
  if (refund) e.expire(id, deadline);
  else { e.deliver(id, 'worker.testnet', hash, now); e.approve(id, 'verifier.testnet', now); }
  const status = refund ? 'Refunding' : 'PayingWorker';
  assert.equal(e.get(id).status, status);
  assert.throws(() => e.pay(id)); assert.throws(() => e.expire(id, deadline + 100000n));
  assert.equal(e.get(id).status, status);
});
