import { describe, expect, it } from 'vitest';
import { decodeAbiParameters, encodeAbiParameters, getAddress } from 'viem';
import { applySlippage, buildExecuteArgs, encodeSwapExactInSingle, inputCurrency, outputCurrency, poolId, V4_ACTIONS, V4_SWAP_COMMAND } from '../src/swap';
import { poolKeyComponents, validateManifest } from '../src/config';
import { isUnknownChainError, switchOrAddChain } from '../src/chain';
import { formatAmount, parseAmount, decodeTokenUri, shortAddress } from '../src/format';
import { describeError } from '../src/errors';
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem';

const key = {
  currency0: getAddress('0x260b97dd95e22e738ac2f1aa52700183ca3923ff'),
  currency1: getAddress('0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7'),
  fee: 12500,
  tickSpacing: 60,
  hooks: getAddress('0x784ff9a3ac5d88a30bfff6f7f2a270161fbe6000'),
};

describe('swap encoding', () => {
  it('encodes V4_SWAP with SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL', () => {
    const plan = { poolKey: key, zeroForOne: false, amountIn: 10n ** 18n, amountOutMinimum: 5n * 10n ** 17n };
    const { commands, inputs, deadline } = buildExecuteArgs(plan, 123n);
    expect(commands).toBe(V4_SWAP_COMMAND);
    expect(deadline).toBe(123n);
    expect(inputs).toHaveLength(1);
    const [actions, params] = decodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], inputs[0]);
    expect(actions).toBe(V4_ACTIONS);
    expect(params).toHaveLength(3);
    // params[0]: five-field ExactInputSingleParams
    const [single] = decodeAbiParameters(
      [{ type: 'tuple', components: [{ name: 'poolKey', type: 'tuple', components: poolKeyComponents }, { name: 'zeroForOne', type: 'bool' }, { name: 'amountIn', type: 'uint128' }, { name: 'amountOutMinimum', type: 'uint128' }, { name: 'hookData', type: 'bytes' }] }],
      params[0],
    );
    expect(single.poolKey).toEqual(key);
    expect(single.zeroForOne).toBe(false);
    expect(single.amountIn).toBe(plan.amountIn);
    expect(single.amountOutMinimum).toBe(plan.amountOutMinimum);
    expect(single.hookData).toBe('0x');
    // params[1]: settle input currency (currency1 when !zeroForOne), params[2]: take output currency
    const [settleCur, settleAmt] = decodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], params[1]);
    expect(settleCur).toBe(key.currency1);
    expect(settleAmt).toBe(plan.amountIn);
    const [takeCur, takeAmt] = decodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], params[2]);
    expect(takeCur).toBe(key.currency0);
    expect(takeAmt).toBe(plan.amountOutMinimum);
  });

  it('uses the six-field tuple when extendedSwapParams is set', () => {
    const encoded = encodeSwapExactInSingle({ poolKey: key, zeroForOne: true, amountIn: 1n, amountOutMinimum: 1n, extendedParams: true });
    const [t] = decodeAbiParameters(
      [{ type: 'tuple', components: [{ name: 'poolKey', type: 'tuple', components: poolKeyComponents }, { name: 'zeroForOne', type: 'bool' }, { name: 'amountIn', type: 'uint128' }, { name: 'amountOutMinimum', type: 'uint128' }, { name: 'sqrtPriceLimitX96', type: 'uint256' }, { name: 'hookData', type: 'bytes' }] }],
      encoded,
    );
    expect(t.sqrtPriceLimitX96).toBe(0n);
    expect(t.hookData).toBe('0x');
    // The 5-field encoding differs in length from the 6-field one.
    expect(encodeSwapExactInSingle({ poolKey: key, zeroForOne: true, amountIn: 1n, amountOutMinimum: 1n }).length).not.toBe(encoded.length);
  });

  it('derives input/output currencies from direction', () => {
    expect(inputCurrency({ poolKey: key, zeroForOne: true })).toBe(key.currency0);
    expect(outputCurrency({ poolKey: key, zeroForOne: true })).toBe(key.currency1);
    expect(inputCurrency({ poolKey: key, zeroForOne: false })).toBe(key.currency1);
  });

  it('applies slippage in basis points and clamps', () => {
    expect(applySlippage(10_000n, 100)).toBe(9_900n);
    expect(applySlippage(10_000n, 0)).toBe(10_000n);
    expect(applySlippage(10_000n, 20_000)).toBe(0n);
  });

  it('computes the v4 pool id as keccak(abi.encode(key))', () => {
    const id = poolId(key);
    expect(id).toMatch(/^0x[0-9a-f]{64}$/);
    expect(encodeAbiParameters([{ type: 'tuple', components: poolKeyComponents }], [key]).length).toBe(2 + 64 * 5);
  });
});

