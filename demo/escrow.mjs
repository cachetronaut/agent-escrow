// Offline reference model. It does not execute NEAR transactions.
export const FEE = 10n ** 23n;
const MAX = (1n << 128n) - 1n;
export function account(id) {
  if (typeof id !== 'string' || id.length < 2 || id.length > 64 ||
      !/^[a-z0-9]+(?:[-_][a-z0-9]+|\.[a-z0-9]+)*\.testnet$/.test(id)) throw Error('Named testnet account required');
  return id;
}
export function amount(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) throw Error('Positive decimal string required');
  const n = BigInt(value);
  if (n > MAX) throw Error('Amount overflow');
  return n;
}
export class EscrowModel {
  constructor() { this.tasks = new Map(); this.next = 0; }
  create({ client, worker, verifier, title, criteria, budget, deadline_ns }, deposit, now) {
    [client, worker, verifier].forEach(account);
    if (new Set([client, worker, verifier]).size !== 3) throw Error('Distinct roles required');
    if (typeof title !== 'string' || !title.trim() || new TextEncoder().encode(title).length > 160) throw Error('Invalid title');
    if (typeof criteria !== 'string' || !criteria.trim() || new TextEncoder().encode(criteria).length > 2048) throw Error('Invalid criteria');
    const n = amount(budget), deadline = amount(deadline_ns);
    if (n + FEE > MAX || deposit !== n + FEE) throw Error('Attach budget + storage fee exactly');
    if (deadline > (1n << 64n) - 1n || deadline <= now || deadline > now + 30n * 86400n * 10n ** 9n) throw Error('Invalid deadline');
    const id = String(this.next++);
    this.tasks.set(id, { client, worker, verifier, title, criteria, budget, deadline_ns, status: 'Open', evidence_sha256: null });
    return id;
  }
  get(id) { const t = this.tasks.get(id); if (!t) throw Error('Unknown task'); return structuredClone(t); }
  deliver(id, caller, hash, now) {
    const t = this.get(id);
    if (caller !== t.worker || t.status !== 'Open' || now >= BigInt(t.deadline_ns)) throw Error('Delivery denied');
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw Error('Expected lowercase SHA-256');
    t.evidence_sha256 = hash; t.status = 'Delivered'; this.tasks.set(id, t);
  }
  approve(id, caller, now) {
    const t = this.get(id);
    if (caller !== t.verifier || t.status !== 'Delivered' || now >= BigInt(t.deadline_ns)) throw Error('Approval denied');
    t.status = 'Approved'; this.tasks.set(id, t); return this.pay(id);
  }
  expire(id, now) {
    const t = this.get(id);
    if (!['Open', 'Delivered'].includes(t.status) || now < BigInt(t.deadline_ns)) throw Error('Expiry denied');
    t.status = 'Refundable'; this.tasks.set(id, t); return this.pay(id);
  }
  pay(id) {
    const t = this.get(id);
    if (!['Approved', 'Refundable'].includes(t.status)) throw Error('No payable balance');
    const recipient = t.status === 'Approved' ? t.worker : t.client;
    t.status = t.status === 'Approved' ? 'PayingWorker' : 'Refunding'; this.tasks.set(id, t);
    return { recipient, amount: t.budget };
  }
  // Local simulation of a private NEAR receipt callback, never a public agent action.
  callback(id, ok) {
    const t = this.get(id);
    if (!['PayingWorker', 'Refunding'].includes(t.status)) throw Error('No transfer pending');
    t.status = t.status === 'PayingWorker' ? (ok ? 'Paid' : 'Approved') : (ok ? 'Refunded' : 'Refundable');
    this.tasks.set(id, t);
  }
}
