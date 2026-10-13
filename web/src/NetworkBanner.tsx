import { useState } from 'react';
import { useAccount, useConfig } from 'wagmi';
import type { EIP1193Provider } from 'viem';
import { switchOrAddChain } from './chain';
import { useDeployment } from './deployment-context';
import { describeError } from './errors';

/** Shown only when a wallet is connected to a different chain. One control: "Switch to <name>". */
export function NetworkBanner() {
  const dep = useDeployment();
  const config = useConfig();
  const { isConnected, chainId, connector } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chain = config.chains[0];
  if (!isConnected || chainId === chain.id) return null;

  const onSwitch = async () => {
    if (!connector) return;
    setBusy(true);
    setError(null);
    try {
      const provider = (await connector.getProvider()) as Pick<EIP1193Provider, 'request'>;
      await switchOrAddChain(provider, chain.id, dep.walletAddChain);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="banner" role="region" aria-label="Network">
      <div>
        <strong>Wrong network.</strong> This site runs on {chain.name} (chain {chain.id}).
        {error ? <span className="small" role="alert" style={{ display: 'block' }}>{error}</span> : null}
      </div>
      <button type="button" className="primary" onClick={onSwitch} disabled={busy || !connector}>
        {busy ? 'Switching…' : `Switch to ${chain.name}`}
      </button>
    </div>
  );
}

/** True when actions may be sent: a wallet is connected on the configured chain. */
export function useReady(): { ready: boolean; reason: string | null } {
  const config = useConfig();
  const { isConnected, chainId } = useAccount();
  if (!isConnected) return { ready: false, reason: 'Connect a wallet to continue.' };
  if (chainId !== config.chains[0].id) return { ready: false, reason: `Switch the wallet to ${config.chains[0].name}.` };
  return { ready: true, reason: null };
}
