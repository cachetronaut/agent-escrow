import { EscrowModel, FEE } from './escrow.mjs';
const $ = id => document.getElementById(id);
let model = new EscrowModel(), id, now = BigInt(Date.now()) * 1000000n, artifact, generation = 0;
function log(text) { const li = document.createElement('li'); li.textContent = text; $('events').prepend(li); }
function update() {
  const t = id === undefined ? null : model.get(id), s = t?.status;
  $('status').textContent = s || 'AWAITING TASK';
  $('deliver').disabled = s !== 'Open'; $('approve').disabled = s !== 'Delivered';
  $('expire').disabled = !['Open', 'Delivered'].includes(s);
  $('retry').disabled = !['Approved', 'Refundable'].includes(s);
  for (const field of $('task-form').elements) field.disabled = Boolean(t);
}
async function act(fn) { const activeGeneration = generation; try { $('feedback').textContent = ''; await fn(); } catch (e) { if (generation === activeGeneration) $('feedback').textContent = e.message; } update(); }
function settle(transfer) {
  log(`Transfer requested: ${transfer.amount} yoctoNEAR → ${transfer.recipient}`);
  const ok = !$('fail').checked; $('fail').checked = false;
  model.callback(id, ok); log(ok ? 'Receipt succeeded. Balance settled.' : 'Receipt failed. Claim preserved; retry available.');
}
$('task-form').addEventListener('submit', e => { e.preventDefault(); act(() => {
  const raw = $('budget').value;
  if (!/^[0-9]+(?:\.[0-9]{1,24})?$/.test(raw)) throw Error('Use up to 24 decimal places');
  const [whole, fraction = ''] = raw.split('.'); const budget = String(BigInt(whole) * 10n ** 24n + BigInt(fraction.padEnd(24, '0')));
  const minutes = Number($('minutes').value);
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 43200) throw Error('Deadline must be 1 to 43200 minutes');
  now = BigInt(Date.now()) * 1000000n;
  id = model.create({ client: 'client.testnet', worker: 'worker.testnet', verifier: 'verifier.testnet', title: $('title').value,
    criteria: $('criteria').value, budget, deadline_ns: String(now + BigInt(minutes) * 60n * 10n ** 9n) }, BigInt(budget) + FEE, now);
  $('order').textContent = `${$('title').value} · ${raw} test NEAR locked`;
  log('Client posted terms and escrowed the budget in this local model.');
}); });
$('deliver').onclick = () => act(async () => {
  const activeModel = model, activeId = id, activeGeneration = generation, deliveryTime = now + 1n;
  const deliveredArtifact = { summary: 'NEAR uses asynchronous receipts. A private callback records payment success and preserves claims on failure.', source: 'https://docs.near.org/' };
  const bytes = new TextEncoder().encode(JSON.stringify(deliveredArtifact));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
  if (generation !== activeGeneration || model !== activeModel || id !== activeId) return;
  activeModel.deliver(activeId, 'worker.testnet', hash, deliveryTime);
  artifact = deliveredArtifact;
  $('artifact').hidden = false; $('artifact').textContent = JSON.stringify(artifact, null, 2) + '\nSHA-256: ' + hash;
  log('Worker delivered JSON. Evidence digest anchored in model.');
});
$('approve').onclick = () => act(() => {
  // Human-controlled verifier demo: arbitrary free-text terms require human judgment.
  log('Named verifier attested that the displayed artifact meets the immutable terms.');
  settle(model.approve(id, 'verifier.testnet', now + 2n));
});
$('expire').onclick = () => act(() => { now = BigInt(model.get(id).deadline_ns); log('Simulation clock advanced to deadline. Keeper called expire.'); settle(model.expire(id, now)); });
$('retry').onclick = () => act(() => settle(model.pay(id)));
$('reset').onclick = () => { generation++; model = new EscrowModel(); id = undefined; artifact = undefined; $('events').replaceChildren(); $('artifact').hidden = true; $('feedback').textContent = ''; $('order').textContent = 'Create a task to begin.'; update(); };
update();
