import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { usePublicClient } from 'wagmi';
import { parseEventLogs, type Abi, type Address, type Log } from 'viem';
import { useDeployment } from './deployment-context';
import { formatAmount, shortAddress } from './format';
import { useInspect } from './inspect-context';
import { Card } from './ui';

const ZERO = '0x0000000000000000000000000000000000000000';
/** Public RPCs cap eth_getLogs at 10,000 blocks per call. */
const CHUNK = 9_999n;
const MAX_CHUNKS = 5;
const WANT = 16;
const SHOW = 12;

export interface FeedEvent {
  key: string;
  block: bigint;
  tx: `0x${string}`;
  kind: string;
  text: string;
  tokenId?: number;
  address?: Address;
}

type Decoded = Log<bigint, number, false, undefined, true, Abi, string> & { eventName: string; args: Record<string, unknown> };

function describe(log: Decoded, mintedInTx: Set<string>): FeedEvent | null {
  const a = log.args;
  const base = { key: `${log.transactionHash}-${log.logIndex}`, block: log.blockNumber, tx: log.transactionHash };
  const id = (v: unknown) => Number(v as bigint);
  switch (log.eventName) {
    case 'Transfer': {
      const token = id(a.tokenId);
      if (a.from === ZERO) {
        if (mintedInTx.has(`${log.transactionHash}-${token}`)) return null; // the Minted event covers it
        return { ...base, kind: 'mint', text: `#${token} minted to ${shortAddress(a.to as string)}`, tokenId: token, address: a.to as Address };
      }
      return { ...base, kind: 'transfer', text: `#${token} moved to ${shortAddress(a.to as string)}`, tokenId: token, address: a.to as Address };
    }
    case 'Minted': {
      const token = id(a.tokenId);
      return { ...base, kind: 'mint', text: `#${token} ${a.freeClaim ? 'claimed free' : 'minted'} by ${shortAddress(a.holder as string)}`, tokenId: token, address: a.holder as Address };
    }
    case 'Paired':
      return { ...base, kind: 'pair', text: `#${id(a.tokenId)} paired with Identity MD #${id(a.identityId)}`, tokenId: id(a.tokenId) };
    case 'RewardClaimed':
      return { ...base, kind: 'claim', text: `#${id(a.tokenId)} paid ${formatAmount(a.amount as bigint)} IMD to ${shortAddress(a.holder as string)}`, tokenId: id(a.tokenId), address: a.holder as Address };
    case 'ProceedsDeposited':
      return { ...base, kind: 'deposit', text: `${formatAmount(a.gross as bigint)} IMD in: ${formatAmount(a.rewards as bigint)} to rewards, ${formatAmount(a.creatorShare as bigint)} to creator` };
    case 'RewardsCheckpointed':
      return { ...base, kind: 'checkpoint', text: `checkpoint, ${formatAmount(a.allocated as bigint)} IMD allocated so far` };
    case 'CreatorPaid':
      return { ...base, kind: 'creator', text: `creator paid ${formatAmount(a.amount as bigint)} IMD` };
    case 'PublicMintOpened':
      return { ...base, kind: 'config', text: 'public minting opened' };
    case 'RewardDurationConfigured':
      return { ...base, kind: 'config', text: `reward duration set to ${Math.round(Number(a.duration as bigint) / 86_400)} days` };
    case 'ReporterConfigured':
      return { ...base, kind: 'config', text: `activity reporter set to ${shortAddress(a.reporter as string)}`, address: a.reporter as Address };
    case 'ActivityRecorded':
      return { ...base, kind: 'activity', text: `activity recorded for Identity MD #${id(a.identityId)}` };
    case 'OwnershipTransferred':
      return a.previousOwner === ZERO ? { ...base, kind: 'config', text: `contract deployed, owner ${shortAddress(a.newOwner as string)}` } : { ...base, kind: 'config', text: `ownership moved to ${shortAddress(a.newOwner as string)}` };
    default:
      return null;
  }
}

