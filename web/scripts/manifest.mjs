#!/usr/bin/env node
// Emit dist/imd-deployment.json after the static export.
//
// Sources, in order: the workflow handoff at .imd/reads/deployment.json and .imd/reads/network.json
// when present (the authoritative inputs), otherwise the identity fields of the existing
// dist/imd-deployment.json (so assets can be re-hashed after a rebuild without the handoff).
// ABIs are verified against the handoff's canonical keccak hash before being referenced.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { keccak_256 } from '@noble/hashes/sha3';

const web = resolve(new URL('..', import.meta.url).pathname);
const root = resolve(web, '..');
const dist = resolve(root, 'dist');
const handoffPath = resolve(root, '.imd/reads/deployment.json');
const networkPath = resolve(root, '.imd/reads/network.json');
const manifestPath = resolve(dist, 'imd-deployment.json');

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
const keccakHex = (text) => Buffer.from(keccak_256(Buffer.from(text, 'utf8'))).toString('hex');
const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');

if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('dist/index.html missing: run the build first');
  process.exit(1);
}

let identity;
let network = null;
let walletAddChain = null;
if (existsSync(handoffPath)) {
  const h = JSON.parse(readFileSync(handoffPath, 'utf8'));
  identity = {
    launchId: h.launchId,
    chainId: h.chainId,
    sourceCommit: h.sourceCommit,
    attestationHash: h.attestationHash,
    contracts: h.contracts.map((c) => ({ name: c.name, address: c.address, abiHash: c.abiHash, blockNumber: c.blockNumber })),
    poolKey: h.poolKey
      ? { currency0: h.poolKey.currency0, currency1: h.poolKey.currency1, fee: h.poolKey.fee, tickSpacing: h.poolKey.tickSpacing, hooks: h.poolKey.hooks }
      : undefined,
  };
  if (existsSync(networkPath)) {
    const n = JSON.parse(readFileSync(networkPath, 'utf8'));
    network = n.network ?? null;
    walletAddChain = n.walletAddChain ?? null;
  }
  console.log('Identity taken from the workflow handoff');
} else if (existsSync(manifestPath)) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  identity = {
    launchId: m.launchId,
    chainId: m.chainId,
    sourceCommit: m.sourceCommit,
    attestationHash: m.attestationHash,
    contracts: m.contracts.map((c) => ({ name: c.name, address: c.address, abiHash: c.abiHash, blockNumber: c.blockNumber })),
    poolKey: m.poolKey,
  };
  network = m.network ?? null;
  walletAddChain = m.walletAddChain ?? null;
  console.log('Handoff absent: identity re-used from the committed dist/imd-deployment.json');
} else {
  console.error('Neither .imd/reads/deployment.json nor dist/imd-deployment.json exists');
  process.exit(1);
}

// Verify and reference each handoff ABI.
const contracts = identity.contracts.map((c) => {
  const abiPath = `abi/${c.name}.json`;
  const file = resolve(dist, abiPath);
  if (!existsSync(file)) {
    console.error(`ABI missing in export: ${abiPath}`);
    process.exit(1);
  }
  const abi = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(abi)) {
    console.error(`ABI at ${abiPath} is not an array`);
    process.exit(1);
  }
  const hash = keccakHex(canonical(abi));
  if (hash !== c.abiHash) {
    console.error(`ABI hash mismatch for ${c.name}: export ${hash}, handoff ${c.abiHash}`);
    process.exit(1);
  }
  const entry = { name: c.name, address: c.address, abiHash: c.abiHash, abiPath };
  if (Number.isInteger(c.blockNumber)) entry.blockNumber = c.blockNumber;
  return entry;
});

// Enumerate every exported file except the manifest itself.
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const files = walk(dist)
  .map((f) => relative(dist, f).split(sep).join('/'))
  .filter((p) => p !== 'imd-deployment.json')
  .sort();
const assets = files.map((path) => {
  const buf = readFileSync(resolve(dist, path));
  if (buf.length > 8 * 1024 * 1024) {
    console.error(`${path} exceeds 8 MiB`);
    process.exit(1);
  }
  return { path, sha256: sha256Hex(buf) };
});
if (assets.length > 128) {
  console.error(`Too many assets: ${assets.length} > 128`);
  process.exit(1);
}
if (!assets.some((a) => a.path === 'index.html')) {
  console.error('index.html missing from assets');
  process.exit(1);
}

const manifest = {
  version: 1,
  launchId: identity.launchId,
  chainId: identity.chainId,
  sourceCommit: identity.sourceCommit,
  attestationHash: identity.attestationHash,
  contracts,
  assets,
};
if (identity.poolKey) manifest.poolKey = identity.poolKey;
if (network) manifest.network = network;
if (walletAddChain) manifest.walletAddChain = walletAddChain;

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const total = assets.reduce((n, a) => n + statSync(resolve(dist, a.path)).size, 0);
console.log(`Wrote dist/imd-deployment.json: ${contracts.length} contracts, ${assets.length} assets, ${(total / 1024).toFixed(1)} KiB`);
