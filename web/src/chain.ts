/** Wallet chain switching: switch first, offer wallet_addEthereumChain when the wallet lacks the chain. */
import { numberToHex, type EIP1193Provider } from 'viem';
import type { WalletAddChain } from './config';

interface RpcErrorLike { code?: number; data?: { originalError?: { code?: number } }; message?: string }

export function isUnknownChainError(error: unknown): boolean {
  const e = error as RpcErrorLike | undefined;
  const code = e?.code ?? e?.data?.originalError?.code;
  if (code === 4902) return true;
  const msg = (e?.message ?? '').toLowerCase();
  return msg.includes('unrecognized chain') || msg.includes('unknown chain') || msg.includes('not been added') || msg.includes('try adding the chain');
}

export type SwitchOutcome = 'switched' | 'added-and-switched';

/**
 * Ask the wallet to switch; if it reports the chain as unknown (4902) and parameters are available,
 * add the chain, then switch again.
 */
export async function switchOrAddChain(
  provider: Pick<EIP1193Provider, 'request'>,
  chainId: number,
  addParams: WalletAddChain | null,
): Promise<SwitchOutcome> {
  const hexId = numberToHex(chainId);
  const switchChain = () =>
    provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] } as never);
  try {
    await switchChain();
    return 'switched';
  } catch (error) {
    if (!isUnknownChainError(error) || !addParams) throw error;
    await provider.request({ method: 'wallet_addEthereumChain', params: [addParams] } as never);
    try {
      await switchChain();
    } catch (second) {
      // Some wallets switch as part of adding; tolerate a "already on this chain" style failure.
      const current = (await provider.request({ method: 'eth_chainId' })) as string;
      if (current?.toLowerCase() !== hexId.toLowerCase()) throw second;
    }
    return 'added-and-switched';
  }
}
