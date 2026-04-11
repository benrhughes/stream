import { useState } from 'preact/hooks';
import type { StreamAdapter, AdapterConfig, ConnectionMode } from '../types.js';
import { ModePicker, type PublicMode } from '../connect/ModePicker.js';
import { ByopDeploy } from '../connect/ByopDeploy.js';
import { SharedProxyWarning } from '../connect/SharedProxyWarning.js';
import styles from './ConnectScreen.module.css';

/**
 * Well-known proxy endpoint mounted at `stream.dynamicskillset.com` (and
 * any deployment that uses the bundled Netlify function). The shared-proxy
 * step sets `proxyBase` to this value.
 *
 * Exposed so that App.tsx can use the same constant for migration.
 */
export const SHARED_PROXY_BASE = '/.netlify/functions/proxy';

/**
 * Detect whether the current origin has a shared proxy. Right now that is
 * baked in at build time: the Netlify deployment mounts a function at the
 * path above. We probe existence cheaply by checking the window origin —
 * any origin that serves Stream's Netlify build is assumed to have the
 * function. Users running `npm run dev` get `dev` mode instead and never
 * see the shared-proxy option anyway.
 *
 * For local dev the dev proxy at `/dev-proxy` is always available and used
 * automatically, bypassing this entire flow.
 */
function sharedProxyAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return false;
  return true;
}

interface ConnectScreenProps {
  onConnect: (
    adapter: StreamAdapter,
    config:  AdapterConfig & { adapterId: string },
  ) => void;
  initialError?: string;
}

type Step =
  | { name: 'mode' }
  | { name: 'byop' }
  | { name: 'shared-warn' }
  | { name: 'credentials'; mode: ConnectionMode; proxyBase: string | null };

/**
 * Connect flow: first ask the user how Stream should reach the RSS backend,
 * then (depending on the mode) walk through either a BYOP deploy step or a
 * shared-proxy trust warning, then collect credentials.
 *
 * Dev mode bypasses all of this: the connect screen is seeded with `dev`
 * mode and `proxyBase = '/dev-proxy'` immediately so local development is
 * indistinguishable from before this change.
 */
