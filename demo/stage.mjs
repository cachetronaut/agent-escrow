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
  text: v => String(v), near, percent: v => `${v}%`, model: v => String(v).split('/').pop(), score: v => String(v),
  yocto: v => `= ${BigInt(v).toLocaleString('en-US').replaceAll(',', ' ')} yoctoNEAR`,
  seconds: v => { const n = BigInt(v); if (n % 10n ** 9n) throw Error('Not whole seconds'); return `${n / 10n ** 9n} seconds`; },
  bool: v => (v === true ? 'Yes' : v === false ? 'No' : (() => { throw Error('Not boolean'); })()),
  none: v => (v === null ? 'None recorded' : String(v)), events: v => v.join(' › ')
};
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function fact(path, fmt, cls) {
  const e = el('span', cls), v = get(path);
  e.dataset.src = path; e.dataset.fmt = fmt;
  try { if (v === undefined) throw Error('missing'); e.textContent = formats[fmt](v); }
  catch { e.textContent = 'not in evidence'; e.classList.add('missing'); }
  return e;
}
// A receipt line with dotted leaders, in the style of a printed slip.
function line(label, value, valueCls = '') {
  const r = el('div', 'line'), v = el('span', 'v ' + valueCls);
  v.append(...[value].flat()); r.append(el('span', 'k', label), el('span', 'lead'), v); return r;
}
const amount = (label, path) => [line(label, fact(path, 'near'), 'amount'), fact(path, 'yocto', 'yocto')];
const eventsOf = tx => (get(`${tx}.receipts`) || []).flatMap(r => (r.events || []).map(e => e.event));
// A transaction is rendered only when its hash, success status and explorer URL all agree.
function receipt(label, path, rechecked) {
  const hash = get(`${path}.transaction_hash`), status = get(`${path}.status`), url = get(`${path}.explorer`);
  const box = el('div', 'receipt'); box.append(el('span', 'k', label));
  if (typeof hash !== 'string' || status !== 'success' || url !== EXPLORER + hash) { box.append(el('span', 'missing', 'No verified transaction in evidence')); return box; }
  const a = el('a', '', hash); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.dataset.src = `${path}.transaction_hash`; a.dataset.fmt = 'text';
  const ev = el('span', 'events'), list = eventsOf(path);
  ev.append('Contract events: ');
  const names = el('span', '', list.length ? formats.events(list) : 'not in evidence');
  names.dataset.src = `${path}.receipts[].events[].event`; names.dataset.fmt = 'events'; ev.append(names);
  box.append(a, ev, el('span', rechecked ? 'stamp pass' : 'stamp plain', rechecked ? 'Receipt re-checked on testnet' : 'Recorded in run · success'));
  return box;
}
// Release and settlement count as re-checked only when the completion check names these exact hashes.
const recheckedHash = (key, tx) => get(`${W}.status`) === 'passed' && get(`${W}.${key}`) === get(`${X}.${tx}.transaction_hash`);

function matrix() {
  const good = `${R}.ai_positive.result.judges`, bad = 'ai_e2e.injection_judges';
  const t = el('table', 'matrix'), cg = el('colgroup');
  cg.append(el('col'), el('col'), el('col')); t.append(cg);
  const head = el('thead'), hr = el('tr'); hr.append(el('th', '', 'Judge'), el('th', '', 'Good delivery'), el('th', '', 'Prompt injection')); head.append(hr); t.append(head);
  const body = el('tbody'), n = Math.max((get(good) || []).length, (get(bad) || []).length);
  const cell = (base, i) => {
    const j = get(`${base}.${i}`), td = el('td', j?.approved === true ? 'ok' : 'no');
    if (!j) { td.append(el('span', 'missing', 'not in evidence')); return td; }
    td.append(fact(`${base}.${i}.score`, 'score', 'score'));
    const sub = el('span', 'sub');
    (j.checks || []).forEach((c, k) => sub.append(k ? ' · ' : '', fact(`${base}.${i}.checks.${k}.id`, 'text'), ' ', fact(`${base}.${i}.checks.${k}.score`, 'score')));
    sub.append(j.approved === true ? ' · approved' : j.injection === true ? ' · injection flagged' : ' · rejected');
    td.append(sub); return td;
  };
  for (let i = 0; i < n; i++) {
    const tr = el('tr'), who = el('td'); who.append(fact(`${good}.${i}.model`, 'model'));
    tr.append(who, cell(good, i), cell(bad, i)); body.append(tr);
  }
  t.append(body);
  const foot = el('tfoot'), fr = el('tr');
  fr.append(el('td', '', 'Verdict'), el('td', '', get(`${R}.ai_positive.result.approved`) === true ? 'Quorum approved' : ''), el('td', '', get('completion_checks.injection.all_three_judges_zero') === true ? 'All three scored it zero' : ''));
  foot.append(fr); t.append(foot);
  const p = el('p', 'authority'); p.append('Authority: ', fact(`${R}.ai_positive.result.authority`, 'text'));
  return [t, p];
}

