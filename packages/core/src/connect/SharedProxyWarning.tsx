import styles from '../components/ConnectScreen.module.css';

export interface SharedProxyWarningProps {
  /** The hostname of the current origin, shown in the warning body. */
  origin:        string;
  onAcknowledge: () => void;
  onBack:        () => void;
}

/**
 * The user has picked "this site's shared proxy". Before they commit, we
 * explain what that actually means in plain language and require an
 * explicit acknowledgement. The intent is that anyone who clicks through
 * has understood the trade-off, so there can be no later surprise about
 * whose server their credentials passed through.
 */
export function SharedProxyWarning({
  origin,
  onAcknowledge,
  onBack,
}: SharedProxyWarningProps) {
  return (
    <div>
      <h2 class={styles.stepHeading}>Before you use this site's proxy</h2>

      <p class={styles.warnBody}>
        This page is served from <strong>{origin}</strong>. If you pick this
        option, every time Stream fetches from your RSS service, your username
        and password will be sent to a function running on that site's server
        on their way to Feedbin or FreshRSS.
      </p>

      <p class={styles.warnBody}>
        The proxy function itself does not log anything, but the hosting
        platform it runs on (Netlify, in the default deployment) records every
        invocation. Anyone with access to the hosting account could retrieve
        your credentials from those logs. For a personal deployment where
        you <em>are</em> the operator, that is fine. For a shared deployment
        like this one, you are trusting the operator of <strong>{origin}</strong>.
      </p>

      <p class={styles.warnBody}>
        If you would rather not make that trade, pick <em>Your own proxy</em>
        instead, or run Stream locally. Either way, the operator of this site
        will never see your credentials.
      </p>

      <div class={styles.buttonRow}>
        <button type="button" class={styles.secondary} onClick={onBack}>
          Go back
        </button>
        <button type="button" class={styles.submit} onClick={onAcknowledge}>
          I understand, use the shared proxy
        </button>
      </div>
    </div>
  );
}
