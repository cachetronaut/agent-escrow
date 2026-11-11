// Executes the real release Wasm with a first-party in-memory NEAR host.
// This does not measure nearcore gas charges, consensus, networking, or real transfers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WasmHost } from '../scripts/wasm-host.mjs';

const FEE = 10n ** 23n, budget = 10n ** 24n, amount = 8n * 10n ** 23n;
const client = 'client.testnet', worker = 'worker.testnet', verifier = 'verifier.testnet';
const hash = 'a'.repeat(64), deadline = '10000';
const terms = () => ({ verifier, title: 'Verified JSON brief', criteria: 'Return a JSON summary', budget: String(budget), deadline_ns: deadline });
async function setup() { const h = await WasmHost.load(); h.call('new'); return h; }
function post(h, args = terms()) { return h.call('post', args, { caller: client, deposit: FEE }).result; }
function bid(h, task_id, bidder = worker, offer = amount) { return h.call('bid', { task_id, amount: String(offer) }, { caller: bidder }); }
function escrow(h, task_id, selected = worker, deposit = amount, caller = client) {
  return h.call('escrow', { task_id, worker: selected }, { caller, deposit });
}
function get(h, task_id) { return h.call('get_task', { task_id }).result; }
async function funded() { const h = await setup(), id = post(h); bid(h, id); escrow(h, id); return { h, id }; }
function deliver(h, id) { h.call('deliver', { task_id: id, evidence_sha256: hash }, { caller: worker }); }
function release(h, id) { return h.call('release', { task_id: id }, { caller: verifier }); }
function callback(h, id, success) { return h.call('on_paid', { task_id: id }, { caller: h.contract, results: [success] }); }
function transfer(outcome) { return outcome.promises.flatMap(p => p.actions.filter(a => a.type === 'transfer').map(a => ({ receiver: p.receiver, amount: a.amount }))); }
function unchanged(h, id, fn) { const before = get(h, id); assert.throws(fn); assert.deepEqual(get(h, id), before); }

test('Wasm exports the complete public lifecycle and initializes only once', async () => {
  const h = await setup();
  const names = WebAssembly.Module.exports(h.module).filter(e => e.kind === 'function').map(e => e.name);
  for (const method of ['post', 'bid', 'escrow', 'deliver', 'release', 'refund', 'pay', 'on_paid']) assert.ok(names.includes(method), method);
  assert.throws(() => h.call('new'));
  assert.equal(h.call('task_count').result, '0');
});

test('Wasm posting stores immutable terms and charges only the storage fee', async () => {
  const h = await setup(), id = post(h), t = get(h, id);
  assert.equal(id, '0'); assert.equal(t.client, client); assert.equal(t.verifier, verifier);
  assert.equal(t.title, terms().title); assert.equal(t.criteria, terms().criteria);
  assert.equal(t.worker, null); assert.equal(t.status, 'Posted');
  assert.equal(h.call('task_count').result, '1'); assert.ok(h.storageUsage() > 0n);
  assert.throws(() => h.call('post', terms(), { deposit: FEE + budget }));
  assert.equal(h.call('task_count').result, '1');
});

test('Wasm rejects invalid posting text, roles, amounts, and deadlines without consuming IDs', async () => {
  const h = await setup();
  for (const patch of [{ title: ' ' }, { criteria: 'x'.repeat(2049) }, { verifier: client }, { verifier: 'someone.near' },
    { verifier: h.contract }, { budget: '0' }, { deadline_ns: '1000' }, { deadline_ns: '2592000000001001' }]) {
    assert.throws(() => post(h, { ...terms(), ...patch }));
    assert.equal(h.call('task_count').result, '0');
  }
});

test('Wasm bidding requires a distinct worker, a positive capped offer, and no attached funds', async () => {
  const h = await setup(), id = post(h);
  for (const bidder of [client, verifier, h.contract]) unchanged(h, id, () => bid(h, id, bidder));
  for (const offer of [0n, budget + 1n]) unchanged(h, id, () => bid(h, id, worker, offer));
  unchanged(h, id, () => h.call('bid', { task_id: id, amount: String(amount) }, { caller: worker, deposit: 1n }));
  bid(h, id); assert.equal(get(h, id).status, 'Posted');
  unchanged(h, id, () => bid(h, id));
});

