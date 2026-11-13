// Public indicative pricing only. No signer, deposits, swaps, or execution APIs.
// https://docs.near-intents.org/api-reference/oneclick/request-a-swap-quote
const API = 'https://1click.chaindefuser.com/v0';
const DEFAULT_AMOUNT = '36000000000000000000000'; // 0.036 NEAR equivalent
const USDC = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const integer = value => typeof value === 'string' && /^[0-9]{1,40}$/.test(value);

async function request(fetchImpl, path, options = {}) {
  let response;
  try {
    response = await fetchImpl(`${API}/${path}`, {
      ...options, redirect: 'error', signal: AbortSignal.timeout(20000),
    });
  } catch { throw Error('Intents public quote API unavailable'); }
  if (!response.ok) throw Error(`Intents public quote API HTTP ${response.status}`);
  try { return await response.json(); }
  catch { throw Error('Invalid Intents API JSON'); }
}

export async function dryRunPayoutQuote({ amount = DEFAULT_AMOUNT, fetchImpl = fetch } = {}) {
  if (!integer(amount) || BigInt(amount) <= 0n) throw Error('Quote amount must be a positive integer yoctoNEAR string');
  const tokens = await request(fetchImpl, 'tokens');
  if (!Array.isArray(tokens)) throw Error('Invalid Intents token metadata');
  const origin = tokens.filter(t => t.assetId === 'nep141:wrap.near' && t.blockchain === 'near' && t.decimals === 24);
  const destination = tokens.filter(t => t.assetId === USDC && t.blockchain === 'near' && t.decimals === 6 && t.symbol === 'USDC');
  if (origin.length !== 1 || destination.length !== 1) throw Error('Expected NEAR and USDC assets unavailable');
  const body = {
    dry: true, swapType: 'EXACT_INPUT', slippageTolerance: 100,
    originAsset: origin[0].assetId, destinationAsset: destination[0].assetId,
    depositType: 'ORIGIN_CHAIN', amount,
    // Documentation example address, never an owner's account. Required even for dry quotes.
    refundTo: 'your-account.near', refundType: 'ORIGIN_CHAIN',
    recipient: 'your-account.near', recipientType: 'DESTINATION_CHAIN',
    deadline: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
  };
  const result = await request(fetchImpl, 'quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const q = result?.quote;
  if (!q || q.depositAddress != null || q.chainDepositAddresses != null || q.depositMemo != null) {
    throw Error('Intents response violated dry-run boundary');
  }
  if (result.quoteRequest?.dry !== true || result.quoteRequest.amount !== amount
      || result.quoteRequest.originAsset !== body.originAsset
      || result.quoteRequest.destinationAsset !== body.destinationAsset
      || q.amountIn !== amount || !integer(q.amountOut) || !integer(q.minAmountOut)
      || BigInt(q.minAmountOut) > BigInt(q.amountOut)) throw Error('Intents quote response mismatch');
  // Whitelist numeric quote facts. Never expose an executable payload or deposit address.
  return {
    status: 'quoted', dry: true, signed: false, executed: false,
    pricingNetwork: 'production indicative prices only; separate from NEAR testnet escrow',
    originAsset: body.originAsset, destinationAsset: body.destinationAsset,
    amountIn: amount, amountOut: q.amountOut, minAmountOut: q.minAmountOut,
    destinationDecimals: 6, destinationSymbol: 'USDC',
    observedAt: new Date().toISOString(),
  };
}
