import { createHash } from 'node:crypto';
import { EscrowModel, FEE } from '../demo/escrow.mjs';

export function runDemo({ refund = false, failTransfer = false } = {}) {
  const escrow = new EscrowModel();
  const now = 1_800_000_000_000_000_000n;
  const criteria = { required_keys: ['summary', 'source'], source: 'https://docs.near.org/', max_summary_chars: 140 };
  const request = { client: 'client.testnet', worker: 'worker.testnet', verifier: 'verifier.testnet',
    title: 'Produce a NEAR escrow research brief', criteria: JSON.stringify(criteria),
    budget: '1000000000000000000000000', deadline_ns: String(now + 3600n * 10n ** 9n) };
  const trace = [];
  const record = (actor, action, result) => trace.push({ actor, action, result });
  const id = escrow.create(request, BigInt(request.budget) + FEE, now);
  record(request.client, 'create_task', escrow.get(id));
  if (!refund) {
    // A deterministic worker and named verifier implement the declared JSON contract.
    const artifact = { summary: 'NEAR receipts settle asynchronously. Escrow needs a private callback and retryable payouts.', source: 'https://docs.near.org/' };
    const bytes = JSON.stringify(artifact);
    const hash = createHash('sha256').update(bytes).digest('hex');
    escrow.deliver(id, request.worker, hash, now + 1n);
    record(request.worker, 'deliver', { artifact, evidence_sha256: hash });
    const valid = criteria.required_keys.every(k => typeof artifact[k] === 'string') &&
      artifact.source === criteria.source && artifact.summary.length <= criteria.max_summary_chars &&
      createHash('sha256').update(bytes).digest('hex') === escrow.get(id).evidence_sha256;
    if (!valid) throw Error('Verifier rejected artifact');
    record(request.verifier, 'approve', escrow.approve(id, request.verifier, now + 2n));
  } else {
    record('keeper.testnet', 'expire', escrow.expire(id, BigInt(request.deadline_ns)));
  }
  if (failTransfer) {
    escrow.callback(id, false); record('receipt', 'transfer_failed', escrow.get(id));
    record('keeper.testnet', 'retry', escrow.pay(id));
  }
  escrow.callback(id, true); record('receipt', 'transfer_succeeded', escrow.get(id));
  return { contractVersion: '1.0', componentId: 'FUN-001', requestId: 'demo-0', runId: refund ? 'refund' : 'release',
    status: 'succeeded', mode: 'offline-simulation', network: 'none', result: escrow.get(id), errors: [], trace };
}
if (process.argv[1]?.endsWith('/agents.mjs')) console.log(JSON.stringify(runDemo({ refund: process.argv.includes('--refund'), failTransfer: process.argv.includes('--fail-transfer') }), null, 2));