test('Wasm bounds stored bids and preserves existing offers when the cap is reached', async () => {
  const h = await setup(), id = post(h);
  for (let i = 0; i < 8; i++) bid(h, id, `worker${i}.testnet`, amount + BigInt(i));
  unchanged(h, id, () => bid(h, id, 'overflow.testnet'));
  escrow(h, id, 'worker3.testnet', amount + 3n);
  assert.equal(get(h, id).worker, 'worker3.testnet');
});

test('Wasm escrow selects an existing bid only for the original client and exact deposit', async () => {
  const h = await setup(), id = post(h); bid(h, id);
  unchanged(h, id, () => escrow(h, id, worker, amount, worker));
  unchanged(h, id, () => escrow(h, id, 'other.testnet'));
  for (const deposit of [0n, amount - 1n, amount + 1n, budget]) unchanged(h, id, () => escrow(h, id, worker, deposit));
  escrow(h, id); const t = get(h, id); assert.equal(t.status, 'Open'); assert.equal(t.worker, worker);
  unchanged(h, id, () => escrow(h, id));
  unchanged(h, id, () => bid(h, id, 'other.testnet'));
});

test('Wasm cannot deliver or release an unfunded posted task', async () => {
  const h = await setup(), id = post(h); bid(h, id);
  unchanged(h, id, () => deliver(h, id)); unchanged(h, id, () => release(h, id));
});

test('Wasm delivery is selected-worker only and immutable after the first valid digest', async () => {
  const { h, id } = await funded();
  unchanged(h, id, () => h.call('deliver', { task_id: id, evidence_sha256: hash }, { caller: client }));
  for (const evidence_sha256 of ['', 'A'.repeat(64), 'a'.repeat(63)]) unchanged(h, id, () => h.call('deliver', { task_id: id, evidence_sha256 }, { caller: worker }));
  deliver(h, id); assert.equal(get(h, id).status, 'Delivered'); assert.equal(get(h, id).evidence_sha256, hash);
  unchanged(h, id, () => deliver(h, id));
});

test('Wasm complete post bid escrow deliver release flow transfers only the selected bid amount', async () => {
  const { h, id } = await funded(); deliver(h, id);
  const outcome = release(h, id);
  assert.deepEqual(transfer(outcome), [{ receiver: worker, amount: String(amount) }]);
  assert.equal(get(h, id).status, 'PayingWorker');
  const cb = outcome.promises.find(p => p.receiver === h.contract);
  assert.equal(cb.after, 0); assert.equal(cb.actions[0].method, 'on_paid');
  assert.deepEqual(cb.actions[0].args, { task_id: id }); assert.equal(cb.actions[0].gas, '15000000000000');
  assert.equal(callback(h, id, true).result, true); assert.equal(get(h, id).status, 'Paid');
  unchanged(h, id, () => release(h, id)); unchanged(h, id, () => h.call('pay', { task_id: id }));
  unchanged(h, id, () => callback(h, id, true));
});

test('Wasm release requires verifier approval of delivered work before deadline', async () => {
  const { h, id } = await funded(); unchanged(h, id, () => release(h, id)); deliver(h, id);
  for (const caller of [client, worker, 'attacker.testnet']) unchanged(h, id, () => h.call('release', { task_id: id }, { caller }));
  unchanged(h, id, () => h.call('release', { task_id: id }, { caller: verifier, now: BigInt(deadline) }));
});

test('Wasm failed worker transfer preserves entitlement and retry cannot change beneficiary', async () => {
  const { h, id } = await funded(); deliver(h, id); release(h, id);
  assert.equal(callback(h, id, false).result, false); assert.equal(get(h, id).status, 'Approved');
  unchanged(h, id, () => h.call('refund', { task_id: id }, { now: BigInt(deadline) }));
  const outcome = h.call('pay', { task_id: id }, { caller: 'keeper.testnet' });
  assert.deepEqual(transfer(outcome), [{ receiver: worker, amount: String(amount) }]);
  callback(h, id, true); assert.equal(get(h, id).status, 'Paid');
});

for (const delivered of [false, true]) test(`Wasm refund returns funded amount to original client, delivered=${delivered}`, async () => {
  const { h, id } = await funded(); if (delivered) deliver(h, id);
  unchanged(h, id, () => h.call('refund', { task_id: id }, { now: BigInt(deadline) - 1n }));
  const outcome = h.call('refund', { task_id: id }, { caller: 'keeper.testnet', now: BigInt(deadline) });
  assert.deepEqual(transfer(outcome), [{ receiver: client, amount: String(amount) }]);
  callback(h, id, false); assert.equal(get(h, id).status, 'Refundable');
  assert.deepEqual(transfer(h.call('pay', { task_id: id })), [{ receiver: client, amount: String(amount) }]);
  callback(h, id, true); assert.equal(get(h, id).status, 'Refunded');
});

