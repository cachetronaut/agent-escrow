// Walkthrough of one recorded NEAR testnet run. Every fact shown is read from
// docs/warranty-verification.json (served as /evidence.mjs). Nothing is simulated.
import evidence from '/evidence.mjs';
import { createScene } from './scene.mjs';

const $ = id => document.getElementById(id);
const get = path => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), evidence);
const R = 'retest_first_attempt', T = `${R}.final_task`, X = `${R}.transactions`, W = 'completion_checks.warranty_expiry';
const EXPLORER = 'https://testnet.nearblocks.io/txns/';

export function near(yocto) {
  const n = BigInt(yocto), unit = 10n ** 24n, frac = (n % unit).toString().padStart(24, '0').replace(/0+$/, '');
  return `${n / unit}${frac ? '.' + frac : ''} test NEAR`;
}
const formats = {
  text: v => String(v), near, percent: v => `${v}%`, model: v => String(v).split('/').pop(),
  seconds: v => { const n = BigInt(v); if (n % 10n ** 9n) throw Error('Not whole seconds'); return `${n / 10n ** 9n} seconds`; },
  bool: v => (v === true ? 'Yes' : v === false ? 'No' : (() => { throw Error('Not boolean'); })()),
  none: v => (v === null ? 'None recorded' : String(v)), score: v => String(v), events: v => v.join(' → ')
};
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function fact(path, fmt, cls) {
  const e = el('span', cls), v = get(path);
  e.dataset.src = path; e.dataset.fmt = fmt;
  try { if (v === undefined) throw Error('missing'); e.textContent = formats[fmt](v); }
  catch { e.textContent = 'not in evidence'; e.classList.add('missing'); }
  return e;
}
function row(label, ...values) { const r = el('div', 'row'); r.append(el('span', 'label', label)); const v = el('span', 'value'); v.append(...values); r.append(v); return r; }
const eventsOf = tx => (get(`${tx}.receipts`) || []).flatMap(r => (r.events || []).map(e => e.event));
function eventsFact(tx) {
  const e = el('span', 'events'), v = eventsOf(tx);
  e.dataset.src = `${tx}.receipts[].events[].event`; e.dataset.fmt = 'events';
  e.textContent = v.length ? formats.events(v) : 'not in evidence';
  return e;
}
// A transaction link is rendered only when its hash, success status, and explorer URL all agree.
function tx(label, path, rechecked) {
  const hash = get(`${path}.transaction_hash`), status = get(`${path}.status`), url = get(`${path}.explorer`);
  const box = el('div', 'tx' + (rechecked ? ' rechecked' : ''));
  box.append(el('span', 'label', label));
  if (typeof hash !== 'string' || status !== 'success' || url !== EXPLORER + hash) { box.append(el('span', 'value missing', 'No verified transaction in evidence')); return box; }
  const a = el('a', 'hash', hash); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.dataset.src = `${path}.transaction_hash`; a.dataset.fmt = 'text';
  const badge = el('span', 'badge', rechecked ? 'Receipt re-checked on testnet' : 'Recorded in run · success');
  box.append(a, badge, row('Contract events', eventsFact(path)));
  return box;
}
// Release and settlement count as re-checked only when the completion check names these exact hashes.
const recheckedHash = key => get(`${W}.status`) === 'passed' && get(`${W}.${key}`) === get(`${X}.${key === 'release_tx' ? 'release_0' : 'warranty_expiry'}.transaction_hash`);

function judges(title, base, verdictText, good) {
  const box = el('div', 'judges ' + (good ? 'good' : 'bad'));
  box.append(el('p', 'judges-title', title));
  const list = get(base) || [];
  const grid = el('div', 'judge-grid');
  list.forEach((j, i) => {
    const p = `${base}.${i}`, card = el('div', 'judge');
    card.append(fact(`${p}.model`, 'model', 'model'), fact(`${p}.score`, 'score', 'score'));
    const checks = el('span', 'checks');
    (j.checks || []).forEach((c, k) => { checks.append(fact(`${p}.checks.${k}.id`, 'text'), document.createTextNode(' '), fact(`${p}.checks.${k}.score`, 'score'), document.createTextNode(k < j.checks.length - 1 ? ' · ' : '')); });
    card.append(checks, el('span', 'verdict', j.approved === true ? 'Approved' : j.approved === false ? (j.injection === true ? 'Injection detected · rejected' : 'Rejected') : 'not in evidence'));
    grid.append(card);
  });
  if (!list.length) grid.append(el('span', 'value missing', 'not in evidence'));
  box.append(grid, el('p', 'judges-verdict', verdictText));
  return box;
}

