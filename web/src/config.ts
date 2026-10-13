/**
 * Single source of runtime configuration.
 *
 * Deployment addresses, chain id, ABI paths, public RPC URLs and the Uniswap v4 addresses are NOT
 * written in source. They are read at runtime from `./imd-deployment.json` next to index.html, the
 * same manifest the publisher verifies against the attested deployment handoff. This module only
 * defines its shape, loads and validates it, and holds the protocol ABIs and tuning constants that
 * are not deployment specific.
 */
import type { Abi, Address, Hex } from 'viem';
import { getAddress, isAddress } from 'viem';

export interface DeploymentContract {
  name: string;
  address: Address;
  abiHash: string;
  abiPath: string;
}

export interface NetworkBlock {
  chainId: number;
  name: string;
  testnet: boolean;
  rpcUrls: string[];
  explorer: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  faucets: string[];
  uniswapV4: {
    poolManager: Address;
    universalRouter: Address;
    quoter: Address;
    stateView: Address;
    positionManager: Address;
    permit2: Address;
    extendedSwapParams?: boolean;
  };
  pairToken?: { address: Address; symbol: string; name: string; decimals: number };
  otherPairTokens?: { id: string; address: Address; symbol: string; name: string; decimals: number }[];
}

export interface WalletAddChain {
  chainId: Hex;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls: string[];
}

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface DeploymentManifest {
  version: 1;
  launchId: string;
  chainId: number;
  sourceCommit: string;
  attestationHash: string;
  contracts: DeploymentContract[];
  assets: { path: string; sha256: string }[];
  poolKey?: PoolKey;
  network?: NetworkBlock;
  walletAddChain?: WalletAddChain;
}

/** Names the app expects in the handoff's contract set. */
export const CONTRACT_NAMES = ['LaunchToken', 'SwarmlerActivity', 'Swarmlers', 'SwarmlerHookDeployer'] as const;
export type ContractName = (typeof CONTRACT_NAMES)[number];

/**
 * The child fee hook is deployed later by the owner through SwarmlerHookDeployer and is not part of
 * the handoff contract set. Its address is read from `SwarmlerHookDeployer.hook()`; only its ABI
 * is shipped as a static asset.
 */
export const FEE_HOOK_ABI_PATH = 'abi/SwarmlerFeeHook.json';

/** Loaded, validated runtime configuration. */
export interface Deployment {
  manifest: DeploymentManifest;
  contracts: Record<ContractName, { address: Address; abi: Abi }>;
  feeHookAbi: Abi;
  network: NetworkBlock | null;
  walletAddChain: WalletAddChain | null;
  poolKey: PoolKey | null;
}

/** Default slippage for swaps, in basis points. Visitors can change it on the page. */
export const DEFAULT_SLIPPAGE_BPS = 100;
/** Permit2 approval expiry granted by the app: 30 days, in seconds. */
export const PERMIT2_EXPIRATION_SECONDS = 30 * 24 * 60 * 60;
/** Swap deadline, in seconds from now. */
export const SWAP_DEADLINE_SECONDS = 20 * 60;
/** Poll interval for on-chain reads once the page is open, in milliseconds. */
export const POLL_INTERVAL_MS = 12_000;
/** How many Swarmlers the gallery shows at once. */
export const GALLERY_SIZE = 6;
/**
 * Optional WalletConnect project id. Not supplied for this build, so only browser (injected,
 * EIP-6963) wallets are offered. Set VITE_WALLETCONNECT_PROJECT_ID at build time to document
 * the value; wiring a WalletConnect connector is a build-time opt in described in the README.
 */
export const WALLETCONNECT_PROJECT_ID: string | undefined = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

function resolveRelative(path: string): string {
  // Resolve against the document so the site works from a gateway subpath or an ENS name.
  return new URL(path, document.baseURI).toString();
}

function assertAddress(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) {
    throw new Error(`Deployment manifest: ${label} is not an address`);
  }
  return getAddress(value);
}

function assertRelativePath(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.startsWith('/') || value.includes('..') || /^[a-z]+:/i.test(value)) {
    throw new Error(`Deployment manifest: ${label} must be a relative path`);
  }
  return value;
}