/** Recent contract events, newest first, read straight from the chain's public RPC. */
export function useFeed() {
  const dep = useDeployment();
  const client = usePublicClient();
  const collection = dep.contracts.Swarmlers;
  const registry = dep.contracts.SwarmlerActivity;
  const deployBlock = useMemo(() => {
    const blocks = dep.manifest.contracts.map((c) => c.blockNumber).filter((b): b is number => typeof b === 'number');
    return blocks.length ? BigInt(Math.min(...blocks)) : 0n;
  }, [dep.manifest.contracts]);

  return useQuery({
    queryKey: ['feed', collection.address, deployBlock.toString()],
    enabled: Boolean(client),
    refetchInterval: 20_000,
    staleTime: 10_000,
    queryFn: async () => {
      if (!client) throw new Error('No RPC client');
      const latest = await client.getBlockNumber();
      const abi = [...collection.abi, ...registry.abi] as Abi;
      const events: FeedEvent[] = [];
      let to = latest;
      for (let i = 0; i < MAX_CHUNKS && to >= deployBlock && events.length < WANT; i++) {
        const from = to - CHUNK > deployBlock ? to - CHUNK : deployBlock;
        const logs = await client.getLogs({ address: [collection.address, registry.address], fromBlock: from, toBlock: to });
        const decoded = parseEventLogs({ abi, logs, strict: false }) as unknown as Decoded[];
        const mintedInTx = new Set(decoded.filter((l) => l.eventName === 'Minted').map((l) => `${l.transactionHash}-${Number(l.args.tokenId as bigint)}`));
        for (const log of decoded) {
          const ev = describe(log, mintedInTx);
          if (ev) events.push(ev);
        }
        if (from === deployBlock) break;
        to = from - 1n;
      }
      events.sort((x, y) => (x.block === y.block ? (x.key < y.key ? 1 : -1) : x.block > y.block ? -1 : 1));
      return { latest, events };
    },
  });
}

function ago(latest: bigint, block: bigint): string {
  const sec = Number(latest - block) * 12;
  if (sec < 60) return 'just now';
  if (sec < 3_600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86_400) return `${Math.round(sec / 3_600)} h ago`;
  return `${Math.round(sec / 86_400)} d ago`;
}

export function Feed() {
  const dep = useDeployment();
  const feed = useFeed();
  const { open } = useInspect();
  const explorer = dep.network?.explorer?.replace(/\/$/, '');
  const events = feed.data?.events.slice(0, SHOW) ?? [];

  return (
    <Card id="feed" title="On the web" lead="Everything the collection and its activity registry did lately, newest first.">
      <div className="feed-head">
        <span className="live" aria-hidden="true" />
        <span className="small muted">{feed.data ? `Read at block ${feed.data.latest.toLocaleString()}, refreshed every 20 s.` : feed.isError ? 'The public RPC refused the log query. Retrying.' : 'Reading recent blocks…'}</span>
      </div>
      {events.length === 0 && feed.data ? <p className="muted">No events in the last {(Number(CHUNK + 1n) * MAX_CHUNKS).toLocaleString()} blocks.</p> : null}
      <ol className="feed" aria-live="polite" aria-relevant="additions">
        {events.map((ev) => (
          <li key={ev.key} className={`feed-row kind-${ev.kind}`}>
            <span className="mono muted feed-time">{feed.data ? ago(feed.data.latest, ev.block) : ''}</span>
            <span className="feed-text">
              {ev.tokenId !== undefined ? (
                <button type="button" className="link-button" onClick={() => open(ev.tokenId!)}>
                  {ev.text}
                </button>
              ) : (
                ev.text
              )}
            </span>
            {explorer ? (
              <a className="mono small feed-tx" href={`${explorer}/tx/${ev.tx}`} target="_blank" rel="noreferrer" aria-label={`Transaction ${shortAddress(ev.tx)} on the explorer`}>
                {shortAddress(ev.tx)}
              </a>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}
