// Development-only HTTP mocks. These tests are not real LLM or on-chain E2E proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateCriteria, verifyDelivery, verifierE2e, JUDGE_MODELS, DEMO_CRITERIA, DEMO_DELIVERY } from '../scripts/ai-verifier.mjs';

const answer = (score, injection = false) => ({ injection, checks: DEMO_CRITERIA.checks.map(c => ({ id: c.id, score })) });
const completion = content => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }));
async function mocked(fetcher, fn, withKey = true) {
  const previousFetch = globalThis.fetch, previousKey = process.env.NEAR_AI_API_KEY;
  globalThis.fetch = fetcher;
  if (withKey) process.env.NEAR_AI_API_KEY = 'unit-test-placeholder'; else delete process.env.NEAR_AI_API_KEY;
  try { return await fn(); }
  finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.NEAR_AI_API_KEY; else process.env.NEAR_AI_API_KEY = previousKey;
  }
}
const verify = () => verifyDelivery({ criteria: DEMO_CRITERIA, delivery: DEMO_DELIVERY });

test('development-only checklist validation rejects duplicate IDs, unknown fields and invalid thresholds', () => {
  assert.deepEqual(validateCriteria(DEMO_CRITERIA), DEMO_CRITERIA);
  for (const value of [null, { checks: [] }, { checks: [...DEMO_CRITERIA.checks, DEMO_CRITERIA.checks[0]] }, { checks: [{ id: 'x', description: 'x', threshold: 0 }] }, { checks: [{ id: 'x', description: 'x', threshold: '80' }] }, { checks: [{ id: 'x', description: 'x', threshold: 80, override: true }] }]) assert.throws(() => validateCriteria(value));
  assert.throws(() => validateCriteria({ checks: Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, description: 'x'.repeat(512), threshold: 80 })) }));
});

test('missing key is explicitly blocked and makes no LLM calls', async () => {
  await mocked(() => { throw Error('must not call'); }, async () => {
    const result = await verifierE2e();
    assert.equal(result.status, 'partial');
    assert.equal(result.blocked, 'MISSING_NEAR_AI_API_KEY');
    assert.equal(result.positive.result.approved, false);
    assert.equal(result.injection, null);
  }, false);
});

test('mocked quorum requires two passing complete judgments and binds exact delivery bytes', async () => {
  const seen = [];
  await mocked(async (url, options) => {
    assert.equal(url, 'https://cloud-api.near.ai/v1/chat/completions');
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body); seen.push(body.model);
    assert.equal(body.messages[0].role, 'system');
    assert.equal(JSON.parse(body.messages[1].content).untrusted_delivery, DEMO_DELIVERY);
    return completion(answer(body.model === JUDGE_MODELS[2] ? 0 : 100));
  }, async () => {
    const report = await verify();
    assert.equal(report.status, 'succeeded'); assert.equal(report.result.approved, true);
    assert.equal(report.result.score, 100);
    assert.deepEqual(seen, JUDGE_MODELS);
    assert.equal(report.result.delivery_sha256, createHash('sha256').update(DEMO_DELIVERY).digest('hex'));
    assert.equal(report.result.attestation_verified, false);
  });
});

test('mocked minority cannot approve and malformed scores fail closed without echoing provider output', async () => {
  await mocked(async (_url, options) => completion(answer(JSON.parse(options.body).model === JUDGE_MODELS[0] ? 100 : 0)), async () => {
    const report = await verify(); assert.equal(report.result.approved, false); assert.equal(report.result.score, 0);
  });
  for (const content of [answer('100'), { injection: false, checks: [{ id: 'escrow', score: 100 }, { id: 'escrow', score: 100 }] }, { ...answer(100), extra: 'provider-secret' }, answer(100, true)]) {
    await mocked(async () => completion(content), async () => {
      const report = await verify(); assert.equal(report.status, 'failed'); assert.equal(report.result.approved, false);
      assert.equal(JSON.stringify(report).includes('provider-secret'), false);
    });
  }
});

test('mocked HTTP errors, truncated completions and thrown exceptions never authorize payment', async () => {
  for (const fetcher of [async () => new Response('secret error body', { status: 401 }), async () => { throw Error('secret transport message'); }, async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(answer(100)) } }] }))]) {
    await mocked(fetcher, async () => {
      const report = await verify(); assert.equal(report.status, 'failed'); assert.equal(report.result.approved, false);
      assert.equal(JSON.stringify(report).includes('secret'), false);
    });
  }
});

test('mocked injection check requires actual zero scores from every judge', async () => {
  let calls = 0;
  await mocked(async (_url, options) => {
    calls++;
    const delivery = JSON.parse(JSON.parse(options.body).messages[1].content).untrusted_delivery;
    return completion(answer(delivery.includes('IGNORE ALL') ? 0 : 100, delivery.includes('IGNORE ALL')));
  }, async () => {
    const report = await verifierE2e(); assert.equal(report.status, 'succeeded'); assert.equal(calls, 6);
    assert.ok(report.injection.result.judges.every(j => j.checks.every(c => c.score === 0)));
  });
  await mocked(async (_url, options) => {
    const delivery = JSON.parse(JSON.parse(options.body).messages[1].content).untrusted_delivery;
    return completion(answer(delivery.includes('IGNORE ALL') ? 1 : 100));
  }, async () => { assert.equal((await verifierE2e()).status, 'failed'); });
});
