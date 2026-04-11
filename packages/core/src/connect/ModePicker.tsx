import type { ConnectionMode } from '../types.js';
import styles from '../components/ConnectScreen.module.css';

/**
 * Modes offered to the user during first-run setup.
 *
 * `'dev'` is intentionally not listed here — it is selected automatically
 * when Stream runs under Vite's dev server and never surfaced in the UI.
 */
export type PublicMode = Exclude<ConnectionMode, 'dev'>;

export interface ModePickerProps {
  /** Whether this origin has a shared proxy to offer. */
  sharedProxyAvailable: boolean;
  /** Called when the user picks a mode and clicks Next. */
  onPick: (mode: PublicMode) => void;
}

/**
 * First step of the connect flow: asks the user how Stream should reach
 * their RSS service. The three modes all have honest trade-offs and are
 * labelled accordingly. Direct is recommended because it has the strongest
 * trust story and no operator dependency.
 */
export function ModePicker({ sharedProxyAvailable, onPick }: ModePickerProps) {
  return (
    <div>
      <h2 class={styles.stepHeading}>How should Stream reach your RSS service?</h2>
      <p class={styles.stepSub}>
        Stream is a frontend. To fetch your articles it needs to talk to Feedbin or
        FreshRSS on your behalf, and browsers will not let it do that cross-origin
        without help. Pick the option that fits you.
      </p>

      <ul class={styles.modeList} role="list">
        <li>
          <button
            type="button"
            class={styles.modeCard}
            onClick={() => onPick('direct')}
          >
            <span class={styles.modeHead}>
              <span class={styles.modeName}>Direct</span>
              <span class={styles.modeTag}>recommended</span>
            </span>
            <span class={styles.modeBody}>
              The browser talks to your FreshRSS server directly. No proxy, nothing
              for anyone else to log. Only works if your server sends CORS headers.
              Does not work for Feedbin.
            </span>
          </button>
        </li>

        <li>
          <button
            type="button"
            class={styles.modeCard}
            onClick={() => onPick('byop')}
          >
            <span class={styles.modeHead}>
              <span class={styles.modeName}>Your own proxy</span>
            </span>
            <span class={styles.modeBody}>
              Deploy a tiny proxy under your own Cloudflare, Deno Deploy, or Vercel
              account. A few minutes the first time, instant thereafter. Works for
              both Feedbin and FreshRSS.
            </span>
          </button>
        </li>

        {sharedProxyAvailable && (
          <li>
            <button
              type="button"
              class={`${styles.modeCard} ${styles.modeCardWarn}`}
              onClick={() => onPick('shared')}
            >
              <span class={styles.modeHead}>
                <span class={styles.modeName}>This site's shared proxy</span>
                <span class={`${styles.modeTag} ${styles.modeTagWarn}`}>read first</span>
              </span>
              <span class={styles.modeBody}>
                Fastest to set up, but your credentials pass through a server
                operated by whoever runs this site. We will explain the trade-off
                before you commit.
              </span>
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
