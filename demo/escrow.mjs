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
  post({ client, verifier, title, criteria, budget, deadline_ns }, deposit, now) {
    [client, verifier].forEach(account);
    if (client === verifier) throw Error('Distinct roles required');
    if (typeof title !== 'string' || !title.trim() || new TextEncoder().encode(title).length > 160) throw Error('Invalid title');
    if (typeof criteria !== 'string' || !criteria.trim() || new TextEncoder().encode(criteria).length > 2048) throw Error('Invalid criteria');
    amount(budget); const deadline = amount(deadline_ns);
    if (deposit !== FEE) throw Error('Attach storage fee exactly');
    if (deadline > (1n << 64n) - 1n || deadline <= now || deadline > now + 30n * 86400n * 10n ** 9n) throw Error('Invalid deadline');
    const id = String(this.next++);
    this.tasks.set(id, { client, worker: null, verifier, title, criteria, budget, escrow_amount: '0', bids: [], deadline_ns, status: 'Posted', evidence_sha256: null });
    return id;
  }
  bid(id, caller, offered, now) {
    const t = this.get(id); account(caller);
    if (t.status !== 'Posted' || now >= BigInt(t.deadline_ns) || caller === t.client || caller === t.verifier || t.bids.length >= 8 || t.bids.some(b => b.worker === caller)) throw Error('Bid denied');
    if (amount(offered) > BigInt(t.budget)) throw Error('Bid exceeds budget');
    t.bids.push({worker:caller,amount:offered}); this.tasks.set(id,t);
  }
  escrow(id, caller, worker, deposit, now) {
    const t=this.get(id); const bid=t.bids.find(b=>b.worker===worker);
    if (caller!==t.client || t.status!=='Posted' || now>=BigInt(t.deadline_ns) || !bid || deposit!==BigInt(bid.amount)) throw Error('Escrow denied');
    t.worker=worker;t.escrow_amount=bid.amount;t.status='Open';this.tasks.set(id,t);
  }
  // Offline convenience for the original browser demo, using all three stages.
  create(input, deposit, now) {
    account(input.worker); if(new Set([input.client,input.worker,input.verifier]).size!==3) throw Error('Distinct roles required');
    if(deposit!==amount(input.budget)+FEE || deposit>MAX) throw Error('Attach budget + storage fee exactly');
    const id=this.post(input,FEE,now);this.bid(id,input.worker,input.budget,now);this.escrow(id,input.client,input.worker,BigInt(input.budget),now);return id;
  }
  get(id) { const t = this.tasks.get(id); if (!t) throw Error('Unknown task'); return structuredClone(t); }
  deliver(id, caller, hash, now) {
    const t = this.get(id);
    if (caller !== t.worker || t.status !== 'Open' || now >= BigInt(t.deadline_ns)) throw Error('Delivery denied');
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw Error('Expected lowercase SHA-256');
    t.evidence_sha256 = hash; t.status = 'Delivered'; this.tasks.set(id, t);
  }
  release(id, caller, now) {
    const t = this.get(id);
    if (caller !== t.verifier || t.status !== 'Delivered' || now >= BigInt(t.deadline_ns)) throw Error('Release denied');
    t.status = 'Approved'; this.tasks.set(id, t); return this.pay(id);
  }
  refund(id, now) {
    const t = this.get(id);
    if (!['Posted','Open', 'Delivered'].includes(t.status) || now < BigInt(t.deadline_ns)) throw Error('Refund denied');
    if(t.status==='Posted'){t.status='Cancelled';this.tasks.set(id,t);return null;}
    t.status = 'Refundable'; this.tasks.set(id, t); return this.pay(id);
  }
  // Compatibility only for the existing offline UI.
  approve(...args){return this.release(...args);}
  expire(...args){return this.refund(...args);}
  pay(id) {
    const t = this.get(id);
    if (!['Approved', 'Refundable'].includes(t.status)) throw Error('No payable balance');
    const recipient = t.status === 'Approved' ? t.worker : t.client;
    t.status = t.status === 'Approved' ? 'PayingWorker' : 'Refunding'; this.tasks.set(id, t);
    return { recipient, amount: t.escrow_amount };
  }
  callback(id, ok) {
    const t = this.get(id);
    if (!['PayingWorker', 'Refunding'].includes(t.status)) throw Error('No transfer pending');
    t.status = t.status === 'PayingWorker' ? (ok ? 'Paid' : 'Approved') : (ok ? 'Refunded' : 'Refundable');
    this.tasks.set(id, t);
  }
}
