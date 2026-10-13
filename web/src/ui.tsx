import type { ReactNode } from 'react';
import type { Address } from 'viem';
import { useDeployment } from './deployment-context';
import { explorerAddress, explorerTx, shortAddress } from './format';
import type { TxState } from './useTx';

export function Card({ title, lead, children, id }: { title: string; lead?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="card" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <header>
        <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
        {lead ? <p>{lead}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function Fact({ label, value, big, mono }: { label: string; value: ReactNode; big?: boolean; mono?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={[big ? 'big' : '', mono ? 'mono' : ''].join(' ').trim() || undefined}>{value}</dd>
    </div>
  );
}

export function AddressLink({ address, full }: { address: Address; full?: boolean }) {
  const dep = useDeployment();
  const href = explorerAddress(dep.network?.explorer, address);
  const text = full ? address : shortAddress(address);
  return href ? (
    <a className="mono" href={href} target="_blank" rel="noreferrer" title={address}>
      {text}
    </a>
  ) : (
    <span className="mono" title={address}>{text}</span>
  );
}

/** Transaction status beside the button that started it. */
export function TxStatus({ state, done }: { state: TxState; done?: string }) {
  const dep = useDeployment();
  if (state.phase === 'idle') return <div className="status" role="status" aria-live="polite" />;
  const tx = state.hash ? explorerTx(dep.network?.explorer, state.hash) : undefined;
  const link = state.hash ? (
    <span className="small">
      Transaction{' '}
      {tx ? (
        <a href={tx} target="_blank" rel="noreferrer" className="mono">{shortAddress(state.hash)}</a>
      ) : (
        <span className="mono">{shortAddress(state.hash)}</span>
      )}
    </span>
  ) : null;
  if (state.phase === 'error') {
    return (
      <div className="status error" role="alert">
        <span>{state.error}</span>
        {link}
      </div>
    );
  }
  if (state.phase === 'done') {
    return (
      <div className="status ok" role="status" aria-live="polite">
        <span>{done ?? 'Confirmed on chain.'}</span>
        {link}
      </div>
    );
  }
  return (
    <div className="status" role="status" aria-live="polite">
      <span>
        {state.phase === 'simulating' && 'Checking the call against the chain…'}
        {state.phase === 'signing' && 'Confirm the transaction in the wallet.'}
        {state.phase === 'mining' && 'Waiting for the transaction to be mined…'}
      </span>
      {link}
    </div>
  );
}

export function Notice({ kind, children }: { kind: 'ok' | 'warn' | 'error' | 'plain'; children: ReactNode }) {
  return (
    <div className={`status ${kind === 'plain' ? '' : kind}`} role={kind === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}