test('Wasm callback ABI rejects nonself callers, absent results and multiple results', async () => {
  const { h, id } = await funded(); deliver(h, id); release(h, id);
  unchanged(h, id, () => h.call('on_paid', { task_id: id }, { caller: worker, results: [true] }));
  for (const results of [[], [true, true]]) unchanged(h, id, () => h.call('on_paid', { task_id: id }, { caller: h.contract, results }));
  callback(h, id, true); assert.equal(get(h, id).status, 'Paid');
});

test('Wasm rejects expired bids, escrow and delivery at the deadline boundary', async () => {
  const h = await setup(), id = post(h);
  unchanged(h, id, () => h.call('bid', { task_id: id, amount: String(amount) }, { caller: worker, now: BigInt(deadline) }));
  bid(h, id);
  unchanged(h, id, () => h.call('escrow', { task_id: id, worker }, { deposit: amount, now: BigInt(deadline) }));
  escrow(h, id);
  unchanged(h, id, () => h.call('deliver', { task_id: id, evidence_sha256: hash }, { caller: worker, now: BigInt(deadline) }));
});

test('Wasm payout gas floor rejects release atomically and pending callbacks lock retries', async () => {
  const { h, id } = await funded(); deliver(h, id);
  unchanged(h, id, () => h.call('release', { task_id: id }, { caller: verifier, prepaidGas: 34_999_999_999_999n }));
  release(h, id);
  unchanged(h, id, () => h.call('pay', { task_id: id }));
  unchanged(h, id, () => h.call('refund', { task_id: id }, { now: BigInt(deadline) }));
});

test('Wasm expired unfunded posting cancels without creating any transfer', async () => {
  const h = await setup(), id = post(h); bid(h, id);
  const outcome = h.call('refund', { task_id: id }, { caller: 'keeper.testnet', now: BigInt(deadline) });
  assert.equal(get(h, id).status, 'Cancelled'); assert.deepEqual(outcome.promises, []);
  unchanged(h, id, () => escrow(h, id)); unchanged(h, id, () => h.call('pay', { task_id: id }));
});

test('Wasm storage reserve covers maximum text, eight maximum-length workers, selection and evidence', async () => {
  const h = await setup(), before = h.storageUsage();
  const id = post(h, { ...terms(), title: 'x'.repeat(160), criteria: 'y'.repeat(2048) });
  const workers = Array.from({ length: 8 }, (_, i) => `w${i}${'x'.repeat(54)}.testnet`);
  assert.ok(workers.every(w => w.length === 64));
  workers.forEach((w, i) => bid(h, id, w, amount + BigInt(i)));
  escrow(h, id, workers[7], amount + 7n);
  h.call('deliver', { task_id: id, evidence_sha256: hash }, { caller: workers[7] });
  const used = h.storageUsage() - before;
  assert.ok(used * 10n ** 19n < FEE, 'retained fee covers modeled storage');
  const outcome = release(h, id);
  assert.deepEqual(transfer(outcome), [{ receiver: workers[7], amount: String(amount + 7n) }]);
  callback(h, id, true); assert.equal(get(h, id).status, 'Paid');
});

test('Wasm independent task payouts preserve each selected offer and original beneficiary', async () => {
  const h = await setup(), first = post(h), second = post(h);
  bid(h, first); bid(h, second, 'second.testnet', amount / 2n);
  escrow(h, first); escrow(h, second, 'second.testnet', amount / 2n);
  deliver(h, first);
  const paid = release(h, first);
  const refunded = h.call('refund', { task_id: second }, { caller: 'keeper.testnet', now: BigInt(deadline) });
  assert.deepEqual(transfer(paid), [{ receiver: worker, amount: String(amount) }]);
  assert.deepEqual(transfer(refunded), [{ receiver: client, amount: String(amount / 2n) }]);
  callback(h, second, false); callback(h, first, true);
  assert.equal(get(h, first).status, 'Paid'); assert.equal(get(h, second).status, 'Refundable');
  assert.deepEqual(transfer(h.call('pay', { task_id: second })), [{ receiver: client, amount: String(amount / 2n) }]);
});
