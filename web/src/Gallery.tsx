import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import { rarity } from './art';
import { GALLERY_SIZE } from './config';
import { useDeployment } from './deployment-context';
import { decodeTokenUri } from './format';
import { useInspect } from './inspect-context';
import { useCollectionState } from './reads';
import { Card } from './ui';

/** The newest Swarmlers, drawn from their on-chain token URIs. Select one to inspect it. */
export function Gallery() {
  const dep = useDeployment();
  const s = useCollectionState();
  const { open } = useInspect();
  const ids = useMemo(() => {
    const total = s.totalMinted ?? 0n;
    const out: bigint[] = [];
    for (let i = total; i > 0n && out.length < GALLERY_SIZE; i--) out.push(i);
    return out;
  }, [s.totalMinted]);

  const q = useReadContracts({
    contracts: ids.map((id) => ({ ...dep.contracts.Swarmlers, functionName: 'tokenURI', args: [id] })),
    query: { enabled: ids.length > 0, staleTime: 60_000 },
  });

  return (
    <Card id="gallery" title="Latest Swarmlers" lead="Fresh from the chain. Select one to inspect it.">
      {ids.length === 0 ? (
        <p className="muted">{s.isLoading ? 'Loading the collection…' : 'No Swarmlers minted yet.'}</p>
      ) : (
        <ul className="gallery">
          {ids.map((id, i) => {
            const uriRes = q.data?.[i];
            const meta = uriRes?.status === 'success' ? decodeTokenUri(uriRes.result as string) : null;
            const n = Number(id);
            const tier = rarity(n);
            const status = meta?.attributes?.find((a) => a.trait_type === 'Agent status')?.value;
            return (
              <li key={id.toString()}>
                <button type="button" className="gallery-tile" onClick={() => open(n)}>
                  {meta?.image ? (
                    <img src={meta.image} alt={`Swarmler #${n}, ${tier}${status ? `, ${String(status).toLowerCase()}` : ''}`} loading="lazy" width={400} height={400} />
                  ) : (
                    <div className="gallery-placeholder" aria-hidden="true" />
                  )}
                  <span>
                    #{n} <span className={`rarity-${tier.toLowerCase()}`}>{tier}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
