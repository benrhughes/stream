import type { ComponentChildren } from 'preact';
import type { ResolvedTheme } from '../hooks/useTheme.js';
import styles from './AppShell.module.css';

// Sun = paper (light), crescent = ink (dark)
const THEME_ICON: Record<ResolvedTheme, string> = {
  paper: '☽',
  ink:   '☀',
};
const THEME_LABEL: Record<ResolvedTheme, string> = {
  paper: 'Switch to dark mode',
  ink:   'Switch to light mode',
};

interface AppShellProps {
  theme: ResolvedTheme;
  onToggleTheme: () => void;
  children: ComponentChildren;
}

export function AppShell({ theme, onToggleTheme, children }: AppShellProps) {
  return (
    <>
      <header class={styles.header}>
        <div class={styles.inner}>
          <span class={styles.wordmark}>Stream</span>
          <div class={styles.controls}>
            <button
              class={styles.themeBtn}
              onClick={onToggleTheme}
              aria-label={THEME_LABEL[theme]}
              title={THEME_LABEL[theme]}
            >
              {THEME_ICON[theme]}
            </button>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