const verificationChecks = [['Warranty claim and refund of the hold', 'completion_checks.claim'], ['Deadline refund to the client', 'completion_checks.refund'], ['Intents dry-run quote', 'completion_checks.quote']];
const unverifiedChecks = verificationChecks.filter(([, path]) => get(`${path}.status`) !== 'passed');

function notVerified() {
  if (!unverifiedChecks.length) return el('span', 'stamp pass', 'All completion checks passed');
  const box = el('div', 'unverified');
  box.append(el('span', 'stamp block', 'Not yet verified on testnet'));
  const ul = el('ul');
  for (const [name, path] of unverifiedChecks) {
    const li = el('li'); li.append(el('strong', '', name), el('span', '', get(`${path}.status`) ?? 'not in evidence')); ul.append(li);
  }
  box.append(ul);
  if (unverifiedChecks.some(([, path]) => path === 'completion_checks.claim') && get('completion_checks.claim.reason')) { const p = el('p', 'reason'); p.append('Claim and refund blocker on record: ', fact('completion_checks.claim.reason', 'text')); box.append(p); }
  return box;
}

const STEPS = [
  { key: 'post', title: 'Post', seconds: 15, headline: 'A client agent posts the job: fixed terms, a named verifier and a budget ceiling.', facts: () => [
    line('Task', fact(`${T}.title`, 'text')), ...amount('Budget ceiling', `${T}.budget`),
    line('Warranty hold', [fact(`${T}.retention_percent`, 'percent'), ' for ', fact(`${T}.warranty_window_ns`, 'seconds')]),
    line('Client', fact(`${T}.client`, 'text', 'acct')), receipt('Post transaction', `${X}.post_0`)] },
  { key: 'bid', title: 'Bid', seconds: 13, headline: 'A worker agent bids under the ceiling. No money has moved yet.', facts: () => [
    line('Worker', fact(`${T}.bids.0.worker`, 'text', 'acct')), ...amount('Bid', `${T}.bids.0.amount`), receipt('Bid transaction', `${X}.bid_0`)] },
  { key: 'escrow', title: 'Escrow', seconds: 15, headline: 'The client accepts the bid and locks that exact amount in the contract.', facts: () => [
    ...amount('Locked in escrow', `${T}.escrow_amount`), line('Contract', fact(`${R}.accounts.contract`, 'text', 'acct')), receipt('Escrow transaction', `${X}.escrow_0`)] },
  { key: 'deliver', title: 'Deliver', seconds: 14, headline: 'The worker hands in the work and anchors its SHA-256 fingerprint on-chain.', facts: () => [
    line('Evidence fingerprint', ''), fact(`${T}.evidence_sha256`, 'text', 'digest'), receipt('Deliver transaction', `${X}.deliver_0`)] },
  { key: 'judge', title: 'Judge', seconds: 22, headline: 'Three AI judges grade the work. A delivery carrying a prompt injection is rejected.', facts: matrix },
  { key: 'release', title: 'Release', seconds: 19, headline: 'The verifier releases payment. A slice stays locked as a warranty hold.', facts: () => [
    ...amount('Kept as warranty hold', `${T}.hold_amount`), line('Share of payout', fact(`${T}.retention_percent`, 'percent')),
    line('Initial payout verified', fact(`${R}.initial_payout_verified`, 'bool')),
    receipt('Release receipt', `${X}.release_0`, recheckedHash('release_tx', 'release_0'))] },
  { key: 'warranty', title: 'Warranty', seconds: 22, headline: 'No claim arrived in the window, so the hold opens and pays the worker.', facts: () => [
    line('Claim evidence', fact(`${T}.claim_evidence_sha256`, 'none')), line('Hold paid to worker', fact(`${W}.worker_hold_payout`, 'near')),
    ...amount('Worker total payout', `${R}.worker_total_payout`), line('Task status', fact(`${T}.status`, 'text', 'status-paid')),
    receipt('Settlement receipt', `${X}.warranty_expiry`, recheckedHash('settle_tx', 'warranty_expiry')), notVerified()] }
];

