// Read-only source fingerprinting. Hashes are evidence of identity, not safety approval.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const inventory = JSON.parse(await readFile('docs/build-inventory.json', 'utf8'));
const checkOnly = process.argv.includes('--check');
const cargoRoot = process.env.CARGO_HOME || join(process.env.HOME, '.cargo');
const registries = await readdir(join(cargoRoot, 'registry', 'src'));
async function files(dir, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw Error('Unexpected source symlink');
    if (entry.isDirectory()) result.push(...await files(dir, path));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}
for (const pkg of inventory.packages) {
  if (pkg.name === 'agent-escrow') continue;
  const roots = registries.map(registry => join(cargoRoot, 'registry', 'src', registry, `${pkg.name}-${pkg.version}`));
  let root;
  for (const candidate of roots) { try { await readdir(candidate); if (root) throw Error('Ambiguous source registry'); root = candidate; } catch (e) { if (e.code !== 'ENOENT') throw e; } }
  if (!root) throw Error(`Missing locked source ${pkg.name}-${pkg.version}`);
  const paths = await files(root);
  const hash = createHash('sha256');
  for (const path of paths) { hash.update(path); hash.update('\0'); hash.update(await readFile(join(root, path))); hash.update('\0'); }
  const fingerprint = { algorithm: 'sha256-path-nul-content-nul-sorted', sha256: hash.digest('hex'), files: paths.length };
  if (checkOnly && JSON.stringify(fingerprint) !== JSON.stringify(pkg.source_fingerprint)) throw Error(`Inspected source changed: ${pkg.name}-${pkg.version}`);
  if (!checkOnly) pkg.source_fingerprint = fingerprint;
}
if (!checkOnly) await writeFile('docs/build-inventory.json', JSON.stringify(inventory, null, 2) + '\n');
console.log(`${checkOnly ? 'Verified' : 'Fingerprinted'} ${inventory.packages.length - 1} dependency source trees; no package code executed.`);
