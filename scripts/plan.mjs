// Emits unsigned, testnet-only call plans. Never reads keys or signs/sends transactions.
import { account, amount, FEE } from '../demo/escrow.mjs';
export function plan(action, args, env, nowNs = BigInt(Date.now()) * 1000000n) {
  if (env.NEAR_NETWORK !== 'testnet') throw Error('NEAR_NETWORK must be testnet');
  const receiver_id = account(env.ESCROW_CONTRACT_ID);
  const signer_id = account(env.NEAR_SIGNER_ID);
  const methods = ['create_task', 'deliver', 'approve', 'expire', 'pay'];
  if (!methods.includes(action)) throw Error('Unsupported action');
  let deposit = '0';
  if (action === 'create_task') {
    account(args.worker); account(args.verifier);
    if (new Set([signer_id, args.worker, args.verifier]).size !== 3) throw Error('Distinct roles required');
    if (typeof args.title !== 'string' || !args.title.trim() || Buffer.byteLength(args.title) > 160 || typeof args.criteria !== 'string' || !args.criteria.trim() || Buffer.byteLength(args.criteria) > 2048) throw Error('Invalid task text');
    const budget = amount(args.budget), deadline = amount(args.deadline_ns);
    if (deadline > (1n << 64n) - 1n || deadline <= nowNs || deadline > nowNs + 30n * 86400n * 10n ** 9n) throw Error('Invalid deadline');
    deposit = String(budget + FEE); amount(deposit);
  } else {
    if (typeof args.task_id !== 'string' || !/^(0|[1-9][0-9]*)$/.test(args.task_id) || BigInt(args.task_id) > (1n << 64n) - 1n) throw Error('Invalid task ID');
    if (action === 'deliver' && (typeof args.evidence_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(args.evidence_sha256))) throw Error('Invalid SHA-256');
  }
  return { network: 'testnet', rpc: 'https://rpc.testnet.near.org', signer_id, receiver_id,
    actions: [{ type: 'FunctionCall', method_name: action, args, gas: '100000000000000', deposit }],
    signed: false, broadcast: false };
}
if (process.argv[1]?.endsWith('/plan.mjs')) {
  try { console.log(JSON.stringify(plan(process.argv[2], JSON.parse(process.argv[3] || '{}'), process.env), null, 2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