let scene = null;
try {
  await Promise.all([document.fonts.load('850 64px Archivo'), document.fonts.load('600 64px "Plex Mono"')]);
  const scores = base => (get(base) || []).map(j => j.score), short = path => { const v = get(path); return v === undefined ? null : near(v); };
  scene = createScene($('scene'), {
    retentionPercent: get(`${T}.retention_percent`), finalStatus: get(`${T}.status`),
    goodScores: scores(`${R}.ai_positive.result.judges`), badScores: scores('ai_e2e.injection_judges'),
    amounts: { escrow: short(`${T}.escrow_amount`), hold: short(`${T}.hold_amount`) },
    onJudgePhase: injection => document.querySelectorAll('.matrix col').forEach((c, i) => c.classList.toggle('live', i === (injection ? 2 : 1)))
  });
} catch (e) { $('scene-note').hidden = false; $('scene-note').textContent = '3D view unavailable in this browser: ' + e.message; }

// Keep the 3D composition clear of the caption, slip and rail.
const wide = matchMedia('(min-width: 1100px)');
function frame() {
  if (!scene) return;
  if (!wide.matches) { scene.setInsets({ top: 0, right: 0, bottom: 0 }); return; }
  scene.setInsets({ top: $('chapter').getBoundingClientRect().bottom + 12, right: innerWidth - $('slip').getBoundingClientRect().left + 24, bottom: innerHeight - $('steps').getBoundingClientRect().top + 24 });
}
new ResizeObserver(frame).observe(document.body);

let index = 0, playing = false, startedAt = 0, elapsedBefore = 0;
const stops = STEPS.map((s, i) => {
  const li = el('li'), b = el('button', 'stop'); b.type = 'button';
  b.append(el('span', 'fill'), el('span', 'dot'), el('span', 'name', s.title), el('span', 'num', String(i + 1).padStart(2, '0')));
  b.onclick = () => go(i); li.append(b); $('steps').append(li); return b;
});
const replay = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
function go(i) {
  index = Math.max(0, Math.min(STEPS.length - 1, i)); elapsedBefore = 0; startedAt = performance.now();
  const s = STEPS[index];
  stops.forEach((b, k) => { b.classList.toggle('active', k === index); b.classList.toggle('done', k < index); b.setAttribute('aria-current', k === index ? 'step' : 'false'); b.querySelector('.fill').style.transform = ''; });
  $('count').textContent = `Step ${String(index + 1).padStart(2, '0')} of ${String(STEPS.length).padStart(2, '0')}`;
  $('step-title').textContent = s.title; $('headline').textContent = s.headline;
  $('facts').replaceChildren(...(evidence ? s.facts() : [el('p', 'missing', 'Evidence file docs/warranty-verification.json was not found. No facts shown.')]));
  replay($('chapter'), 'enter'); replay($('slip'), 'enter');
  document.body.dataset.step = s.key;
  scene?.setStep(s.key);
}
function setPlaying(on) {
  if (on && !playing) startedAt = performance.now();
  if (!on && playing) elapsedBefore += performance.now() - startedAt;
  playing = on;
  $('play').setAttribute('aria-label', on ? 'Pause' : 'Play');
  $('play-icon').setAttribute('d', on ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z');
}
function tick() {
  const s = STEPS[index], elapsed = elapsedBefore + (playing ? performance.now() - startedAt : 0), p = Math.min(1, elapsed / (s.seconds * 1000));
  stops[index].querySelector('.fill').style.transform = `scaleX(${p})`;
  if (playing && p >= 1) { if (index < STEPS.length - 1) go(index + 1); else setPlaying(false); }
  requestAnimationFrame(tick);
}
$('prev').onclick = () => go(index - 1);
$('next').onclick = () => go(index + 1);
$('play').onclick = () => { if (!playing && index === STEPS.length - 1) go(0); setPlaying(!playing); };
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') go(index + 1); else if (e.key === 'ArrowLeft') go(index - 1);
  else if (e.key === ' ') { e.preventDefault(); $('play').click(); } else if (e.key === 'Home') go(0);
});

const run = get(`${R}.ai_positive.trace.startedAtUtc`), taskId = get(`${X}.post_0.receipts.1.events.0.task_id`);
$('run').textContent = ['NEAR testnet', run ? `run of ${String(run).slice(0, 10)}` : null, 'by Cachetronaut'].filter(Boolean).join(' · ');
$('slip-ref').textContent = [taskId === undefined ? null : `Task ${taskId}`, get(`${R}.accounts.contract`)].filter(Boolean).join(' · ');
$('scope').textContent = `Task ${taskId ?? ''} of one recorded testnet run, read from docs/warranty-verification.json. AI judge votes are off-chain evidence. ${unverifiedChecks.length ? `Not yet verified: ${unverifiedChecks.map(([name]) => name).join(', ')}.` : 'All shown contract steps verified on NEAR testnet. Intents dry-run quote passed; unsigned and unexecuted.'}`;

const params = new URLSearchParams(location.search);
go(Number(params.get('step') || 1) - 1);
requestAnimationFrame(frame);
if (params.has('autoplay')) setPlaying(true);
tick();