describe('manifest validation', () => {
  const good = {
    version: 1,
    launchId: 'e8286ac5-17d2-438c-bfb3-4c67615a583b',
    chainId: 1,
    sourceCommit: '7170ab40427c84277eb47bf00bff5fd1eb43a143',
    attestationHash: '46fc5321e4fcc18b81a3ddd26e2b73784d8280254c599737f60feb20f576f999',
    contracts: ['LaunchToken', 'SwarmlerActivity', 'Swarmlers', 'SwarmlerHookDeployer'].map((name) => ({ name, address: key.currency0, abiHash: 'a'.repeat(64), abiPath: `abi/${name}.json` })),
    assets: [{ path: 'index.html', sha256: 'b'.repeat(64) }],
    poolKey: key,
    network: { chainId: 1, name: 'Ethereum', testnet: false, rpcUrls: ['https://example.invalid'], explorer: 'https://etherscan.io', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, faucets: [], uniswapV4: { poolManager: key.currency0, universalRouter: key.currency0, quoter: key.currency0, stateView: key.currency0, positionManager: key.currency0, permit2: key.currency0 } },
  };
  it('accepts a well-formed manifest', () => {
    const m = validateManifest(good);
    expect(m.contracts).toHaveLength(4);
    expect(m.poolKey?.fee).toBe(12500);
    expect(m.network?.uniswapV4.permit2).toBe(key.currency0);
  });
  it('rejects a manifest missing a required contract', () => {
    expect(() => validateManifest({ ...good, contracts: good.contracts.slice(1) })).toThrow(/LaunchToken missing/);
  });
  it('rejects parent traversal and URLs in paths', () => {
    expect(() => validateManifest({ ...good, assets: [{ path: '../x', sha256: 'b'.repeat(64) }] })).toThrow(/relative path/);
    expect(() => validateManifest({ ...good, contracts: [{ ...good.contracts[0], abiPath: 'https://x/abi.json' }, ...good.contracts.slice(1)] })).toThrow(/relative path/);
  });
  it('rejects a network block whose chain id disagrees', () => {
    expect(() => validateManifest({ ...good, network: { ...good.network, chainId: 11155111 } })).toThrow(/does not match/);
  });
});

