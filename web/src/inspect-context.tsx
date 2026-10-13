import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface Inspect {
  id: number | null;
  /** Select an ID and bring the inspector into view. */
  open: (id: number) => void;
  set: (id: number | null) => void;
}

const Ctx = createContext<Inspect | null>(null);

export function InspectProvider({ children }: { children: ReactNode }) {
  const [id, set] = useState<number | null>(null);
  const open = useCallback((next: number) => {
    set(next);
    const el = document.getElementById('inspect');
    if (el) {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      const input = el.querySelector<HTMLInputElement>('input');
      input?.focus({ preventScroll: true });
    }
  }, []);
  const value = useMemo(() => ({ id, open, set }), [id, open]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInspect(): Inspect {
  const v = useContext(Ctx);
  if (!v) throw new Error('InspectProvider missing');
  return v;
}
