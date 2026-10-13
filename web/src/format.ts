import { formatUnits, parseUnits, type Address } from 'viem';

/** Format a token amount in display units with at most `maxFraction` decimals, grouped thousands. */
export function formatAmount(value: bigint | undefined, decimals = 18, maxFraction = 4): string {
  if (value === undefined) return '…';
  const text = formatUnits(value, decimals);
  const [whole, fraction = ''] = text.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, '');
  if (!trimmed && grouped === '0' && value !== 0n) {
    // Smaller than the displayed precision: say so rather than showing a misleading zero.
    return `<0.${'0'.repeat(maxFraction - 1)}1`;
  }
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

/** Parse a user-typed decimal amount; returns null when it is not a valid positive number. */
export function parseAmount(text: string, decimals = 18): bigint | null {
  const t = text.trim();
  if (!/^\d*(\.\d*)?$/.test(t) || t === '' || t === '.') return null;
  try {
    const v = parseUnits(t, decimals);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function explorerAddress(explorer: string | undefined, address: Address): string | undefined {
  return explorer ? `${explorer.replace(/\/$/, '')}/address/${address}` : undefined;
}

export function explorerTx(explorer: string | undefined, hash: string): string | undefined {
  return explorer ? `${explorer.replace(/\/$/, '')}/tx/${hash}` : undefined;
}

export function formatDuration(seconds: bigint | number): string {
  const s = Number(seconds);
  if (!s) return '0';
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  if (days >= 1) return hours ? `${days} d ${hours} h` : `${days} d`;
  const minutes = Math.floor((s % 3_600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export function formatTimestamp(ts: bigint | number): string {
  const n = Number(ts);
  if (!n) return 'never';
  return new Date(n * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Decode a `data:application/json;base64,...` token URI into its JSON metadata. */
export function decodeTokenUri(uri: string): { name?: string; description?: string; image?: string; attributes?: { trait_type: string; value: string | number }[] } | null {
  try {
    if (uri.startsWith('data:application/json;base64,')) {
      return JSON.parse(atob(uri.slice('data:application/json;base64,'.length)));
    }
    if (uri.startsWith('data:application/json,')) {
      return JSON.parse(decodeURIComponent(uri.slice('data:application/json,'.length)));
    }
  } catch {
    return null;
  }
  return null;
}