function notVerified() {
  const box = el('div', 'unverified');
  box.append(el('p', 'unverified-title', 'Not yet verified on testnet'));
  const items = [['Warranty claim and refund of the hold', 'completion_checks.claim'], ['Deadline refund to the client', 'completion_checks.refund'], ['Intents dry-run quote', 'completion_checks.quote']];
  const ul = el('ul');
  for (const [name, path] of items) {
    const status = get(`${path}.status`);
    const li = el('li'); li.append(el('strong', '', name), el('span', '', ` · status: ${status ?? 'not in evidence'} · no receipt shown`));
    ul.append(li);
  }
  const reason = get('completion_checks.claim.reason');
  box.append(ul);
  if (reason) { const p = el('p', 'reason'); p.append('Claim and refund blocker on record: ', fact('completion_checks.claim.reason', 'text')); box.append(p); }
  return box;
}

const STEPS = [
  { key: 'post', title: 'Post', seconds: 15, headline: 'The client posts fixed terms, names a verifier, and sets a budget ceiling.', facts: () => [
    row('Task', fact(`${T}.title`, 'text')), row('Budget ceiling', fact(`${T}.budget`, 'near')),
    row('Warranty hold', fact(`${T}.retention_percent`, 'percent'), ' of the payout, for ', fact(`${T}.warranty_window_ns`, 'seconds')),
    row('Client', fact(`${T}.client`, 'text', 'acct')), tx('Post transaction', `${X}.post_0`)] },
  { key: 'bid', title: 'Bid', seconds: 13, headline: 'A worker agent bids under the ceiling. No money moves yet.', facts: () => [
    row('Worker', fact(`${T}.bids.0.worker`, 'text', 'acct')), row('Bid', fact(`${T}.bids.0.amount`, 'near')), tx('Bid transaction', `${X}.bid_0`)] },
  { key: 'escrow', title: 'Escrow', seconds: 15, headline: 'The client accepts the bid and locks exactly that amount in the contract.', facts: () => [
    row('Locked in escrow', fact(`${T}.escrow_amount`, 'near', 'big')), row('Contract', fact(`${R}.accounts.contract`, 'text', 'acct')), tx('Escrow transaction', `${X}.escrow_0`)] },
  { key: 'deliver', title: 'Deliver', seconds: 14, headline: 'The worker delivers and commits a SHA-256 digest of the work on-chain.', facts: () => [
    row('Evidence SHA-256', fact(`${T}.evidence_sha256`, 'text', 'mono')), tx('Deliver transaction', `${X}.deliver_0`)] },
  { key: 'judge', title: 'Judge', seconds: 22, headline: 'Three independent AI judges score the delivery. A prompt-injection attempt is caught.', facts: () => [
    judges('Good delivery', `${R}.ai_positive.result.judges`, get(`${R}.ai_positive.result.approved`) === true ? 'Quorum approved. Release can proceed.' : '', true),
    judges('Injection check: a delivery carrying a prompt injection', 'ai_e2e.injection_judges', get('completion_checks.injection.all_three_judges_zero') === true ? 'All three flagged the injection and scored it zero.' : '', false),
    row('Authority', fact(`${R}.ai_positive.result.authority`, 'text'))] },
  { key: 'release', title: 'Release', seconds: 19, headline: 'The named verifier releases payment. Part of it stays locked as a warranty hold.', facts: () => [
    row('Kept as warranty hold', fact(`${T}.hold_amount`, 'near', 'big gold'), ' (', fact(`${T}.retention_percent`, 'percent'), ')'),
    row('Initial payout to worker verified', fact(`${R}.initial_payout_verified`, 'bool')),
    tx('Release receipt', `${X}.release_0`, recheckedHash('release_tx'))] },
  { key: 'warranty', title: 'Warranty', seconds: 22, headline: 'No claim within the window, so the hold swings open and pays the worker.', facts: () => [
    row('Claim evidence', fact(`${T}.claim_evidence_sha256`, 'none')),
    row('Hold paid to worker', fact(`${W}.worker_hold_payout`, 'near', 'gold')), row('Worker total payout', fact(`${R}.worker_total_payout`, 'near', 'big')),
    row('Task status', fact(`${T}.status`, 'text', 'status')),
    tx('Settlement receipt', `${X}.warranty_expiry`, recheckedHash('settle_tx')), notVerified()] }
];

