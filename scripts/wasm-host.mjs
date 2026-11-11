// First-party in-memory NEAR host for executing this contract's real Wasm ABI.
// No node init, network, account credentials, transaction signing, or persistent state.
// This is not nearcore: gas is supplied by tests and storage overhead is approximate.
import { readFile } from 'node:fs/promises';

const artifact = new URL('../contract/target/wasm32-unknown-unknown/release/agent_escrow.wasm', import.meta.url);
const U64_MAX = (1n << 64n) - 1n;
const utf8 = new TextDecoder('utf-8', { fatal: true });
const namedTestnet = id => typeof id === 'string' && /^[a-z0-9]+(?:[-_.][a-z0-9]+)*\.testnet$/.test(id) && id.length <= 64;
const registerId = id => BigInt.asUintN(64, id);

export class WasmHost {
  static async load(options) { return new WasmHost(await WebAssembly.compile(await readFile(artifact)), options); }
  constructor(module, { contract = 'contract.testnet' } = {}) {
    if (!namedTestnet(contract)) throw Error('In-memory host requires named testnet contract');
    this.module = module;
    this.contract = contract;
    this.storage = new Map();
    for (const item of WebAssembly.Module.imports(module)) {
      if (item.module !== 'env' || item.kind !== 'function') throw Error('Unexpected Wasm import');
    }
  }
  storageUsage() {
    let bytes = 0n;
    for (const [key, value] of this.storage) bytes += BigInt(key.length / 2 + value.length + 40);
    return bytes;
  }
  call(method, args = {}, { caller = 'client.testnet', deposit = 0n, now = 1000n,
    prepaidGas = 100_000_000_000_000n, usedGas = 0n, results = [] } = {}) {
    if (!namedTestnet(caller)) throw Error('In-memory host requires named testnet caller');
    const snapshot = new Map(this.storage);
    const registers = new Map(), promises = [], logs = [];
    let instance, output, returnedPromise;
    const memory = () => new Uint8Array(instance.exports.memory.buffer);
    const index = value => {
      const number = Number(value);
      if (!Number.isSafeInteger(number) || number < 0) throw Error('Invalid Wasm memory index');
      return number;
    };
    const bytes = (ptr, len) => {
      const start = index(ptr), length = index(len), m = memory();
      if (start + length > m.length) throw Error('Wasm memory read outside bounds');
      return Buffer.from(m.slice(start, start + length));
    };
    const write = (ptr, data) => {
      const start = index(ptr), m = memory();
      if (start + data.length > m.length) throw Error('Wasm memory write outside bounds');
      m.set(data, start);
    };
    const putRegister = (id, value) => registers.set(registerId(id), Buffer.from(value));
    const text = (ptr, len) => utf8.decode(bytes(ptr, len));
    const keyAt = (ptr, len) => bytes(ptr, len).toString('hex');
    const readU128 = ptr => {
      const b = bytes(ptr, 16); return b.readBigUInt64LE(0) + (b.readBigUInt64LE(8) << 64n);
    };
    const uint128 = value => {
      const n = BigInt(value); if (n < 0 || n >= 1n << 128n) throw Error('Invalid host deposit');
      const b = Buffer.alloc(16); b.writeBigUInt64LE(n & U64_MAX); b.writeBigUInt64LE(n >> 64n, 8); return b;
    };
    const createPromise = (receiver, after = null) => {
      if (!namedTestnet(receiver)) throw Error('In-memory host refuses non-testnet promise');
      promises.push({ receiver, after, actions: [] }); return BigInt(promises.length - 1);
    };
    const promise = id => {
      const item = promises[index(id)]; if (!item) throw Error('Unknown in-memory promise'); return item;
    };
    const functionCall = (id, methodLen, methodPtr, argLen, argPtr, amountPtr, gas, weight = 0n) => {
      promise(id).actions.push({ type: 'call', method: text(methodPtr, methodLen),
        args: JSON.parse(text(argPtr, argLen)), deposit: String(readU128(amountPtr)), gas: String(gas), weight: String(weight) });
    };
    const env = {
      input: id => putRegister(id, Buffer.from(JSON.stringify(args))),
      current_account_id: id => putRegister(id, Buffer.from(this.contract)),
      predecessor_account_id: id => putRegister(id, Buffer.from(caller)),
      block_timestamp: () => BigInt(now),
      attached_deposit: ptr => write(ptr, uint128(deposit)),
      prepaid_gas: () => BigInt(prepaidGas),
      used_gas: () => BigInt(usedGas),
      storage_usage: () => this.storageUsage(),
      register_len: id => BigInt(registers.get(registerId(id))?.length ?? U64_MAX),
      read_register: (id, ptr) => {
        const value = registers.get(registerId(id)); if (!value) throw Error('Read from absent register'); write(ptr, value);
      },
      storage_has_key: (len, ptr) => this.storage.has(keyAt(ptr, len)) ? 1n : 0n,
      storage_read: (len, ptr, id) => {
        const value = this.storage.get(keyAt(ptr, len));
        if (!value) return 0n; putRegister(id, value); return 1n;
      },
      storage_write: (keyLen, keyPtr, valLen, valPtr, id) => {
        const key = keyAt(keyPtr, keyLen), previous = this.storage.get(key);
        this.storage.set(key, bytes(valPtr, valLen));
        if (previous) { putRegister(id, previous); return 1n; }
        return 0n;
      },
      storage_remove: (len, ptr, id) => {
        const key = keyAt(ptr, len), previous = this.storage.get(key);
        if (!previous) return 0n; this.storage.delete(key); putRegister(id, previous); return 1n;
      },
      value_return: (len, ptr) => { output = bytes(ptr, len); },
      panic_utf8: (len, ptr) => { throw Error(text(ptr, len)); },
      log_utf8: (len, ptr) => { logs.push(text(ptr, len)); },
      promise_batch_create: (len, ptr) => createPromise(text(ptr, len)),
      promise_batch_then: (after, len, ptr) => { promise(after); return createPromise(text(ptr, len), Number(after)); },
      promise_batch_action_transfer: (id, ptr) => { promise(id).actions.push({ type: 'transfer', amount: String(readU128(ptr)) }); },
      promise_batch_action_function_call: functionCall,
      promise_batch_action_function_call_weight: functionCall,
      promise_return: id => { promise(id); returnedPromise = Number(id); },
      promise_results_count: () => BigInt(results.length),
      promise_result: (at, id) => {
        const item = results[index(at)];
        if (item === undefined) throw Error('Unknown promise result');
        if (item === false) return 2n;
        putRegister(id, item === true ? Buffer.alloc(0) : Buffer.from(item)); return 1n;
      },
    };
    // Unused imported capabilities fail closed if a future code path reaches them.
    for (const item of WebAssembly.Module.imports(this.module)) {
      if (!Object.hasOwn(env, item.name)) env[item.name] = () => { throw Error(`Unsupported Wasm host import: ${item.name}`); };
    }
    try {
      instance = new WebAssembly.Instance(this.module, { env });
      if (typeof instance.exports[method] !== 'function') throw Error(`Missing Wasm method: ${method}`);
      instance.exports[method]();
      return { result: output?.length ? JSON.parse(utf8.decode(output)) : undefined,
        promises, logs, returnedPromise, storageUsage: String(this.storageUsage()) };
    } catch (error) {
      this.storage = snapshot;
      throw error;
    }
  }
}
