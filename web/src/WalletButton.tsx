import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { shortAddress } from './format';

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  // Collapse duplicate "Injected" entries: EIP-6963 wallets each announce themselves.
  const options = connectors.filter((c, _i, arr) => c.id !== 'injected' || arr.length === 1);
  const hasWallet = options.length > 0;

  if (isConnected && address) {
    return (
      <div className="menu" ref={menuRef}>
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="mono" style={{ fontSize: 'var(--size-2)' }}>{shortAddress(address)}</span>
        </button>
        {open ? (
          <ul role="menu">
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  navigator.clipboard?.writeText(address).then(() => setCopied(true)).catch(() => setCopied(false));
                }}
              >
                {copied ? 'Address copied' : 'Copy address'}
              </button>
            </li>
            <li role="none">
              <button type="button" role="menuitem" onClick={() => { disconnect(); setOpen(false); }}>
                Disconnect
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="menu" ref={menuRef}>
      <button
        type="button"
        className="primary"
        aria-haspopup={options.length > 1 ? 'menu' : undefined}
        aria-expanded={options.length > 1 ? open : undefined}
        disabled={isPending || !hasWallet}
        title={hasWallet ? undefined : 'No browser wallet found'}
        onClick={() => {
          if (options.length === 1) connect({ connector: options[0] });
          else setOpen((o) => !o);
        }}
      >
        {isPending ? 'Connecting…' : hasWallet ? 'Connect wallet' : 'No wallet found'}
      </button>
      {open && options.length > 1 ? (
        <ul role="menu">
          {options.map((c) => (
            <li role="none" key={c.uid}>
              <button type="button" role="menuitem" onClick={() => { connect({ connector: c }); setOpen(false); }}>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <span className="visually-hidden" role="alert">{error.message}</span> : null}
    </div>
  );
}
