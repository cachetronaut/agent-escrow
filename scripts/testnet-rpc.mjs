// First-party RPC adapter. One delayed retry for HTTP 429 reads; signed sends never retry.
import { base58, signedTransaction } from './near-transaction.mjs';

const endpoint = 'https://rpc.testnet.near.org';
export function requireTestnetId(id) {
  if (typeof id !== 'string' || id.length > 64 || !/^[a-z0-9]+(?:[-_.][a-z0-9]+)*\.testnet$/.test(id)) throw Error('Named testnet account required');
  return id;
}

export class TestnetRpc {
  constructor(transport = globalThis.fetch, rpcEndpoint = endpoint) { if(![endpoint,'https://rpc.testnet.fastnear.com'].includes(rpcEndpoint))throw Error('Unapproved testnet RPC endpoint'); this.transport = transport; this.endpoint=rpcEndpoint; }
  async request(method, params) {
    const options = {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'agent-escrow', method, params }),
    };
    let response = await this.transport(this.endpoint, options);
    if(response.status===429&&['status','query','tx'].includes(method)){await response.body?.cancel();await new Promise(r=>setTimeout(r,60000));response=await this.transport(this.endpoint,{...options,signal:AbortSignal.timeout(30000)});}
    if (!response.ok) throw Error(`Testnet RPC HTTP ${response.status}`);
    const body = await response.json();
    // Never print remote errors: they may echo signed bytes or public keys.
    if (body.error || !Object.hasOwn(body, 'result')) throw Error('Testnet RPC rejected request; reconcile state before retrying');
    return body.result;
  }
  async preflight() {
    const status = await this.request('status', []);
    if (status.chain_id !== 'testnet') throw Error('RPC chain is not testnet');
    return status;
  }
  async account(id) {
    return this.request('query', { request_type: 'view_account', finality: 'final', account_id: requireTestnetId(id) });
  }
  async view(contract, method, args = {}) {
    const result = await this.request('query', { request_type: 'call_function', finality: 'final', account_id: requireTestnetId(contract), method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
    return JSON.parse(Buffer.from(result.result).toString('utf8'));
  }
  async send({ signer, receiver, key, actions }) {
    requireTestnetId(signer); requireTestnetId(receiver);
    await this.preflight();
    const access = await this.request('query', { request_type: 'view_access_key', finality: 'final', account_id: signer, public_key: `ed25519:${base58(key.publicBytes)}` });
    if (!Number.isSafeInteger(access.nonce) || access.nonce < 0) throw Error('Unsafe RPC nonce');
    const signed = signedTransaction({ signer, receiver, key, actions, nonce: BigInt(access.nonce) + 1n, blockHash: access.block_hash });
    // A network timeout after this point is an unknown outcome, never permission to resend.
    let outcome;
    try { outcome = await this.request('broadcast_tx_commit', [signed.bytes.toString('base64')]); }
    catch { throw Error(`Transaction outcome unknown; reconcile testnet transaction ${signed.hash} before retrying`); }
    return transactionEvidence(signed.hash, outcome);
  }
}

export function transactionEvidence(hash, outcome) {
  if (outcome.transaction_outcome?.id !== hash) throw Error('Transaction evidence hash mismatch');
  const rows = [outcome.transaction_outcome, ...(outcome.receipts_outcome || [])];
  const receipts = rows.map(row => {
    const item = row.outcome;
    if (!item || !Number.isSafeInteger(item.gas_burnt) || item.gas_burnt < 0) throw Error('Invalid transaction evidence');
    return {
      id: row.id, block_hash: row.block_hash, executor_id: requireTestnetId(item.executor_id),
      gas_burnt: String(item.gas_burnt),
      status: Object.hasOwn(item.status, 'Failure') ? 'failure' : Object.hasOwn(item.status, 'SuccessValue') ? 'success' : 'receipt_pending',
      // Only this contract's constrained event vocabulary reaches the evidence file.
      events: (item.logs || []).filter(line => /^EVENT_JSON:/.test(line)).flatMap(line => {
        try {
          const event = JSON.parse(line.slice(11));
          if (event.standard !== 'agent_escrow' || event.version !== '1.0.0' || !['created', 'posted', 'bid', 'escrowed', 'cancelled', 'delivered', 'approved', 'expired', 'transfer_started', 'transfer_succeeded', 'transfer_failed', 'claimed', 'claim_resolved', 'fix_delivered'].includes(event.event)) return [];
          if (!Array.isArray(event.data) || event.data.length !== 1 || !/^\d+$/.test(event.data[0].task_id)) return [];
          return [{ event: event.event, task_id: event.data[0].task_id }];
        } catch { return []; }
      }),
    };
  });
  const success = Object.hasOwn(outcome.status || {}, 'SuccessValue');
  return { transaction_hash: hash, status: success ? 'success' : Object.hasOwn(outcome.status || {}, 'Failure') ? 'failure' : 'unknown', receipts };
}