export function validateManifest(raw: unknown): DeploymentManifest {
  if (!raw || typeof raw !== 'object') throw new Error('Deployment manifest is not an object');
  const m = raw as Record<string, unknown>;
  if (m.version !== 1) throw new Error('Deployment manifest: unsupported version');
  if (typeof m.launchId !== 'string' || !m.launchId) throw new Error('Deployment manifest: launchId missing');
  if (typeof m.chainId !== 'number' || !Number.isInteger(m.chainId) || m.chainId <= 0) {
    throw new Error('Deployment manifest: chainId missing');
  }
  if (typeof m.sourceCommit !== 'string' || !/^[0-9a-f]{40}$/.test(m.sourceCommit)) {
    throw new Error('Deployment manifest: sourceCommit missing');
  }
  if (typeof m.attestationHash !== 'string' || !/^[0-9a-f]{64}$/.test(m.attestationHash)) {
    throw new Error('Deployment manifest: attestationHash missing');
  }
  if (!Array.isArray(m.contracts) || m.contracts.length === 0) throw new Error('Deployment manifest: contracts missing');
  const contracts: DeploymentContract[] = m.contracts.map((c, i) => {
    const entry = c as Record<string, unknown>;
    if (typeof entry.name !== 'string') throw new Error(`Deployment manifest: contracts[${i}].name missing`);
    if (typeof entry.abiHash !== 'string' || !/^[0-9a-f]{64}$/.test(entry.abiHash)) {
      throw new Error(`Deployment manifest: ${entry.name} abiHash invalid`);
    }
    return {
      name: entry.name,
      address: assertAddress(entry.address, `${entry.name} address`),
      abiHash: entry.abiHash,
      abiPath: assertRelativePath(entry.abiPath, `${entry.name} abiPath`),
    };
  });
  for (const name of CONTRACT_NAMES) {
    if (!contracts.some((c) => c.name === name)) throw new Error(`Deployment manifest: contract ${name} missing`);
  }
  if (!Array.isArray(m.assets)) throw new Error('Deployment manifest: assets missing');
  const assets = m.assets.map((a, i) => {
    const entry = a as Record<string, unknown>;
    if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
      throw new Error(`Deployment manifest: assets[${i}].sha256 invalid`);
    }
    return { path: assertRelativePath(entry.path, `assets[${i}].path`), sha256: entry.sha256 };
  });

  let poolKey: PoolKey | undefined;
  if (m.poolKey !== undefined) {
    const k = m.poolKey as Record<string, unknown>;
    if (typeof k.fee !== 'number' || typeof k.tickSpacing !== 'number') throw new Error('Deployment manifest: poolKey invalid');
    poolKey = {
      currency0: assertAddress(k.currency0, 'poolKey.currency0'),
      currency1: assertAddress(k.currency1, 'poolKey.currency1'),
      fee: k.fee,
      tickSpacing: k.tickSpacing,
      hooks: assertAddress(k.hooks, 'poolKey.hooks'),
    };
  }

  let network: NetworkBlock | undefined;
  if (m.network !== undefined) {
    const n = m.network as Record<string, unknown>;
    if (typeof n.chainId !== 'number' || n.chainId !== m.chainId) {
      throw new Error('Deployment manifest: network.chainId does not match chainId');
    }
    if (!Array.isArray(n.rpcUrls) || n.rpcUrls.length === 0) throw new Error('Deployment manifest: network.rpcUrls missing');
    const u = n.uniswapV4 as Record<string, unknown> | undefined;
    if (!u) throw new Error('Deployment manifest: network.uniswapV4 missing');
    network = {
      ...(n as unknown as NetworkBlock),
      uniswapV4: {
        ...(u as unknown as NetworkBlock['uniswapV4']),
        poolManager: assertAddress(u.poolManager, 'uniswapV4.poolManager'),
        universalRouter: assertAddress(u.universalRouter, 'uniswapV4.universalRouter'),
        quoter: assertAddress(u.quoter, 'uniswapV4.quoter'),
        stateView: assertAddress(u.stateView, 'uniswapV4.stateView'),
        positionManager: assertAddress(u.positionManager, 'uniswapV4.positionManager'),
        permit2: assertAddress(u.permit2, 'uniswapV4.permit2'),
      },
    };
  }

  return {
    version: 1,
    launchId: m.launchId,
    chainId: m.chainId,
    sourceCommit: m.sourceCommit,
    attestationHash: m.attestationHash,
    contracts,
    assets,
    poolKey,
    network,
    walletAddChain: m.walletAddChain as WalletAddChain | undefined,
  };
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(resolveRelative(path), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Unable to load ${path} (${res.status})`);
  return res.json();
}

/** Load `./imd-deployment.json` and every ABI it references. */
export async function loadDeployment(): Promise<Deployment> {
  const manifest = validateManifest(await fetchJson('imd-deployment.json'));
  const abis = await Promise.all(
    manifest.contracts.map(async (c) => {
      const abi = await fetchJson(c.abiPath);
      if (!Array.isArray(abi)) throw new Error(`ABI at ${c.abiPath} is not a JSON array`);
      return [c.name, { address: c.address, abi: abi as Abi }] as const;
    }),
  );
  const feeHookAbi = (await fetchJson(FEE_HOOK_ABI_PATH)) as Abi;
  const byName = Object.fromEntries(abis) as Record<string, { address: Address; abi: Abi }>;
  const contracts = Object.fromEntries(CONTRACT_NAMES.map((n) => [n, byName[n]])) as Deployment['contracts'];
  return {
    manifest,
    contracts,
    feeHookAbi,
    network: manifest.network ?? null,
    walletAddChain: manifest.walletAddChain ?? null,
    poolKey: manifest.poolKey ?? null,
  };
}

/* ---------- Protocol ABIs (Uniswap v4 periphery, Permit2, ERC-20). Not deployment specific. ---------- */

export const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'v', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const satisfies Abi;

export const permit2Abi = [
  {
    type: 'function', name: 'allowance', stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }, { name: 'token', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }],
  },
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }],
    outputs: [],
  },
] as const satisfies Abi;

const poolKeyComponents = [
  { name: 'currency0', type: 'address' },
  { name: 'currency1', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'tickSpacing', type: 'int24' },
  { name: 'hooks', type: 'address' },
] as const;

export const quoterAbi = [
  {
    type: 'function', name: 'quoteExactInputSingle', stateMutability: 'nonpayable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'poolKey', type: 'tuple', components: poolKeyComponents },
        { name: 'zeroForOne', type: 'bool' },
        { name: 'exactAmount', type: 'uint128' },
        { name: 'hookData', type: 'bytes' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }],
  },
] as const satisfies Abi;

export const universalRouterAbi = [
  {
    type: 'function', name: 'execute', stateMutability: 'payable',
    inputs: [{ name: 'commands', type: 'bytes' }, { name: 'inputs', type: 'bytes[]' }, { name: 'deadline', type: 'uint256' }],
    outputs: [],
  },
] as const satisfies Abi;

export const stateViewAbi = [
  {
    type: 'function', name: 'getSlot0', stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' }, { name: 'protocolFee', type: 'uint24' }, { name: 'lpFee', type: 'uint24' }],
  },
  {
    type: 'function', name: 'getLiquidity', stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
] as const satisfies Abi;

export { poolKeyComponents };
