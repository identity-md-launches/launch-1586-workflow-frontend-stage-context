import { useEffect, useMemo, useState } from 'react';
import { useReadContracts } from 'wagmi';
import { bodyWidth, color, hue, imageUrl, isValidId, MAX_SUPPLY, mintedByRarity, nextOfRarity, RARITIES, RARITY_SUPPLY, rarity, sigilBits, type Rarity } from './art';
import { useDeployment } from './deployment-context';
import { decodeTokenUri, formatAmount } from './format';
import { useInspect } from './inspect-context';
import { useCollectionState } from './reads';
import { AddressLink, Card, Fact } from './ui';

/** The next few IDs the contract will hand out, with their public rarity. */
export function NextUp({ minted, count = 8 }: { minted: number; count?: number }) {
  const { open, id: selected } = useInspect();
  const ids = useMemo(() => Array.from({ length: count }, (_, i) => minted + 1 + i).filter((id) => id <= MAX_SUPPLY), [minted, count]);
  if (ids.length === 0) return null;
  return (
    <ul className="queue" aria-label="Next Swarmlers to be minted">
      {ids.map((id, i) => (
        <li key={id}>
          <button type="button" className={`chip rarity-${rarity(id).toLowerCase()}`} aria-pressed={selected === id} onClick={() => open(id)}>
            <span className="swatch" style={{ background: color(id) }} aria-hidden="true" />
            <span>#{id}</span>
            <span className="muted">{i === 0 ? 'next' : rarity(id)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RarityBars({ minted }: { minted: number }) {
  const counts = useMemo(() => mintedByRarity(minted), [minted]);
  const { open } = useInspect();
  return (
    <div className="tiers">
      {RARITIES.map((tier) => {
        const total = RARITY_SUPPLY[tier];
        const done = counts[tier];
        const next = nextOfRarity(minted + 1, tier);
        return (
          <div className="tier" key={tier}>
            <div className="tier-head">
              <span className={`tier-name rarity-${tier.toLowerCase()}`}>{tier}</span>
              <span className="mono">
                {done} of {total} minted
              </span>
            </div>
            <div className="meter" role="img" aria-label={`${tier}: ${done} of ${total} minted`}>
              <span style={{ width: `${(done / total) * 100}%` }} />
            </div>
            <span className="small muted">
              {next ? (
                <>
                  Next {tier.toLowerCase()} is{' '}
                  <button type="button" className="link-button" onClick={() => open(next)}>
                    #{next}
                  </button>
                </>
              ) : (
                'All minted'
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Live facts for a minted token; the contract is the only source of activity state. */
function useTokenFacts(id: number | null, minted: number | undefined) {
  const dep = useDeployment();
  const c = dep.contracts.Swarmlers;
  const enabled = id !== null && minted !== undefined && id <= minted;
  const q = useReadContracts({
    contracts: [
      { ...c, functionName: 'ownerOf', args: [BigInt(id ?? 0)] },
      { ...c, functionName: 'isPaired', args: [BigInt(id ?? 0)] },
      { ...c, functionName: 'pairedIdentity', args: [BigInt(id ?? 0)] },
      { ...c, functionName: 'earned', args: [BigInt(id ?? 0)] },
      { ...c, functionName: 'claimable', args: [BigInt(id ?? 0)] },
      { ...c, functionName: 'tokenURI', args: [BigInt(id ?? 0)] },
    ],
    query: { enabled, refetchInterval: 15_000 },
  });
  const r = q.data;
  const v = <T,>(i: number): T | undefined => (r?.[i]?.status === 'success' ? (r[i].result as T) : undefined);
  const meta = v<string>(5) ? decodeTokenUri(v<string>(5)!) : null;
  const status = meta?.attributes?.find((a) => a.trait_type === 'Agent status')?.value;
  const score = meta?.attributes?.find((a) => a.trait_type === 'Activity score')?.value;
  return {
    enabled,
    loading: enabled && q.isLoading,
    owner: v<`0x${string}`>(0),
    paired: v<boolean>(1),
    identity: v<bigint>(2),
    earned: v<bigint>(3),
    claimable: v<bigint>(4),
    image: meta?.image,
    active: status === undefined ? undefined : status === 'Active',
    score: typeof score === 'number' ? score : score ? Number(score) : undefined,
  };
}

/** Type any ID from 1 to 2,500 and see that Swarmler, minted or not. */
export function Inspector() {
  const s = useCollectionState();
  const minted = s.totalMinted !== undefined ? Number(s.totalMinted) : undefined;
  const { id, set } = useInspect();
  const [text, setText] = useState('');

  // Default to the next Swarmler in line once the supply is known; follow external selections.
  useEffect(() => {
    if (id === null && minted !== undefined) set(Math.min(minted + 1, MAX_SUPPLY));
  }, [id, minted, set]);
  useEffect(() => {
    if (id !== null && text !== String(id)) setText(String(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const typed = /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN;
  const invalid = text.trim() !== '' && !isValidId(typed);
  const facts = useTokenFacts(id, minted);
  const tier: Rarity | null = id !== null ? rarity(id) : null;
  const live = facts.enabled;
  const src = live && facts.image ? facts.image : id !== null ? imageUrl(id, facts.active === true) : undefined;

  return (
    <Card id="inspect" title="Inspect any Swarmler" lead="Artwork and rarity are fixed by the ID, so you can look before you mint.">
      <div className="inspect">
        <div className="inspect-art">
          {src ? (
            <img src={src} alt={id !== null ? `Swarmler #${id}, ${tier}${facts.active === true ? ', active' : facts.active === false ? ', dormant' : ''}` : ''} width={400} height={400} />
          ) : (
            <div className="art-placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="inspect-body">
          <div className="field">
            <label htmlFor="inspect-id">Swarmler ID (1 to 2,500)</label>
            <div className="row">
              <input
                id="inspect-id"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  const n = Number(e.target.value.trim());
                  if (/^\d+$/.test(e.target.value.trim()) && isValidId(n)) set(n);
                }}
                aria-invalid={invalid ? true : undefined}
                aria-describedby="inspect-hint"
                style={{ flex: '1 1 120px' }}
              />
              <button type="button" disabled={id === null || id <= 1} onClick={() => id !== null && set(id - 1)} aria-label="Previous Swarmler">
                Previous
              </button>
              <button type="button" disabled={id === null || id >= MAX_SUPPLY} onClick={() => id !== null && set(id + 1)} aria-label="Next Swarmler">
                Next
              </button>
            </div>
            <span id="inspect-hint" className="hint">
              {invalid ? 'Enter a whole number from 1 to 2,500.' : 'Drawn here from the same rules as the contract.'}
            </span>
          </div>

          {id !== null ? (
            <dl className="facts">
              <Fact label="Rarity" value={<span className={`rarity-${tier!.toLowerCase()}`}>{tier}</span>} />
              <Fact label="Hue" value={<span><span className="swatch" style={{ background: color(id) }} aria-hidden="true" /> {hue(id)}°</span>} />
              <Fact label="Body width" value={`${bodyWidth(id)} of 48`} />
              <Fact
                label="Markings"
                value={
                  <span className="sigil" aria-label={`${sigilBits(id).filter(Boolean).length} of 12 markings lit`}>
                    {sigilBits(id).map((on, i) => (
                      <span key={i} className={on ? 'on' : undefined} style={on ? { background: color(id) } : undefined} />
                    ))}
                  </span>
                }
              />
              <Fact
                label="Status"
                value={
                  minted === undefined
                    ? '…'
                    : !live
                      ? id === minted + 1
                        ? 'Next to be minted'
                        : `Not minted yet, ${(id - minted).toLocaleString()} in line`
                      : facts.loading
                        ? 'Reading the chain…'
                        : facts.active === undefined
                          ? 'Minted'
                          : facts.active
                            ? `Minted, agent active, score ${facts.score ?? '…'}`
                            : 'Minted, agent dormant'
                }
              />
              {live && facts.owner ? <Fact label="Held by" value={<AddressLink address={facts.owner} />} /> : null}
              {live && facts.paired !== undefined ? <Fact label="Paired" value={facts.paired ? `Identity MD #${facts.identity?.toString()}` : 'Not paired'} /> : null}
              {live && facts.earned !== undefined ? <Fact label="Earned" value={`${formatAmount(facts.earned)} IMD`} /> : null}
              {live && facts.claimable !== undefined ? <Fact label="Claimable" value={`${formatAmount(facts.claimable)} IMD`} /> : null}
            </dl>
          ) : null}
        </div>
      </div>

      {minted !== undefined ? (
        <>
          <h3>Next in line</h3>
          <NextUp minted={minted} />
          <h3>Rarity by tier</h3>
          <p className="small muted">Tiers follow a fixed permutation of the ID: public, predictable, and no effect on reward rate.</p>
          <RarityBars minted={minted} />
        </>
      ) : null}
    </Card>
  );
}