export function ConnectScreen({ onConnect, initialError }: ConnectScreenProps) {
  const [step, setStep] = useState<Step>(() =>
    import.meta.env.DEV
      ? { name: 'credentials', mode: 'dev', proxyBase: '/dev-proxy' }
      : { name: 'mode' },
  );

  const handleModePick = (mode: PublicMode) => {
    if (mode === 'direct') {
      setStep({ name: 'credentials', mode: 'direct', proxyBase: null });
    } else if (mode === 'byop') {
      setStep({ name: 'byop' });
    } else {
      setStep({ name: 'shared-warn' });
    }
  };

  const handleByopSubmit = (proxyUrl: string) => {
    setStep({ name: 'credentials', mode: 'byop', proxyBase: proxyUrl });
  };

  const handleSharedAck = () => {
    setStep({ name: 'credentials', mode: 'shared', proxyBase: SHARED_PROXY_BASE });
  };

  const handleBack = () => setStep({ name: 'mode' });

  return (
    <div class={styles.wrap}>
      <div class={styles.card}>
        {step.name === 'mode' && (
          <>
            <h1 class={styles.heading}>Connect Stream</h1>
            <p class={styles.sub}>
              Stream connects to your existing RSS backend. Your credentials stay on
              your device.
            </p>
            <ModePicker
              sharedProxyAvailable={sharedProxyAvailable()}
              onPick={handleModePick}
            />
          </>
        )}

        {step.name === 'byop' && (
          <ByopDeploy onSubmit={handleByopSubmit} onBack={handleBack} />
        )}

        {step.name === 'shared-warn' && (
          <SharedProxyWarning
            origin={typeof window === 'undefined' ? '' : window.location.host}
            onAcknowledge={handleSharedAck}
            onBack={handleBack}
          />
        )}

        {step.name === 'credentials' && (
          <CredentialsForm
            mode={step.mode}
            proxyBase={step.proxyBase}
            initialError={initialError}
            onConnect={onConnect}
            onBack={step.mode === 'dev' ? null : handleBack}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Credentials form — backend tabs + username/password/URL fields.
// Renders only once the user has chosen a connection mode (or in dev, where
// the mode is fixed).
// ---------------------------------------------------------------------------

interface CredentialsFormProps {
  mode:         ConnectionMode;
  proxyBase:    string | null;
  initialError?: string;
  onConnect: (
    adapter: StreamAdapter,
    config:  AdapterConfig & { adapterId: string },
  ) => void;
  /** If provided, a Back button is shown to return to the mode picker. */
  onBack: (() => void) | null;
}

function CredentialsForm({
  mode,
  proxyBase,
  initialError,
  onConnect,
  onBack,
}: CredentialsFormProps) {
  // Feedbin is hidden when the user picked Direct: it cannot possibly work,
  // so we don't let them waste time filling in the form.
  const feedbinAllowed = mode !== 'direct';

  const [backend, setBackend] = useState<'freshrss' | 'feedbin'>('freshrss');
  const [url, setUrl]         = useState('');
  const [user, setUser]       = useState('');
  const [pass, setPass]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(initialError ?? '');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let adapter: StreamAdapter;
      let config:  AdapterConfig;

      if (backend === 'feedbin') {
        const { FeedbinAdapter } = await import('../adapters/feedbin.js');
        adapter = new FeedbinAdapter(proxyBase);
        config  = { username: user, password: pass };
      } else {
        const { FreshRSSAdapter } = await import('../adapters/freshrss.js');
        adapter = new FreshRSSAdapter(proxyBase);
        config  = { baseUrl: url.replace(/\/$/, ''), username: user, password: pass };
      }

      const result = await adapter.authenticate(config);

      if (!result.success) {
        setError(result.error ?? friendlyFailureHint(mode));
        return;
      }

      onConnect(adapter, {
        ...config,
        adapterId:      backend,
        connectionMode: mode,
        proxyBase,
      });
    } catch (err) {
      // `fetch` throws a TypeError when CORS blocks the response. We can't
      // see the underlying reason (the spec deliberately hides it), so we
      // give the user a mode-aware hint instead of a raw error message.
      setError(err instanceof Error ? `${err.message}. ${friendlyFailureHint(mode)}` : friendlyFailureHint(mode));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!onBack && (
        <>
          <h1 class={styles.heading}>Connect Stream</h1>
          <p class={styles.sub}>
            Stream connects to your existing RSS backend. Your credentials stay on
            your device.
          </p>
        </>
      )}

      <div class={styles.tabs} role="tablist">
        <button
          id="tab-freshrss"
          type="button"
          class={`${styles.tab} ${backend === 'freshrss' ? styles.active : ''}`}
          role="tab"
          aria-selected={backend === 'freshrss'}
          aria-controls="panel-connect"
          onClick={() => setBackend('freshrss')}
        >
          FreshRSS
        </button>
        <button
          id="tab-feedbin"
          type="button"
          class={`${styles.tab} ${backend === 'feedbin' ? styles.active : ''} ${!feedbinAllowed ? styles.disabled : ''}`}
          role="tab"
          aria-selected={backend === 'feedbin'}
          aria-controls="panel-connect"
          onClick={() => feedbinAllowed && setBackend('feedbin')}
          disabled={!feedbinAllowed}
          title={feedbinAllowed ? undefined : 'Feedbin needs a proxy — pick BYOP or the shared proxy.'}
        >
          Feedbin
        </button>
      </div>

      <form id="panel-connect" role="tabpanel" aria-labelledby={`tab-${backend}`} onSubmit={handleSubmit} noValidate>
        {backend === 'freshrss' && (
          <div class={styles.field}>
            <label class={styles.label} for="freshrss-url">Server URL (root, not /api)</label>
            <input
              id="freshrss-url"
              class={styles.input}
              type="url"
              placeholder="https://freshrss.example.com"
              value={url}
              onInput={e => setUrl((e.target as HTMLInputElement).value)}
              required
              autocomplete="url"
              spellcheck={false}
            />
          </div>
        )}

        <div class={styles.field}>
          <label class={styles.label} for="stream-user">Username</label>
          <input
            id="stream-user"
            class={styles.input}
            type="text"
            placeholder="you@example.com"
            value={user}
            onInput={e => setUser((e.target as HTMLInputElement).value)}
            required
            autocomplete="username"
            spellcheck={false}
          />
        </div>

        <div class={styles.field}>
          <label class={styles.label} for="stream-pass">
            {backend === 'freshrss' ? 'API password' : 'Password'}
          </label>
          <input
            id="stream-pass"
            class={styles.input}
            type="password"
            placeholder="••••••••"
            value={pass}
            onInput={e => setPass((e.target as HTMLInputElement).value)}
            required
            autocomplete="current-password"
          />
          {backend === 'freshrss' && (
            <p class={styles.hint}>
              Not your login password — set one under Settings → Profile → API management.
            </p>
          )}
        </div>

        {error && <p class={styles.error} role="alert">{error}</p>}

        <div class={styles.buttonRow}>
          {onBack && (
            <button type="button" class={styles.secondary} onClick={onBack}>
              Back
            </button>
          )}
          <button class={styles.submit} type="submit" disabled={loading}>
            {loading && <span class={styles.spinner} aria-hidden="true" />}
            {loading ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </form>
    </>
  );
}

/**
 * A mode-aware suggestion to show when authentication fails. For Direct
 * mode this almost always means CORS blocked the request; for BYOP it
 * usually means the proxy URL is wrong or the proxy isn't running; for
 * Shared mode it generally means the credentials are bad.
 */
function friendlyFailureHint(mode: ConnectionMode): string {
  switch (mode) {
    case 'direct':
      return 'Could not reach your server directly — most likely the server is not sending CORS headers. Go back and try "Your own proxy" instead.';
    case 'byop':
      return 'Could not reach your proxy. Double-check the URL, and make sure the proxy is deployed and running.';
    case 'shared':
      return 'Could not connect. Check your credentials.';
    case 'dev':
      return 'Could not connect. Check your credentials and that the dev proxy is running.';
  }
}
