// Read-only testnet RPC client. No keys, signing, configurable endpoint, or broadcast.
import { account } from '../demo/escrow.mjs';
const RPC = 'https://rpc.testnet.near.org';
export async function readTask(contract, taskId, fetcher = fetch) {
  let sequence = 0;
  async function rpc(method, params) {
    const response = await fetcher(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method, params }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error('Testnet RPC HTTP failure');
    const body = await response.json();
    if (body.error || !body.result) throw Error('Testnet RPC rejected request');
    return body.result;
  }
  const status = await rpc('status', []);
  if (status.chain_id !== 'testnet') throw Error('RPC chain is not testnet');
  if (contract === undefined) return { network: 'testnet', chain_id: status.chain_id, read_only: true };
  account(contract);
  if (typeof taskId !== 'string' || !/^(0|[1-9][0-9]*)$/.test(taskId) || BigInt(taskId) > (1n << 64n) - 1n) throw Error('Invalid task ID');
  const view = await rpc('query', { request_type: 'call_function', finality: 'final', account_id: contract,
    method_name: 'get_task', args_base64: Buffer.from(JSON.stringify({ task_id: taskId })).toString('base64') });
  if (!Array.isArray(view.result) || view.result.length > 16384 || !view.result.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) throw Error('Invalid RPC view bytes');
  return { network: 'testnet', read_only: true, contract, task_id: taskId, block_hash: view.block_hash,
    block_height: view.block_height, task: JSON.parse(Buffer.from(view.result).toString('utf8')) };
}
if (process.argv[1]?.endsWith('/read-task.mjs')) {
  try { console.log(JSON.stringify(await readTask(process.argv[2], process.argv[3]), null, 2)); }
  catch { console.error('Read failed. Check testnet connectivity and account/task IDs. No transaction was sent.'); process.exitCode = 1; }
}
