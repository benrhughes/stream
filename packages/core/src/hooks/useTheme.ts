import { useState, useEffect } from 'preact/hooks';

type ThemePreference = 'auto' | 'paper' | 'ink';
export type ResolvedTheme = 'paper' | 'ink';

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'ink' : 'paper';
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePreference>(() =>
    (localStorage.getItem('stream-theme') as ThemePreference) ?? 'auto'
  );

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  // Track OS-level changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setSystemTheme(mq.matches ? 'ink' : 'paper');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolved: ResolvedTheme = pref === 'auto' ? systemTheme : pref;

  // Apply to document root so theme.css selectors work
  useEffect(() => {
    if (resolved === 'ink') {
      document.documentElement.setAttribute('data-theme', 'ink');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [resolved]);

  const toggle = () => {
    const next: ThemePreference = resolved === 'paper' ? 'ink' : 'paper';
    localStorage.setItem('stream-theme', next);
    setPref(next);
  };

  return { theme: resolved, pref, toggle };
}