let scene = null;
try {
  const scores = base => (get(base) || []).map(j => j.score);
  scene = createScene($('scene'), {
    retentionPercent: get(`${T}.retention_percent`), finalStatus: get(`${T}.status`),
    goodScores: scores(`${R}.ai_positive.result.judges`), badScores: scores('ai_e2e.injection_judges')
  });
} catch (e) { $('scene-note').textContent = '3D view unavailable in this browser: ' + e.message; }

let index = 0, playing = false, startedAt = 0, elapsedBefore = 0;
const chips = STEPS.map((s, i) => {
  const li = el('li'), b = el('button', 'chip'); b.type = 'button';
  b.append(el('span', 'n', String(i + 1)), el('span', 't', s.title));
  b.onclick = () => go(i); li.append(b); $('steps').append(li); return b;
});
function go(i) {
  index = Math.max(0, Math.min(STEPS.length - 1, i)); elapsedBefore = 0; startedAt = performance.now();
  const s = STEPS[index];
  chips.forEach((c, k) => { c.classList.toggle('active', k === index); c.classList.toggle('done', k < index); c.setAttribute('aria-current', k === index ? 'step' : 'false'); });
  $('count').textContent = `Step ${index + 1} of ${STEPS.length}`;
  $('step-title').textContent = s.title; $('headline').textContent = s.headline;
  $('facts').replaceChildren(...(evidence ? s.facts() : [el('p', 'value missing', 'Evidence file docs/warranty-verification.json was not found. No facts shown.')]));
  $('panel').classList.remove('enter'); void $('panel').offsetWidth; $('panel').classList.add('enter');
  document.body.dataset.step = s.key;
  scene?.setStep(s.key);
}
function setPlaying(on) {
  if (on && !playing) startedAt = performance.now();
  if (!on && playing) elapsedBefore += performance.now() - startedAt;
  playing = on; $('play').textContent = on ? 'Pause' : 'Play';
}
function tick() {
  const s = STEPS[index], ms = s.seconds * 1000, elapsed = elapsedBefore + (playing ? performance.now() - startedAt : 0);
  $('progress').style.transform = `scaleX(${Math.min(1, elapsed / ms)})`;
  if (playing && elapsed >= ms) { if (index < STEPS.length - 1) go(index + 1); else setPlaying(false); }
  requestAnimationFrame(tick);
}
$('prev').onclick = () => go(index - 1);
$('next').onclick = () => go(index + 1);
$('play').onclick = () => { if (!playing && index === STEPS.length - 1) go(0); setPlaying(!playing); };
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') go(index + 1); else if (e.key === 'ArrowLeft') go(index - 1);
  else if (e.key === ' ') { e.preventDefault(); $('play').click(); } else if (e.key === 'Home') go(0);
});

const run = get(`${R}.ai_positive.trace.startedAtUtc`);
$('meta').textContent = ['NEAR testnet', get(`${R}.accounts.contract`), run ? `run ${String(run).slice(0, 10)}` : null, 'Cachetronaut'].filter(Boolean).join('  ·  ');
$('foot').textContent = 'Shown: task 0 of one recorded testnet run, read from docs/warranty-verification.json. AI judge votes are off-chain evidence. Not yet verified: warranty claim, deadline refund, Intents quote.';

const params = new URLSearchParams(location.search);
go(Number(params.get('step') || 1) - 1);
if (params.has('autoplay')) setPlaying(true);
tick();
