import { ClaimPanel } from './ClaimPanel';
import { useDeployment } from './deployment-context';
import { Gallery } from './Gallery';
import { HookPanel } from './HookPanel';
import { MintPanel } from './MintPanel';
import { MySwarmlers } from './MySwarmlers';
import { NetworkBanner } from './NetworkBanner';
import { OwnerPanel } from './OwnerPanel';
import { RewardsPanel } from './RewardsPanel';
import { SwapPanel } from './SwapPanel';
import { AddressLink } from './ui';
import { WalletButton } from './WalletButton';

export default function App() {
  const dep = useDeployment();
  const net = dep.network;
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="shell">
        <header className="header">
          <a className="brand" href="./" aria-label="Swarmlers home">
            <svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#141a24" /><g stroke="#f2c94c" strokeWidth="4" strokeLinecap="round" fill="none"><path d="M32 30 L14 16 M32 30 L50 16 M32 34 L12 36 M32 34 L52 36 M32 36 L18 52 M32 36 L46 52" /></g><circle cx="32" cy="32" r="9" fill="#f2c94c" /><circle cx="29" cy="30" r="2" fill="#141a24" /><circle cx="35" cy="30" r="2" fill="#141a24" /></svg>
            Swarmlers
          </a>
          <WalletButton />
        </header>

        <main id="main" className="stack">
          <section className="hero">
            <h1>Mint a Swarmler, earn IMD.</h1>
            <p>2,500 spider-crawler agent NFTs on {net?.name ?? 'Ethereum'}, drawn on chain. Holders earn IMD by holding time.</p>
          </section>

          <NetworkBanner />
          <OwnerPanel />

          <div className="grid-2">
            <MintPanel />
            <ClaimPanel />
          </div>

          <MySwarmlers />
          <Gallery />

          <section className="card" id="pairing" aria-labelledby="pairing-title">
            <header>
              <h2 id="pairing-title">How pairing works</h2>
            </header>
            <ol className="steps">
              <li>Hold a Swarmler and an Identity MD in the same wallet.</li>
              <li>Have the activity reporter record recent, verified agent activity for that identity.</li>
              <li>Under Your Swarmlers, enter the identity ID and select Pair. A free claim pairs automatically.</li>
              <li>The artwork and metadata update with the agent's activity. Select Refresh metadata to nudge marketplaces.</li>
            </ol>
          </section>

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
    </>
  );
}
