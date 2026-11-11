// Run only after the locked source inspection is complete.
// Existing rustup/cargo are used; this script installs nothing and allows no network.
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, symlink, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { existsSync } from 'node:fs';
if (process.env.AGENT_ESCROW_BUILD_REVIEWED !== 'yes') throw Error('Complete the exact locked-source review before building');
const env = {};
for (const key of ['PATH', 'HOME', 'CARGO_HOME', 'RUSTUP_HOME', 'TMPDIR']) if (process.env[key]) env[key] = process.env[key];
env.CARGO_NET_OFFLINE = 'true';
env.CARGO_TARGET_DIR = resolve('contract/target');
env.TMPDIR = resolve('contract/target/build-tmp');
await mkdir(env.TMPDIR, { recursive: true });
const cargoRoot = process.env.CARGO_HOME || `${process.env.HOME}/.cargo`;
for (const name of ['config', 'config.toml']) {
  if (existsSync(`${cargoRoot}/${name}`)) throw Error('Cargo configuration requires separate inspection');
  let dir = resolve('.');
  while (true) {
    if (existsSync(`${dir}/.cargo/${name}`)) throw Error('Ancestor Cargo configuration requires separate inspection');
    const parent = resolve(dir, '..'); if (parent === dir) break; dir = parent;
  }
}
const sources = spawnSync(process.execPath, ['scripts/fingerprint-build-sources.mjs', '--check'], { env, stdio: 'inherit' });
if (sources.status !== 0) throw Error('Inspected source fingerprint check failed');
// Cargo may update cache bookkeeping even offline. Keep that metadata isolated.
const buildCargoHome = resolve('contract/target/cargo-home');
await mkdir(buildCargoHome, { recursive: true });
const registryLink = `${buildCargoHome}/registry`;
try { await symlink(relative(buildCargoHome, `${cargoRoot}/registry`), registryLink); }
catch (e) { if (e.code !== 'EEXIST') throw e; }
if (await realpath(registryLink) !== await realpath(`${cargoRoot}/registry`)) throw Error('Unexpected build registry link');
env.CARGO_HOME = buildCargoHome;
env.CARGO_CACHE_AUTO_CLEAN_FREQUENCY = 'never';
const compiler = spawnSync(`${cargoRoot}/bin/rustc`, ['+stable', '--version'], { env, encoding: 'utf8' });
if (compiler.status !== 0 || compiler.stdout.trim() !== 'rustc 1.95.0 (59807616e 2026-04-14)') throw Error('Inspected compiler identity changed; re-review toolchain');
env.RUSTFLAGS = `--cfg near -C target-cpu=mvp --remap-path-prefix=${resolve('.')}=. --remap-path-prefix=${process.env.HOME}=host`;
const quote = path => JSON.stringify(path);
const rustupRoot = process.env.RUSTUP_HOME || `${process.env.HOME}/.rustup`;
const reads = [resolve('.'), `${cargoRoot}/registry`, `${cargoRoot}/bin`, rustupRoot, '/usr', '/bin', '/sbin', '/System', '/Library/Developer', '/opt/homebrew', '/dev'];
const profile = `(version 1)(allow default)(deny network*)(deny file-write*)(deny file-read* (subpath ${quote(process.env.HOME)}))(allow file-read-metadata)(allow file-read* ${reads.map(path => `(subpath ${quote(path)})`).join(' ')})(allow file-write* (subpath ${quote(env.CARGO_TARGET_DIR)}) (literal "/dev/null"))`;
const result = spawnSync('/usr/bin/sandbox-exec', ['-p', profile, `${cargoRoot}/bin/cargo`, '+stable', 'build', '--offline', '--locked', '--release', '--target', 'wasm32-unknown-unknown', '--manifest-path', 'contract/Cargo.toml'], { env, stdio: 'inherit' });
if (result.status !== 0) { console.error(JSON.stringify({build_exit: result.status, signal: result.signal, spawn_error: result.error?.code})); process.exit(result.status || 1); }
const path = 'contract/target/wasm32-unknown-unknown/release/agent_escrow.wasm';
const bytes = await readFile(path);
const module = await WebAssembly.compile(bytes);
const evidence = { artifact: path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), imports: WebAssembly.Module.imports(module), exports: WebAssembly.Module.exports(module) };
await writeFile('docs/wasm-build.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ artifact: path, bytes: evidence.bytes, sha256: evidence.sha256 }));
