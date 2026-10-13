import { useState } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { useDeployment } from './deployment-context';
import { formatTimestamp } from './format';
import { useReady } from './NetworkBanner';
import { useCollectionState } from './reads';
import { Card, Notice, TxStatus } from './ui';
import { phaseLabel, useTx } from './useTx';

function parseId(text: string): bigint | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  return BigInt(t);
}

/** Free claim for verified active Identity MD holders, with an eligibility preflight. */
export function ClaimPanel() {
  const dep = useDeployment();
  const { address, isConnected } = useAccount();
  const { ready, reason } = useReady();
  const s = useCollectionState();
  const [idText, setIdText] = useState('');
  const identityId = parseId(idText);
  const claim = useTx();

  const checks = useReadContracts({
    contracts: [
      { ...dep.contracts.Swarmlers, functionName: 'eligible', args: [address!, identityId!] },
      { ...dep.contracts.SwarmlerActivity, functionName: 'status', args: [identityId!, address!] },
      { ...dep.contracts.Swarmlers, functionName: 'identityClaimed', args: [identityId!] },
      { ...dep.contracts.Swarmlers, functionName: 'walletClaimed', args: [address!] },
    ],
    query: { enabled: Boolean(address && identityId !== null), refetchInterval: 12_000 },
  });
  const r = checks.data;
  const eligible = r?.[0]?.status === 'success' ? (r[0].result as boolean) : undefined;
  const status = r?.[1]?.status === 'success' ? (r[1].result as readonly [boolean, bigint, bigint]) : undefined;
  const statusError = r?.[1]?.status === 'failure' ? r[1].error : undefined;
  const identityUsed = r?.[2]?.status === 'success' ? (r[2].result as boolean) : undefined;
  const walletUsed = r?.[3]?.status === 'success' ? (r[3].result as boolean) : undefined;

  const canClaim = ready && identityId !== null && eligible === true && s.publicMintOpen === true;

  return (
    <Card id="claim" title="Claim one free" lead="One free Swarmler per verified, active Identity MD holder.">
      <div className="field">
        <label htmlFor="identity-id">Identity MD token ID</label>
        <input
          id="identity-id"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 1234"
          value={idText}
          onChange={(e) => setIdText(e.target.value)}
          aria-invalid={idText.trim() !== '' && identityId === null ? true : undefined}
          aria-describedby="identity-hint"
        />
        <span id="identity-hint" className="hint">
          Eligibility is checked on chain as you type.
        </span>
      </div>

      {!isConnected ? <p className="small muted">Connect the identity holder's wallet.</p> : null}
      {s.reporterSet === false ? (
        <Notice kind="warn">No activity reporter is configured yet, so free claims are closed.</Notice>
      ) : null}
      {isConnected && identityId !== null && checks.isLoading ? <p className="small muted" role="status">Checking eligibility…</p> : null}
      {isConnected && identityId !== null && !checks.isLoading && r ? (
        <div className={`status ${eligible ? 'ok' : 'warn'}`} role="status" aria-live="polite">
          <span>{eligible ? 'Eligible: this wallet can claim one Swarmler for free.' : 'Not eligible right now.'}</span>
          {status ? (
            <span className="small">
              Verified activity: {status[0] ? 'active' : 'not active'}. Last reported {formatTimestamp(status[1])}, score {status[2].toString()}.
              {!status[0] && status[1] !== 0n ? ' The record is historical, not a current verification.' : ''}
            </span>
          ) : statusError ? (
            <span className="small">Activity status unavailable: the registry or identity contract refused the lookup. This does not prove you lack an identity.</span>
          ) : null}
          {walletUsed ? <span className="small">This wallet already used its free claim.</span> : null}
          {identityUsed ? <span className="small">This identity already used its free claim.</span> : null}
          {s.publicMintOpen === false ? <span className="small">Claims open when public minting opens.</span> : null}
        </div>
      ) : null}

      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={!canClaim || claim.state.busy}
          onClick={() => identityId !== null && claim.send({ ...dep.contracts.Swarmlers, functionName: 'freeClaim', args: [identityId] })}
        >
          {phaseLabel(claim.state.phase, 'Claim free Swarmler')}
        </button>
      </div>
      {isConnected && !ready && reason ? <p className="small muted">{reason}</p> : null}
      <TxStatus state={claim.state} done="Claimed. Your Swarmler is paired to this identity automatically." />
    </Card>
  );
}
