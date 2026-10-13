import { useMemo, useState } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { useDeployment } from './deployment-context';
import { decodeTokenUri, formatAmount } from './format';
import { useReady } from './NetworkBanner';
import { useCollectionState } from './reads';
import { Card, Notice, TxStatus } from './ui';
import { phaseLabel, useTx } from './useTx';

/** Enumerate the connected wallet's Swarmlers (no ERC721Enumerable: scan 1..totalMinted). */
function useOwnedIds() {
  const dep = useDeployment();
  const { address } = useAccount();
  const s = useCollectionState();
  const total = Number(s.totalMinted ?? 0n);
  const ids = useMemo(() => Array.from({ length: total }, (_, i) => BigInt(i + 1)), [total]);
  const q = useReadContracts({
    contracts: ids.map((id) => ({ ...dep.contracts.Swarmlers, functionName: 'ownerOf', args: [id] })),
    query: { enabled: Boolean(address) && ids.length > 0, refetchInterval: 15_000 },
  });
  const owned = useMemo(() => {
    if (!address || !q.data) return [];
    return ids.filter((_, i) => q.data![i]?.status === 'success' && (q.data![i].result as string).toLowerCase() === address.toLowerCase());
  }, [address, ids, q.data]);
  return { owned, isLoading: q.isLoading, total };
}

function PairForm({ tokenId }: { tokenId: bigint }) {
  const dep = useDeployment();
  const { ready } = useReady();
  const [text, setText] = useState('');
  const pair = useTx();
  const id = /^\d+$/.test(text.trim()) ? BigInt(text.trim()) : null;
  const inputId = `pair-${tokenId.toString()}`;
  return (
    <div className="field">
      <label htmlFor={inputId}>Pair with Identity MD ID</label>
      <div className="row">
        <input id={inputId} type="text" inputMode="numeric" autoComplete="off" placeholder="e.g. 1234" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: '1 1 140px' }} />
        <button type="button" disabled={!ready || id === null || pair.state.busy} onClick={() => id !== null && pair.send({ ...dep.contracts.Swarmlers, functionName: 'pair', args: [tokenId, id] })}>
          {phaseLabel(pair.state.phase, 'Pair')}
        </button>
      </div>
      <span className="hint">You must hold that identity and it must be verified active. Pairing drives the dynamic artwork.</span>
      <TxStatus state={pair.state} done="Paired. Metadata refreshes with the agent's activity." />
    </div>
  );
}

function OwnedItem({ tokenId }: { tokenId: bigint }) {
  const dep = useDeployment();
  const { ready } = useReady();
  const c = dep.contracts.Swarmlers;
  const q = useReadContracts({
    contracts: [
      { ...c, functionName: 'tokenURI', args: [tokenId] },
      { ...c, functionName: 'rarity', args: [tokenId] },
      { ...c, functionName: 'isPaired', args: [tokenId] },
      { ...c, functionName: 'pairedIdentity', args: [tokenId] },
      { ...c, functionName: 'earned', args: [tokenId] },
      { ...c, functionName: 'claimable', args: [tokenId] },
      { ...c, functionName: 'claimed', args: [tokenId] },
      { ...c, functionName: 'LIFETIME_CAP' },
    ],
    query: { refetchInterval: 12_000 },
  });
  const r = q.data;
  const v = <T,>(i: number): T | undefined => (r?.[i]?.status === 'success' ? (r[i].result as T) : undefined);
  const meta = v<string>(0) ? decodeTokenUri(v<string>(0)!) : null;
  const rarity = v<string>(1);
  const paired = v<boolean>(2);
  const identity = v<bigint>(3);
  const earned = v<bigint>(4);
  const claimable = v<bigint>(5);
  const claimed = v<bigint>(6);
  const cap = v<bigint>(7);
  const claim = useTx();
  const refresh = useTx();
  const [showPair, setShowPair] = useState(false);

  return (
    <li>
      {meta?.image ? <img src={meta.image} alt={`Swarmler #${tokenId.toString()}${rarity ? `, ${rarity}` : ''}`} /> : <div aria-hidden="true" style={{ aspectRatio: 1, borderRadius: 'var(--radius-m)', background: 'var(--surface-2)' }} />}
      <div className="meta">
        <h3>
          Swarmler #{tokenId.toString()} {rarity ? <span className="muted">{rarity}</span> : null}
        </h3>
        <p className="small">
          {paired === undefined ? '…' : paired ? `Paired with Identity MD #${identity?.toString()}` : 'Not paired yet'}
        </p>
        <dl className="facts">
          <div><dt>Claimable now</dt><dd>{claimable !== undefined ? `${formatAmount(claimable)} IMD` : '…'}</dd></div>
          <div><dt>Earned lifetime</dt><dd>{earned !== undefined && cap !== undefined ? `${formatAmount(earned)} of ${formatAmount(cap)} IMD` : '…'}</dd></div>
          <div><dt>Already paid</dt><dd>{claimed !== undefined ? `${formatAmount(claimed)} IMD` : '…'}</dd></div>
        </dl>
        <div className="actions">
          <button type="button" className="primary" disabled={!ready || !claimable || claim.state.busy} onClick={() => claim.send({ ...c, functionName: 'claimReward', args: [tokenId] })}>
            {phaseLabel(claim.state.phase, 'Claim reward')}
          </button>
          <button type="button" onClick={() => setShowPair((s) => !s)} aria-expanded={showPair}>
            {showPair ? 'Hide pairing' : paired ? 'Re-pair' : 'Pair identity'}
          </button>
          <button type="button" disabled={!ready || refresh.state.busy} onClick={() => refresh.send({ ...c, functionName: 'refreshMetadata', args: [tokenId] })}>
            {phaseLabel(refresh.state.phase, 'Refresh metadata')}
          </button>
        </div>
        <TxStatus state={claim.state} done="Reward paid to your wallet." />
        <TxStatus state={refresh.state} done="Metadata refresh emitted for marketplaces." />
        {showPair ? <PairForm tokenId={tokenId} /> : null}
      </div>
    </li>
  );
}

export function MySwarmlers() {
  const dep = useDeployment();
  const { isConnected } = useAccount();
  const { ready } = useReady();
  const { owned, isLoading } = useOwnedIds();
  const claimAll = useTx();
  const s = useCollectionState();

  return (
    <Card id="mine" title="Your Swarmlers" lead="Holders earn IMD by holding time, up to 1 IMD each.">
      {!isConnected ? (
        <p className="muted">Connect a wallet to see yours.</p>
      ) : isLoading ? (
        <p className="muted" role="status">Scanning the collection for your Swarmlers…</p>
      ) : owned.length === 0 ? (
        <p className="muted">This wallet holds no Swarmlers yet. Mint or claim one above.</p>
      ) : (
        <>
          {s.rewardDuration === 0n ? <Notice kind="warn">Rewards are not configured yet: the owner has not set the reward duration, so nothing accrues until then.</Notice> : null}
          {owned.length > 1 ? (
            <div className="actions">
              <button type="button" disabled={!ready || claimAll.state.busy} onClick={() => claimAll.send({ ...dep.contracts.Swarmlers, functionName: 'claimRewards', args: [owned.slice(0, 100)] })}>
                {phaseLabel(claimAll.state.phase, `Claim all (${Math.min(owned.length, 100)})`)}
              </button>
              <span className="small muted">Every included Swarmler must have a reward, or the batch fails.</span>
            </div>
          ) : null}
          <TxStatus state={claimAll.state} done="Rewards paid to your wallet." />
          <ul className="owned">
            {owned.map((id) => (
              <OwnedItem key={id.toString()} tokenId={id} />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
