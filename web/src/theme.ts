/**
 * Theme: dark by default (the collection's artwork is drawn on a dark ground), light on request.
 * The choice is stored in localStorage and applied as `data-theme` on <html>; `index.html` applies
 * the stored value before first paint so there is no flash. "system" follows prefers-color-scheme.
 */
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
export type ThemeChoice = Theme | 'system';

export const THEME_KEY = 'swarmlers-theme';

function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export function resolveTheme(choice: ThemeChoice): Theme {
  return choice === 'system' ? systemTheme() : choice;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#090d19' : '#f4f5fa');
}

export function useTheme(): { theme: Theme; choice: ThemeChoice; setChoice: (c: ThemeChoice) => void } {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => readChoice());
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(readChoice()));

  useEffect(() => {
    const t = resolveTheme(choice);
    setTheme(t);
    applyTheme(t);
    if (choice !== 'system' || typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const next = resolveTheme('system');
      setTheme(next);
      applyTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [choice]);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    try {
      localStorage.setItem(THEME_KEY, c);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
  }, []);

  return { theme, choice, setChoice };
}