describe('chain switching', () => {
  it('recognises 4902 and message variants', () => {
    expect(isUnknownChainError({ code: 4902 })).toBe(true);
    expect(isUnknownChainError({ message: 'Unrecognized chain ID "0x1". Try adding the chain using wallet_addEthereumChain first.' })).toBe(true);
    expect(isUnknownChainError({ code: 4001 })).toBe(false);
  });
  it('adds the chain after a 4902 and switches again', async () => {
    const calls: string[] = [];
    let switches = 0;
    const provider = {
      request: async ({ method }: { method: string }) => {
        calls.push(method);
        if (method === 'wallet_switchEthereumChain' && switches++ === 0) throw { code: 4902 };
        if (method === 'eth_chainId') return '0x1';
        return null;
      },
    };
    const add = { chainId: '0x1' as const, chainName: 'Ethereum', rpcUrls: ['https://example.invalid'], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://etherscan.io'] };
    await expect(switchOrAddChain(provider as never, 1, add)).resolves.toBe('added-and-switched');
    expect(calls).toEqual(['wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_switchEthereumChain']);
  });
  it('propagates a rejection without adding', async () => {
    const provider = { request: async () => { throw { code: 4001, message: 'User rejected' }; } };
    await expect(switchOrAddChain(provider as never, 1, null)).rejects.toMatchObject({ code: 4001 });
  });
});

describe('formatting', () => {
  it('formats token amounts with decimals and grouping', () => {
    expect(formatAmount(250000000000000000n)).toBe('0.25');
    expect(formatAmount(2500n * 10n ** 18n)).toBe('2,500');
    expect(formatAmount(1n)).toBe('<0.0001');
    expect(formatAmount(0n)).toBe('0');
    expect(formatAmount(undefined)).toBe('…');
  });
  it('parses user input strictly', () => {
    expect(parseAmount('0.25')).toBe(250000000000000000n);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
  it('decodes base64 token URIs', () => {
    const uri = 'data:application/json;base64,' + btoa(JSON.stringify({ name: 'Swarmler #1', image: 'data:image/svg+xml;base64,PHN2Zz4=' }));
    expect(decodeTokenUri(uri)?.name).toBe('Swarmler #1');
    expect(decodeTokenUri('ipfs://x')).toBeNull();
  });
  it('shortens addresses', () => {
    expect(shortAddress(key.currency0)).toBe('0x260B…23FF');
  });
});

describe('error translation', () => {
  it('maps custom errors and wallet rejections to plain sentences', () => {
    const revert = new ContractFunctionRevertedError({ abi: [{ type: 'error', name: 'MintClosed', inputs: [] }], functionName: 'mint', data: '0x' });
    (revert as unknown as { data: { errorName: string } }).data = { errorName: 'MintClosed' };
    const wrapped = new BaseError('fail', { cause: revert });
    expect(describeError(wrapped)).toMatch(/not open yet/);
    expect(describeError(new BaseError('x', { cause: new UserRejectedRequestError(new Error('rejected')) }))).toMatch(/cancelled/);
    expect(describeError({ code: 4001 })).toMatch(/cancelled/);
    expect(describeError(new Error('boom'))).toBe('boom');
  });
});

import { bodyWidth, hue, imageUrl, isValidId, mintedByRarity, nextOfRarity, rarity, RARITY_SUPPLY, sigilBits, svg } from '../src/art';

describe('on-chain art port', () => {
  it('reproduces the tier sizes over all 2,500 IDs', () => {
    const counts = mintedByRarity(2500);
    expect(counts).toEqual(RARITY_SUPPLY);
  });
  it('matches the contract formulas for known IDs', () => {
    expect(rarity(1)).toBe('Common');
    expect(hue(1)).toBe(137);
    expect(bodyWidth(1)).toBe(33);
    expect(sigilBits(1)[0]).toBe(true);
    expect(sigilBits(1).slice(1).every((b) => !b)).toBe(true);
    // Verified byte-for-byte against Swarmlers.tokenURI(1) on chain 1 during validation.
    const s = svg(1, false);
    expect(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#090d19"/><g stroke="hsl(137,80%,65%)" stroke-width="5" fill="none">')).toBe(true);
    expect(s).toContain('<ellipse cx="200" cy="220" rx="33" ry="55" fill="#151d32"/>');
    expect(s).toContain('<circle cx="190" cy="160" r="3"/>');
    expect(s.endsWith('>Common / DORMANT</text></svg>')).toBe(true);
    expect(svg(1, true)).toContain('r="7"');
    expect(svg(1, true).endsWith('>Common / ACTIVE</text></svg>')).toBe(true);
  });
  it('validates IDs and finds the next tier member', () => {
    expect(isValidId(0)).toBe(false);
    expect(isValidId(2500)).toBe(true);
    expect(isValidId(2501)).toBe(false);
    const next = nextOfRarity(26, 'Legendary');
    expect(next).not.toBeNull();
    expect(rarity(next!)).toBe('Legendary');
    for (let id = 26; id < next!; id++) expect(rarity(id)).not.toBe('Legendary');
    expect(nextOfRarity(2501, 'Common')).toBeNull();
  });
  it('emits a data URL the browser can draw', () => {
    expect(imageUrl(7)).toMatch(/^data:image\/svg\+xml;base64,PHN2Zy/);
  });
});

import { validateManifest as vm } from '../src/config';
describe('manifest block numbers', () => {
  it('keeps an integer blockNumber and drops a bad one', () => {
    const base = {
      version: 1, launchId: 'x', chainId: 1, sourceCommit: 'a'.repeat(40), attestationHash: 'b'.repeat(64), assets: [],
      contracts: ['LaunchToken', 'SwarmlerActivity', 'Swarmlers', 'SwarmlerHookDeployer'].map((name, i) => ({ name, address: '0x' + (i + 1).toString().padStart(40, '0'), abiHash: 'c'.repeat(64), abiPath: `abi/${name}.json`, blockNumber: i === 0 ? 26184105 : 'nope' })),
    };
    const m = vm(base);
    expect(m.contracts[0].blockNumber).toBe(26184105);
    expect(m.contracts[1].blockNumber).toBeUndefined();
  });
});
