/**
 * One transaction flow per button: simulate, ask the wallet, wait for the receipt, refresh reads.
 * Each call site owns its own state so two buttons never share a pending flag.
 */
import { useCallback, useState } from 'react';
import { useAccount, useConfig } from 'wagmi';
import { getPublicClient, getWalletClient, waitForTransactionReceipt } from 'wagmi/actions';
import { useQueryClient } from '@tanstack/react-query';
import type { Abi, Address, Hex } from 'viem';
import { describeError } from './errors';

export type TxPhase = 'idle' | 'simulating' | 'signing' | 'mining' | 'done' | 'error';

export interface TxState {
  phase: TxPhase;
  hash?: Hex;
  error?: string;
  busy: boolean;
}

export interface TxRequest {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

export function useTx(onDone?: () => void) {
  const config = useConfig();
  const { address: account, chainId: walletChainId } = useAccount();
  const queryClient = useQueryClient();
  const [state, setState] = useState<TxState>({ phase: 'idle', busy: false });

  const send = useCallback(
    async (req: TxRequest): Promise<Hex | null> => {
      if (!account) {
        setState({ phase: 'error', busy: false, error: 'Connect a wallet first.' });
        return null;
      }
      const chainId = config.chains[0].id;
      if (walletChainId !== chainId) {
        setState({ phase: 'error', busy: false, error: `Switch the wallet to ${config.chains[0].name} first.` });
        return null;
      }
      setState({ phase: 'simulating', busy: true });
      try {
        const publicClient = getPublicClient(config, { chainId });
        if (!publicClient) throw new Error('No RPC client');
        const { request } = await publicClient.simulateContract({
          account,
          address: req.address,
          abi: req.abi,
          functionName: req.functionName,
          args: req.args as never,
          value: req.value,
        });
        setState({ phase: 'signing', busy: true });
        const walletClient = await getWalletClient(config, { chainId });
        const hash = await walletClient.writeContract(request as never);
        setState({ phase: 'mining', busy: true, hash });
        const receipt = await waitForTransactionReceipt(config, { hash, chainId });
        if (receipt.status !== 'success') throw new Error('The transaction reverted on chain.');
        setState({ phase: 'done', busy: false, hash });
        await queryClient.invalidateQueries();
        onDone?.();
        return hash;
      } catch (error) {
        setState((s) => ({ phase: 'error', busy: false, hash: s.hash, error: describeError(error) }));
        return null;
      }
    },
    [account, config, onDone, queryClient, walletChainId],
  );

  const reset = useCallback(() => setState({ phase: 'idle', busy: false }), []);
  return { state, send, reset };
}

export function phaseLabel(phase: TxPhase, verb: string): string {
  switch (phase) {
    case 'simulating':
      return 'Checking…';
    case 'signing':
      return 'Confirm in wallet…';
    case 'mining':
      return `${verb}…`;
    default:
      return verb;
  }
}
