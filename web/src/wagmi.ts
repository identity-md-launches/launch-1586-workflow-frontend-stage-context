/** Build the wagmi config from the runtime deployment manifest. Nothing here is hard-coded per chain. */
import { createConfig, fallback, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain, type Chain } from 'viem';
import { arbitrum, base, mainnet, optimism, sepolia, unichain } from 'viem/chains';
import type { Deployment } from './config';

/** viem chain metadata (multicall3 and the like) for chains the app may be deployed on. */
const KNOWN_CHAINS: readonly Chain[] = [mainnet, sepolia, base, arbitrum, optimism, unichain];

export function chainFromDeployment(dep: Deployment): Chain {
  const id = dep.manifest.chainId;
  // viem's definition supplies multicall3 and other chain metadata when it knows the chain;
  // RPC URLs, name, explorer and native currency always come from the manifest's network block.
  const known: Chain | undefined = KNOWN_CHAINS.find((c) => c.id === id);
  const net = dep.network;
  const rpc = net?.rpcUrls?.length ? net.rpcUrls : dep.walletAddChain?.rpcUrls ?? known?.rpcUrls.default.http ?? [];
  if (rpc.length === 0) throw new Error('No public RPC URL configured for this chain');
  const baseChain: Partial<Chain> = known ?? {};
  return defineChain({
    ...baseChain,
    id,
    name: net?.name ?? dep.walletAddChain?.chainName ?? known?.name ?? `Chain ${id}`,
    nativeCurrency: net?.nativeCurrency ?? dep.walletAddChain?.nativeCurrency ?? known?.nativeCurrency ?? { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [...rpc] } },
    blockExplorers: net?.explorer
      ? { default: { name: 'Explorer', url: net.explorer } }
      : known?.blockExplorers,
    testnet: net?.testnet ?? known?.testnet,
  });
}

export function buildWagmiConfig(dep: Deployment) {
  const chain = chainFromDeployment(dep);
  return createConfig({
    chains: [chain],
    connectors: [injected({ shimDisconnect: true })],
    multiInjectedProviderDiscovery: true,
    transports: {
      [chain.id]: fallback(chain.rpcUrls.default.http.map((url) => http(url, { batch: true, retryCount: 2 }))),
    },
  });
}

export type WagmiConfig = ReturnType<typeof buildWagmiConfig>;
