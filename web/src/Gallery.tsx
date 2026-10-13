import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import { GALLERY_SIZE } from './config';
import { useDeployment } from './deployment-context';
import { decodeTokenUri } from './format';
import { useCollectionState } from './reads';
import { Card } from './ui';

/** The newest Swarmlers, drawn from their on-chain token URIs. */
export function Gallery() {
  const dep = useDeployment();
  const s = useCollectionState();
  const ids = useMemo(() => {
    const total = s.totalMinted ?? 0n;
    const out: bigint[] = [];
    for (let i = total; i > 0n && out.length < GALLERY_SIZE; i--) out.push(i);
    return out;
  }, [s.totalMinted]);

  const q = useReadContracts({
    contracts: ids.flatMap((id) => [
      { ...dep.contracts.Swarmlers, functionName: 'tokenURI', args: [id] },
      { ...dep.contracts.Swarmlers, functionName: 'rarity', args: [id] },
    ]),
    query: { enabled: ids.length > 0, staleTime: 60_000 },
  });

  return (
    <Card id="gallery" title="Latest Swarmlers" lead="Drawn and stored on chain.">
      {ids.length === 0 ? (
        <p className="muted">{s.isLoading ? 'Loading the collection…' : 'No Swarmlers minted yet.'}</p>
      ) : (
        <ul className="gallery">
          {ids.map((id, i) => {
            const uriRes = q.data?.[i * 2];
            const rarityRes = q.data?.[i * 2 + 1];
            const meta = uriRes?.status === 'success' ? decodeTokenUri(uriRes.result as string) : null;
            const rarity = rarityRes?.status === 'success' ? (rarityRes.result as string) : undefined;
            return (
              <li key={id.toString()}>
                {meta?.image ? (
                  <img src={meta.image} alt={`Swarmler #${id.toString()}${rarity ? `, ${rarity}` : ''}`} loading="lazy" />
                ) : (
                  <div className="gallery-placeholder" aria-hidden="true" style={{ aspectRatio: 1, borderRadius: 'var(--radius-m)', background: 'var(--surface-2)' }} />
                )}
                <span>
                  #{id.toString()} {rarity ? <span className="muted">{rarity}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
