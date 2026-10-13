import { useEffect, useRef, useState } from 'react';
import { formatAmount } from './format';
import { useCollectionState, useRewardState } from './reads';

/** Counts a number up to its target on first appearance; renders the target at once under reduced motion. */
function useCountUp(target: number | undefined, duration = 900): number | undefined {
  const [value, setValue] = useState<number | undefined>(undefined);
  const started = useRef(false);
  useEffect(() => {
    if (target === undefined) return;
    if (started.current || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      started.current = true;
      return;
    }
    started.current = true;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function Tile({ label, value, detail, big }: { label: string; value: string; detail?: string; big?: boolean }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className={big ? 'tile-value big' : 'tile-value'}>{value}</span>
      {detail ? <span className="small muted">{detail}</span> : null}
    </div>
  );
}

/** Collection vitals as a strip of counters plus a supply meter. */
export function Stats() {
  const s = useCollectionState();
  const r = useRewardState();
  const minted = s.totalMinted !== undefined ? Number(s.totalMinted) : undefined;
  const max = s.maxSupply !== undefined ? Number(s.maxSupply) : 2500;
  const shown = useCountUp(minted);
  const reserve = r.previewReserve !== undefined ? Number(r.previewReserve) / 1e18 : undefined;
  const shownReserve = useCountUp(reserve);
  const paid = r.totalClaimed !== undefined ? Number(r.totalClaimed) / 1e18 : undefined;
  const shownPaid = useCountUp(paid);
  const pct = minted !== undefined ? (minted / max) * 100 : 0;

  return (
    <section className="stats" aria-label="Collection vitals">
      <div className="tiles">
        <Tile label="Minted" value={shown !== undefined ? Math.round(shown).toLocaleString() : '…'} detail={`of ${max.toLocaleString()} Swarmlers`} big />
        <Tile label="Reward reserve" value={shownReserve !== undefined ? `${shownReserve.toLocaleString(undefined, { maximumFractionDigits: 2 })} IMD` : '…'} detail="funds holding-time rewards" />
        <Tile label="Paid to holders" value={shownPaid !== undefined ? `${shownPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })} IMD` : '…'} detail={s.lifetimeCap !== undefined ? `cap ${formatAmount(s.lifetimeCap)} IMD each` : undefined} />
        <Tile label="Reward clock" value={s.rewardDuration === undefined ? '…' : s.rewardDuration === 0n ? 'not set' : `${Math.round(Number(s.rewardDuration) / 86_400)} days`} detail="funded time to reach the cap" />
      </div>
      <div className="meter supply" role="progressbar" aria-label="Minted share of supply" aria-valuemin={0} aria-valuemax={max} aria-valuenow={minted ?? 0}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}
