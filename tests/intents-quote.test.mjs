import test from 'node:test';
import assert from 'node:assert/strict';
import { dryRunPayoutQuote } from '../scripts/intents-quote.mjs';

const amount = '36000000000000000000000';
const tokens = [
  { assetId: 'nep141:wrap.near', blockchain: 'near', decimals: 24, symbol: 'wNEAR' },
  { assetId: 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1', blockchain: 'near', decimals: 6, symbol: 'USDC' },
];
function fixture(transform = x => x) {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    if (calls.length === 1) return { ok: true, json: async () => tokens };
    const quoteRequest = JSON.parse(options.body);
    return { ok: true, json: async () => transform({ quoteRequest, quote: { amountIn: amount, amountOut: '120000', minAmountOut: '118800' }, signature: 'SERVICE_SIGNATURE_NOT_FOR_OUTPUT' }) };
  } };
}

test('payout quote uses exactly public metadata and a dry quote with example addresses', async () => {
  const f = fixture();
  const quote = await dryRunPayoutQuote({ fetchImpl: f.fetchImpl, dry: false, recipient: 'owner.near' });
  assert.deepEqual(f.calls.map(c => c.url), ['https://1click.chaindefuser.com/v0/tokens', 'https://1click.chaindefuser.com/v0/quote']);
  const call = f.calls[1].options;
  const body = JSON.parse(call.body);
  assert.equal(call.method, 'POST');
  assert.deepEqual(call.headers, { 'Content-Type': 'application/json' });
  assert.equal(body.dry, true);
  assert.equal(body.recipient, 'your-account.near');
  assert.equal(body.refundTo, 'your-account.near');
  assert.equal(body.amount, amount);
  assert.equal(quote.dry, true);
  assert.equal(quote.signed, false);
  assert.equal(quote.executed, false);
  assert.match(quote.pricingNetwork, /separate from NEAR testnet/);
  assert.equal(quote.amountOut, '120000');
  assert.ok(!JSON.stringify(quote).includes('SERVICE_SIGNATURE'));
});

test('dry boundary violations and mismatched pricing fail closed', async () => {
  for (const transform of [
    r => ({ ...r, quote: { ...r.quote, depositAddress: 'MUST_NOT_ESCAPE' } }),
    r => ({ ...r, quote: { ...r.quote, chainDepositAddresses: [] } }),
    r => ({ ...r, quoteRequest: { ...r.quoteRequest, dry: false } }),
    r => ({ ...r, quoteRequest: { ...r.quoteRequest, amount: '1' } }),
    r => ({ ...r, quote: { ...r.quote, amountIn: '1' } }),
    r => ({ ...r, quote: { ...r.quote, amountOut: 'NaN' } }),
  ]) await assert.rejects(dryRunPayoutQuote({ fetchImpl: fixture(transform).fetchImpl }));
});

test('invalid amounts never make a request and remote errors do not echo response data', async () => {
  for (const bad of ['0', '-1', '0.036', 36, '9'.repeat(41)]) {
    await assert.rejects(dryRunPayoutQuote({ amount: bad, fetchImpl: () => assert.fail('No request expected') }), /positive integer/);
  }
  await assert.rejects(dryRunPayoutQuote({ fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ message: 'REMOTE_ECHO' }) }) }), e => !e.message.includes('REMOTE_ECHO'));
  await assert.rejects(dryRunPayoutQuote({ fetchImpl: async () => { throw Error('REMOTE_ECHO'); } }), e => !e.message.includes('REMOTE_ECHO'));
});
