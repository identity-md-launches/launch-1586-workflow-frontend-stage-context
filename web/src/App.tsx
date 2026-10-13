import { useMemo } from 'react';
import { ClaimPanel } from './ClaimPanel';
import { useDeployment } from './deployment-context';
import { Feed } from './Feed';
import { Gallery } from './Gallery';
import { HookPanel } from './HookPanel';
import { InspectProvider } from './inspect-context';
import { Inspector } from './Inspector';
import { MintPanel } from './MintPanel';
import { MySwarmlers } from './MySwarmlers';
import { NetworkBanner } from './NetworkBanner';
import { OwnerPanel } from './OwnerPanel';
import { useCollectionState } from './reads';
import { RewardsPanel } from './RewardsPanel';
import { Stats } from './Stats';
import { SwapPanel } from './SwapPanel';
import { ThemeToggle } from './ThemeToggle';
import { AddressLink } from './ui';
import { WalletButton } from './WalletButton';
import { WebCanvas } from './WebCanvas';

const NAV: { href: string; label: string }[] = [
  { href: '#mint', label: 'Mint' },
  { href: '#inspect', label: 'Inspect' },
  { href: '#claim', label: 'Free claim' },
  { href: '#mine', label: 'Yours' },
  { href: '#feed', label: 'Activity' },
  { href: '#rewards', label: 'Rewards' },
  { href: '#swap', label: 'Trade' },
];

function Brand() {
  return (
    <a className="brand" href="./" aria-label="Swarmlers home">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#090d19" />
        <g stroke="#f2c94c" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M32 30 L14 16 M32 30 L50 16 M32 34 L12 36 M32 34 L52 36 M32 36 L18 52 M32 36 L46 52" />
        </g>
        <ellipse cx="32" cy="36" rx="9" ry="12" fill="#151d32" stroke="#f2c94c" strokeWidth="3" />
        <circle cx="32" cy="22" r="7" fill="#151d32" stroke="#f2c94c" strokeWidth="3" />
        <circle cx="29" cy="21" r="1.8" fill="#f2c94c" />
        <circle cx="35" cy="21" r="1.8" fill="#f2c94c" />
      </svg>
      Swarmlers
    </a>
  );
}

export default function App() {
  const dep = useDeployment();
  const net = dep.network;
  const s = useCollectionState();
  const minted = s.totalMinted !== undefined ? Number(s.totalMinted) : 25;
  // The crawlers on the hero web are the next six Swarmlers in line.
  const seedIds = useMemo(() => Array.from({ length: 6 }, (_, i) => Math.min(2500, minted + 1 + i)), [minted]);

  return (
    <InspectProvider>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="shell">
        <header className="header">
          <Brand />
          <nav className="nav" aria-label="Sections">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>{n.label}</a>
            ))}
          </nav>
          <div className="header-tools">
            <ThemeToggle />
            <WalletButton />
          </div>
        </header>

        <main id="main" className="stack">
          <section className="hero" aria-labelledby="hero-title">
            <WebCanvas seedIds={seedIds} />
            <div className="hero-copy">
              <h1 id="hero-title">
                Spider-crawler agents, <span className="accent-text">drawn on chain</span>.
              </h1>
              <p>2,500 Swarmler NFTs on {net?.name ?? 'Ethereum'} that earn IMD for the wallets that hold them.</p>
            </div>
            <div className="hero-action">
              <NetworkBanner />
              <MintPanel />
            </div>
          </section>

          <Stats />
          <OwnerPanel />

          <Inspector />

          <div className="grid-2">
            <ClaimPanel />
            <section className="card" id="pairing" aria-labelledby="pairing-title">
              <header>
                <h2 id="pairing-title">How pairing works</h2>
                <p>A paired Swarmler shows its agent's activity in the artwork.</p>
              </header>
              <ol className="steps">
                <li>Hold a Swarmler and an Identity MD in the same wallet.</li>
                <li>Have the activity reporter record recent, verified agent activity for that identity.</li>
                <li>Under Your Swarmlers, enter the identity ID and select Pair. A free claim pairs automatically.</li>
                <li>The eyes open and the status flips to active. Select Refresh metadata to nudge marketplaces.</li>
              </ol>
            </section>
          </div>

          <MySwarmlers />
          <Gallery />
          <Feed />
          <RewardsPanel />
          <SwapPanel />
          <HookPanel />
        </main>

        <footer className="footer">
          <p>
            Contracts on {net?.name ?? `chain ${dep.manifest.chainId}`} (chain {dep.manifest.chainId}). Source commit <span className="mono">{dep.manifest.sourceCommit.slice(0, 12)}</span>.
          </p>
          <ul>
            {dep.manifest.contracts.map((c) => (
              <li key={c.name}>
                {c.name}: <AddressLink address={c.address} full />
              </li>
            ))}
            {net?.pairToken ? (
              <li>
                {net.pairToken.symbol} ({net.pairToken.name}): <AddressLink address={net.pairToken.address} full />
              </li>
            ) : null}
          </ul>
          <p>Swarmlers the NFTs and SWARMLER the ERC-20 are different assets. Reads use the chain's public RPC; transactions are signed only by your wallet.</p>
        </footer>
      </div>
    </InspectProvider>
  );
}
