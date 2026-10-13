/**
 * Pure helpers for Uniswap v4 swaps through the Universal Router. No network access here, so the
 * encoding is unit tested in isolation.
 */
import { encodeAbiParameters, keccak256, type Address, type Hex } from 'viem';
import { poolKeyComponents, type PoolKey } from './config';

export const V4_SWAP_COMMAND: Hex = '0x10';
/** SWAP_EXACT_IN_SINGLE (0x06), SETTLE_ALL (0x0c), TAKE_ALL (0x0f). */
export const V4_ACTIONS: Hex = '0x060c0f';

export interface SwapPlan {
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
  /** Six-field ExactInputSingleParams for routers that need it (network.uniswapV4.extendedSwapParams). */
  extendedParams?: boolean;
}

export function inputCurrency(plan: Pick<SwapPlan, 'poolKey' | 'zeroForOne'>): Address {
  return plan.zeroForOne ? plan.poolKey.currency0 : plan.poolKey.currency1;
}

export function outputCurrency(plan: Pick<SwapPlan, 'poolKey' | 'zeroForOne'>): Address {
  return plan.zeroForOne ? plan.poolKey.currency1 : plan.poolKey.currency0;
}

export function encodeSwapExactInSingle(plan: SwapPlan): Hex {
  const base = [
    { name: 'poolKey', type: 'tuple', components: poolKeyComponents },
    { name: 'zeroForOne', type: 'bool' },
    { name: 'amountIn', type: 'uint128' },
    { name: 'amountOutMinimum', type: 'uint128' },
  ] as const;
  if (plan.extendedParams) {
    return encodeAbiParameters(
      [{
        type: 'tuple',
        components: [...base, { name: 'sqrtPriceLimitX96', type: 'uint256' }, { name: 'hookData', type: 'bytes' }],
      }],
      [{ poolKey: plan.poolKey, zeroForOne: plan.zeroForOne, amountIn: plan.amountIn, amountOutMinimum: plan.amountOutMinimum, sqrtPriceLimitX96: 0n, hookData: '0x' }],
    );
  }
  return encodeAbiParameters(
    [{ type: 'tuple', components: [...base, { name: 'hookData', type: 'bytes' }] }],
    [{ poolKey: plan.poolKey, zeroForOne: plan.zeroForOne, amountIn: plan.amountIn, amountOutMinimum: plan.amountOutMinimum, hookData: '0x' }],
  );
}

/** Arguments for `UniversalRouter.execute(bytes commands, bytes[] inputs, uint256 deadline)`. */
export function buildExecuteArgs(plan: SwapPlan, deadline: bigint): { commands: Hex; inputs: Hex[]; deadline: bigint } {
  const params: Hex[] = [
    encodeSwapExactInSingle(plan),
    encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [inputCurrency(plan), plan.amountIn]),
    encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [outputCurrency(plan), plan.amountOutMinimum]),
  ];
  const input = encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], [V4_ACTIONS, params]);
  return { commands: V4_SWAP_COMMAND, inputs: [input], deadline };
}

/** Apply slippage in basis points to a quoted output. */
export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(10_000, Math.round(slippageBps))));
  return (amountOut * (10_000n - bps)) / 10_000n;
}

/** Uniswap v4 PoolId = keccak256(abi.encode(poolKey)). */
export function poolId(key: PoolKey): Hex {
  return keccak256(encodeAbiParameters([{ type: 'tuple', components: poolKeyComponents }], [key]));
}

/** Zero address = native currency in a v4 pool key. */
export function isNative(address: Address): boolean {
  return /^0x0{40}$/i.test(address);
}
