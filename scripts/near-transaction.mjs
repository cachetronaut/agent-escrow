// First-party NEAR legacy transaction encoder. No network and no credential persistence.
import { createPrivateKey, createPublicKey, createHash, sign, verify, randomBytes } from 'node:crypto';
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58(bytes) {
  let n = BigInt('0x' + (Buffer.from(bytes).toString('hex') || '0')), s = '';
  while (n) { s = alphabet[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; s = '1' + s; }
  return s;
}
export function unbase58(text) {
  if (typeof text !== 'string' || !text) throw Error('Invalid base58');
  let n = 0n;
  for (const c of text) { const i = alphabet.indexOf(c); if (i < 0) throw Error('Invalid base58'); n = n * 58n + BigInt(i); }
  let hex = n ? n.toString(16) : ''; if (hex.length % 2) hex = '0' + hex;
  return Buffer.concat([Buffer.alloc(text.match(/^1*/)[0].length), Buffer.from(hex, 'hex')]);
}
export const uint = (value, size) => { let n = BigInt(value); if (n < 0n || n >= 1n << BigInt(size * 8)) throw Error('Integer range'); const bytes = Buffer.alloc(size); for (let i = 0; i < size; i++) { bytes[i] = Number(n & 255n); n >>= 8n; } return bytes; };
const blob = bytes => Buffer.concat([uint(bytes.length, 4), bytes]);
const text = value => blob(Buffer.from(value));
export function keyFromEnv(name) {
  const encoded = process.env[name];
  if (!encoded || !/^[a-f0-9]{64}$/.test(encoded)) throw Error('Missing environment signing credential');
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(encoded, 'hex')]), format: 'der', type: 'pkcs8' });
  return { privateKey: key, publicBytes: createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32) };
}
export function generateEnvKey(name) { if (process.env[name]) throw Error('Refusing to overwrite environment credential'); process.env[name] = randomBytes(32).toString('hex'); return keyFromEnv(name); }
export function action(kind, data = {}) {
  if (kind === 'create') return Buffer.from([0]);
  if (kind === 'deploy') return Buffer.concat([Buffer.from([1]), blob(data.code)]);
  if (kind === 'call') return Buffer.concat([Buffer.from([2]), text(data.method), blob(Buffer.from(JSON.stringify(data.args))), uint(data.gas || 100000000000000n, 8), uint(data.deposit || 0n, 16)]);
  if (kind === 'transfer') return Buffer.concat([Buffer.from([3]), uint(data.amount, 16)]);
  if (kind === 'addKey') return Buffer.concat([Buffer.from([5, 0]), data.publicBytes, uint(0, 8), Buffer.from([1])]);
  if (kind === 'delete') return Buffer.concat([Buffer.from([7]), text(data.beneficiary)]);
  throw Error('Unknown action');
}
export function signedTransaction({ signer, receiver, nonce, blockHash, actions, key }) {
  for (const id of [signer, receiver]) if (!/^[a-z0-9]+(?:[-_.][a-z0-9]+)*\.testnet$/.test(id) || id.length > 64) throw Error('Named testnet accounts only');
  const block = unbase58(blockHash); if (block.length !== 32 || key.publicBytes.length !== 32) throw Error('Invalid transaction key/hash');
  const tx = Buffer.concat([text(signer), Buffer.from([0]), key.publicBytes, uint(nonce, 8), text(receiver), block, uint(actions.length, 4), ...actions]);
  const digest = createHash('sha256').update(tx).digest();
  const signature = sign(null, digest, key.privateKey);
  if (!verify(null, digest, createPublicKey(key.privateKey), signature)) throw Error('Signature self-check failed');
  return { bytes: Buffer.concat([tx, Buffer.from([0]), signature]), hash: base58(digest) };
}
