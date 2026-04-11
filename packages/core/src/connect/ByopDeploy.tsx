import { useState } from 'preact/hooks';
import { DEPLOY_TEMPLATES } from './deployTemplates.js';
import styles from '../components/ConnectScreen.module.css';

export interface ByopDeployProps {
  onSubmit: (proxyUrl: string) => void;
  onBack:   () => void;
}

/**
 * BYOP step: shows the three deploy targets with a short description each
 * and a single URL input for the user to paste the resulting proxy URL
 * into. The flow is:
 *
 *   1. User reads the three options and picks one (mentally, not in UI).
 *   2. User follows the README in proxies/<id>/ to deploy under their own
 *      cloud account.
 *   3. User pastes the resulting URL here and clicks Next.
 *
 * URL is validated for HTTPS scheme before proceeding — all cloud proxy
 * deployments must use HTTPS to avoid forwarding credentials in plaintext.
 */
export function ByopDeploy({ onSubmit, onBack }: ByopDeployProps) {
  const [url, setUrl]     = useState('');
  const [error, setError] = useState('');

  const handleNext = (e: Event) => {
    e.preventDefault();
    setError('');
    const trimmed = url.trim().replace(/\/$/, '');
    if (!trimmed) return;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:') {
        setError('Proxy URL must use HTTPS.');
        return;
      }
    } catch {
      setError('Enter a valid URL.');
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div>
      <h2 class={styles.stepHeading}>Deploy your own proxy</h2>
      <p class={styles.stepSub}>
        Stream includes ready-to-deploy proxy code for three cloud platforms.
        Pick whichever you already use (or the one with the simplest sign-up),
        follow the README, and paste the URL of the deployed proxy below.
      </p>

      <ul class={styles.deployList} role="list">
        {DEPLOY_TEMPLATES.map(t => (
          <li class={styles.deployItem} key={t.id}>
            <div class={styles.deployName}>{t.name}</div>
            <div class={styles.deployDesc}>{t.description}</div>
            <div class={styles.deployPath}>
              Source and instructions: <code>{t.repoPath}</code>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={handleNext} noValidate>
        <div class={styles.field}>
          <label class={styles.label} for="byop-url">Your proxy URL</label>
          <input
            id="byop-url"
            class={styles.input}
            type="url"
            placeholder="https://stream-proxy.example.workers.dev"
            value={url}
            onInput={e => setUrl((e.target as HTMLInputElement).value)}
            required
            autocomplete="off"
            spellcheck={false}
          />
          {error && <p class={styles.fieldError}>{error}</p>}
          <p class={styles.hint}>
            The root URL of the proxy you just deployed. No trailing slash.
          </p>
        </div>

        <div class={styles.buttonRow}>
          <button type="button" class={styles.secondary} onClick={onBack}>
            Back
          </button>
          <button type="submit" class={styles.submit} disabled={!url.trim()}>
            Next
          </button>
        </div>
      </form>
    </div>
  );
}
