/** Shared contract reads. Every hook polls on the configured interval while the page is open. */
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import type { Address } from 'viem';
import { erc20Abi, POLL_INTERVAL_MS } from './config';
import { useDeployment } from './deployment-context';

const poll = { refetchInterval: POLL_INTERVAL_MS } as const;

export function useCollectionState() {
  const dep = useDeployment();
  const c = dep.contracts.Swarmlers;
  const a = dep.contracts.SwarmlerActivity;
  const q = useReadContracts({
    contracts: [
      { ...c, functionName: 'totalMinted' },
      { ...c, functionName: 'MAX_SUPPLY' },
      { ...c, functionName: 'MINT_PRICE' },
      { ...c, functionName: 'publicMintOpen' },
      { ...c, functionName: 'rewardDuration' },
      { ...c, functionName: 'LIFETIME_CAP' },
      { ...c, functionName: 'owner' },
      { ...c, functionName: 'imd' },
      { ...a, functionName: 'reporter' },
      { ...a, functionName: 'owner' },
      { ...c, functionName: 'creator' },
      { ...c, functionName: 'pendingOwner' },
      { ...a, functionName: 'pendingOwner' },
    ],
    query: { ...poll },
  });
  const r = q.data;
  const v = <T,>(i: number): T | undefined => (r?.[i]?.status === 'success' ? (r[i].result as T) : undefined);
  const reporter = v<Address>(8);
  return {
    isLoading: q.isLoading,
    error: q.error,
    totalMinted: v<bigint>(0),
    maxSupply: v<bigint>(1),
    mintPrice: v<bigint>(2),
    publicMintOpen: v<boolean>(3),
    rewardDuration: v<bigint>(4),
    lifetimeCap: v<bigint>(5),
    owner: v<Address>(6),
    imd: v<Address>(7),
    reporter,
    reporterSet: reporter ? !/^0x0{40}$/i.test(reporter) : undefined,
    activityOwner: v<Address>(9),
    creator: v<Address>(10),
    pendingOwner: v<Address>(11),
    activityPendingOwner: v<Address>(12),
    refetch: q.refetch,
  };
}

export function useRewardState() {
  const dep = useDeployment();
  const c = dep.contracts.Swarmlers;
  const q = useReadContracts({
    contracts: [
      { ...c, functionName: 'previewRewardState' },
      { ...c, functionName: 'rewardReserve' },
      { ...c, functionName: 'remainingRewardCapacity' },
      { ...c, functionName: 'totalAllocated' },
      { ...c, functionName: 'totalClaimed' },
      { ...c, functionName: 'creatorCredit' },
      { ...c, functionName: 'totalProceeds' },
      { ...c, functionName: 'accountedBalance' },
      { ...c, functionName: 'totalCreatorPaid' },
    ],
    query: { ...poll },
  });
  const r = q.data;
  const v = <T,>(i: number): T | undefined => (r?.[i]?.status === 'success' ? (r[i].result as T) : undefined);
  const preview = v<readonly [bigint, bigint, bigint]>(0);
  return {
    isLoading: q.isLoading,
    previewReserve: preview?.[1],
    rewardReserve: v<bigint>(1),
    remainingCapacity: v<bigint>(2),
    totalAllocated: v<bigint>(3),
    totalClaimed: v<bigint>(4),
    creatorCredit: v<bigint>(5),
    totalProceeds: v<bigint>(6),
    accountedBalance: v<bigint>(7),
    totalCreatorPaid: v<bigint>(8),
  };
}

/** IMD balance and allowance of the connected account toward `spender`. */
export function useTokenAllowance(token: Address | undefined, spender: Address | undefined) {
  const { address } = useAccount();
  const enabled = Boolean(token && spender && address);
  const q = useReadContracts({
    contracts: [
      { address: token!, abi: erc20Abi, functionName: 'balanceOf', args: [address!] },
      { address: token!, abi: erc20Abi, functionName: 'allowance', args: [address!, spender!] },
    ],
    query: { enabled, ...poll },
  });
  return {
    balance: q.data?.[0]?.status === 'success' ? (q.data[0].result as bigint) : undefined,
    allowance: q.data?.[1]?.status === 'success' ? (q.data[1].result as bigint) : undefined,
    refetch: q.refetch,
    isLoading: enabled && q.isLoading,
  };
}

export function useImdBalance() {
  const dep = useDeployment();
  const state = useCollectionState();
  return useTokenAllowance(state.imd, dep.contracts.Swarmlers.address);
}

export function useTokenUri(tokenId: bigint | undefined) {
  const dep = useDeployment();
  return useReadContract({
    ...dep.contracts.Swarmlers,
    functionName: 'tokenURI',
    args: [tokenId ?? 0n],
    query: { enabled: tokenId !== undefined, staleTime: 60_000 },
  });
}
