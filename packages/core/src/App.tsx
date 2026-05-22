import { useState, useEffect, useCallback, useRef, useMemo } from 'preact/hooks';
import { scoreRiver, HALF_LIVES } from './riverEngine.js';
import { useRiver } from './hooks/useRiver.js';
import { useTheme } from './hooks/useTheme.js';
import { River } from './components/River.js';
import { AppShell } from './components/AppShell.js';
import { ConnectScreen, SHARED_PROXY_BASE } from './components/ConnectScreen.js';
import connectStyles from './components/ConnectScreen.module.css';
import { Settings } from './components/Settings.js';
import { ReadingView } from './components/ReadingView.js';
import { KeyboardHelp } from './components/KeyboardHelp.js';
import { FilterBar } from './components/FilterBar.js';
import { loadDisplayPrefs, applyDisplayPrefs } from './displayPrefs.js';
import { saveCache, loadCache } from './articleCache.js';
import { activeMutedIds, muteSource, unmuteSource, cleanExpiredMutes, getMutedSources, type MuteEntry } from './mutedSources.js';
import { purgeDismissed } from './dismissedArticles.js';
import { isPaused, pauseRiver, resumeRiver, effectiveNow } from './quietHours.js';
import { logArticleOpen, generateSuggestions, dismissSuggestion, type VelocitySuggestion } from './velocitySuggestions.js';
import type { Article, Category, Source, StreamAdapter, AdapterConfig } from './types.js';
import './theme.css';

// ---------------------------------------------------------------------------
// Velocity config — stored in localStorage, keyed by sourceId
// ---------------------------------------------------------------------------

const VELOCITY_KEY = 'stream-velocity';

type VelocityEntry = { tier: 1|2|3|4|5; isVoice: boolean };
type VelocityConfig = Record<string, VelocityEntry>;

function loadVelocityConfig(): VelocityConfig {
  try {
    return JSON.parse(localStorage.getItem(VELOCITY_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveVelocityConfig(cfg: VelocityConfig): void {
  localStorage.setItem(VELOCITY_KEY, JSON.stringify(cfg));
}

function applySavedVelocity(sources: Source[], cfg: VelocityConfig): Source[] {
  const updated: VelocityConfig = { ...cfg };
  const merged = sources.map(s => {
    const saved = cfg[s.id];
    if (!saved) {
      // First time seeing this source — save default
      updated[s.id] = { tier: 3, isVoice: false };
      return s;
    }
    return { ...s, velocityTier: saved.tier, isVoice: saved.isVoice };
  });
  saveVelocityConfig(updated);
  return merged;
}

// ---------------------------------------------------------------------------
// Connection config — stored in localStorage (password included)
// The PRD explicitly allows local credential storage for the web app.
// ---------------------------------------------------------------------------

const CONNECTION_KEY = 'stream-connection';
const MIGRATION_BANNER_DISMISSED_KEY = 'stream-migration-banner-dismissed';

type SavedConnection = AdapterConfig & { adapterId: string };

/**
 * Loads the persisted connection and backfills fields that did not exist
 * in older versions of Stream.
 *
 * Pre-0.10 saves have no `connectionMode` or `proxyBase` — they implicitly
 * used the shared Netlify proxy on production builds. We mark those as
 * `shared` mode and point them at `SHARED_PROXY_BASE` so the adapters keep
 * working without the user noticing. A one-time banner on the ready screen
 * nudges them toward a stronger trust mode.
 *
 * In dev builds the same legacy blobs get rewritten to `dev` mode with the
 * Vite dev proxy, so running `npm run dev` on an old localStorage keeps
 * working without any user action.
 */
function loadSavedConnection(): SavedConnection | null {
  try {
    const raw = localStorage.getItem(CONNECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedConnection;

    if (parsed.connectionMode === undefined) {
      parsed.connectionMode = import.meta.env.DEV ? 'dev' : 'shared';
      parsed.proxyBase = import.meta.env.DEV ? '/dev-proxy' : SHARED_PROXY_BASE;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Article fetching — paginated, respects 2× max half-life fetch window
// ---------------------------------------------------------------------------

/** Widest possible fetch window — covers tier-5 sources (168h half-life) × 2. */
const CONSERVATIVE_SINCE = (): Date =>
  new Date(Date.now() - 2 * HALF_LIVES[5] * 3_600_000);

function articlesWindow(sources: Source[]): Date {
  const maxHalfLife = sources.reduce(
    (max, s) => Math.max(max, s.customHalfLife ?? HALF_LIVES[s.velocityTier]),
    HALF_LIVES[3],
  );
  return new Date(Date.now() - 2 * maxHalfLife * 3_600_000);
}

async function fetchAllArticles(
  adapter: StreamAdapter,
  since: Date,
): Promise<Article[]> {
  const articles: Article[] = [];
  let continuation: string | undefined;

  do {
    const result = await adapter.fetchArticles({ since, limit: 100, continuation });
    articles.push(...result.articles);
    continuation = result.continuation;

    // Stop pagination once we've gone past the fetch window
    const oldest = result.articles.at(-1);
    if (oldest && oldest.publishedAt < since) break;
  } while (continuation);

  return articles;
}

// ---------------------------------------------------------------------------
// App state machine
// ---------------------------------------------------------------------------

type AppState =
  | { status: 'connect';   error?: string }
  | { status: 'loading';   adapter: StreamAdapter }
  | { status: 'ready';     adapter: StreamAdapter; sources: Source[]; articles: Article[]; categories: Category[] }
  | { status: 'settings';  adapter: StreamAdapter; sources: Source[]; articles: Article[]; categories: Category[] }
  | { status: 'error';     message: string };

export function App() {
  const { theme, toggle } = useTheme();
  const [state, setState] = useState<AppState>(
    loadSavedConnection() ? { status: 'loading', adapter: null! } : { status: 'connect' },
  );
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [mutedIds, setMutedIds] = useState<Set<string>>(() => {
    cleanExpiredMutes();
    purgeDismissed();
    return activeMutedIds();
  });
  const [mutedEntries, setMutedEntries] = useState<MuteEntry[]>(() => getMutedSources());
  const [paused, setPaused] = useState(() => isPaused());
  const [suggestions, setSuggestions] = useState<VelocitySuggestion[]>([]);
  const [expiryDays, setExpiryDays] = useState(() => loadDisplayPrefs().expiryDays);

  /**
   * Migration banner visibility. Shown once to users whose saved connection
   * came from a pre-0.10 Stream build and therefore implicitly runs in
   * `shared` mode. Dismissal is persisted so the banner never reappears.
   */
  const [showMigrationBanner, setShowMigrationBanner] = useState(() => {
    if (import.meta.env.DEV) return false;
    if (localStorage.getItem(MIGRATION_BANNER_DISMISSED_KEY) === '1') return false;
    const saved = loadSavedConnection();
    return saved?.connectionMode === 'shared';
  });

  const dismissMigrationBanner = useCallback(() => {
    localStorage.setItem(MIGRATION_BANNER_DISMISSED_KEY, '1');
    setShowMigrationBanner(false);
  }, []);

  const switchFromSharedProxy = useCallback(() => {
    // Clear the saved connection and bounce back to the connect screen,
    // where the user picks a new mode. Their previous credentials are
    // deliberately not preserved — re-entering them is the honest reset.
    localStorage.removeItem(CONNECTION_KEY);
    localStorage.setItem(MIGRATION_BANNER_DISMISSED_KEY, '1');
    setShowMigrationBanner(false);
    setState({ status: 'connect' });
  }, []);

  // Apply saved display prefs on mount (text size, fade intensity, accent colour)
  useEffect(() => {
    applyDisplayPrefs(loadDisplayPrefs());
  }, []);

  // Live score recalculation every 60s — pauses when tab is hidden
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!id) id = setInterval(() => setNow(Date.now()), 60_000); };
    const stop  = () => { if (id) { clearInterval(id); id = null; } };
    const onVis = () => { document.hidden ? stop() : (setNow(Date.now()), start()); };

    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const loadData = useCallback(async (adapter: StreamAdapter) => {
    const cache = loadCache();

    if (cache) {
      // Serve cached river immediately — returning users see content at once
      setState({ status: 'ready', adapter, sources: cache.sources, articles: cache.articles, categories: cache.categories });
      setRefreshing(true);
      try {
        // Fetch sources, articles, and categories in parallel.
        // Articles use the conservative window so they can start without waiting
        // for sources; we trim to the accurate window after sources arrive.
        const [rawSources, articlesRaw, categories] = await Promise.all([
          adapter.fetchSources(),
          fetchAllArticles(adapter, CONSERVATIVE_SINCE()),
          adapter.fetchCategories().catch(() => [] as Category[]),
        ]);
        const sources = applySavedVelocity(rawSources, loadVelocityConfig());
        const window  = articlesWindow(sources);
        const articles = articlesRaw.filter(a => a.publishedAt >= window);
        saveCache({ articles, sources, categories });
        setState(prev =>
          prev.status === 'ready'
            ? { ...prev, sources, articles, categories }
            : prev,
        );
      } catch {
        // Network failure — keep showing cached data, user can manually refresh
      } finally {
        setRefreshing(false);
      }
    } else {
      // First run or cache cleared — show loading skeleton until data arrives
      setState({ status: 'loading', adapter });
      try {
        const [rawSources, articlesRaw, categories] = await Promise.all([
          adapter.fetchSources(),
          fetchAllArticles(adapter, CONSERVATIVE_SINCE()),
          adapter.fetchCategories().catch(() => [] as Category[]),
        ]);
        const sources  = applySavedVelocity(rawSources, loadVelocityConfig());
        const window   = articlesWindow(sources);
        const articles = articlesRaw.filter(a => a.publishedAt >= window);
        saveCache({ articles, sources, categories });
        setState({ status: 'ready', adapter, sources, articles, categories });
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to load articles.',
        });
      }
    }
  }, []);

  const handleConnect = useCallback(async (
    adapter: StreamAdapter,
    config: SavedConnection,
  ) => {
    localStorage.setItem(CONNECTION_KEY, JSON.stringify(config));
    await loadData(adapter);
  }, [loadData]);

  const handleSettings = useCallback(() => {
    setState(prev => {
      if (prev.status === 'ready') return { ...prev, status: 'settings' };
      if (prev.status === 'settings') {
        window.scrollTo({ top: 0, behavior: 'instant' });
        return { ...prev, status: 'ready' };
      }
      return prev;
    });
  }, []);

  const handleImported = useCallback(async () => {
    setState(prev => {
      if (prev.status !== 'settings') return prev;
      // Re-fetch sources async and update state when done
      applySavedVelocity([], loadVelocityConfig()); // no-op, just ensures cfg is initialised
      prev.adapter.fetchSources().then(raw => {
        const sources = applySavedVelocity(raw, loadVelocityConfig());
        setState(p => p.status === 'settings' ? { ...p, sources } : p);
      }).catch(() => {});
      return prev;
    });
  }, []);

  const handleVelocityUpdate = useCallback((sourceId: string, tier: 1|2|3|4|5) => {
    setState(prev => {
      if (prev.status !== 'settings' && prev.status !== 'ready') return prev;
      const cfg = loadVelocityConfig();
      cfg[sourceId] = { tier, isVoice: cfg[sourceId]?.isVoice ?? false };
      saveVelocityConfig(cfg);
      const sources = prev.sources.map(s =>
        s.id === sourceId ? { ...s, velocityTier: tier } : s
      );
      return { ...prev, sources };
    });
  }, []);

  const handleBulkVelocityUpdate = useCallback((changes: Array<{ sourceId: string; tier: 1|2|3|4|5 }>) => {
    setState(prev => {
      if (prev.status !== 'settings' && prev.status !== 'ready') return prev;
      const cfg = loadVelocityConfig();
      const tierMap = new Map(changes.map(c => [c.sourceId, c.tier]));
      for (const c of changes) {
        cfg[c.sourceId] = { tier: c.tier, isVoice: cfg[c.sourceId]?.isVoice ?? false };
      }
      saveVelocityConfig(cfg);
      const sources = prev.sources.map(s =>
        tierMap.has(s.id) ? { ...s, velocityTier: tierMap.get(s.id)! } : s
      );
      return { ...prev, sources };
    });
  }, []);

  const handleCategoryChange = useCallback(async (sourceId: string, categoryId: string) => {
    const s = stateRef.current;
    if (s.status !== 'settings') return;
    const adapter = s.adapter;

    // FreshRSS expects the full label stream ID; new names need the prefix added
    let backendCategoryId = categoryId;
    if (adapter.id === 'freshrss' && !categoryId.startsWith('user/-/label/')) {
      backendCategoryId = `user/-/label/${categoryId}`;
    }

    try {
      await adapter.setSourceCategory(sourceId, backendCategoryId);
      // Re-fetch so the updated categoryId and any new category appear in state
      const rawSources = await adapter.fetchSources();
      const sources    = applySavedVelocity(rawSources, loadVelocityConfig());
      const categories = await adapter.fetchCategories().catch(() => [] as Category[]);
      setState(prev =>
        prev.status === 'settings' ? { ...prev, sources, categories } : prev
      );
    } catch {
      // Silent fail — source row will remain unchanged until next refresh
    }
  }, []);

  /** Bulk version: fires all writes concurrently, then re-fetches once. */
  const handleBulkCategoryChange = useCallback(async (
    changes: Array<{ sourceId: string; categoryName: string }>,
  ) => {
    const s = stateRef.current;
    if (s.status !== 'settings') return;
    const adapter = s.adapter;

    await Promise.all(changes.map(({ sourceId, categoryName }) => {
      let backendId = categoryName;
      if (adapter.id === 'freshrss' && !categoryName.startsWith('user/-/label/')) {
        backendId = `user/-/label/${categoryName}`;
      }
      return adapter.setSourceCategory(sourceId, backendId).catch(() => {});
    }));

    const rawSources = await adapter.fetchSources();
    const sources    = applySavedVelocity(rawSources, loadVelocityConfig());
    const categories = await adapter.fetchCategories().catch(() => [] as Category[]);
    setState(prev =>
      prev.status === 'settings' ? { ...prev, sources, categories } : prev
    );
  }, []);

  const handleRefresh = useCallback(async () => {
    const s = stateRef.current;
    if (s.status !== 'ready') return;
    setRefreshing(true);
    try {
      const [rawSources, articlesRaw, categories] = await Promise.all([
        s.adapter.fetchSources(),
        fetchAllArticles(s.adapter, CONSERVATIVE_SINCE()),
        s.adapter.fetchCategories().catch(() => [] as Category[]),
      ]);
      const sources  = applySavedVelocity(rawSources, loadVelocityConfig());
      const window   = articlesWindow(sources);
      const articles = articlesRaw.filter(a => a.publishedAt >= window);
      saveCache({ articles, sources, categories });
      setState(prev =>
        prev.status === 'ready'
          ? { ...prev, sources, articles, categories }
          : prev
      );
    } catch {
      // Silent fail on refresh — keep existing data
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleTogglePause = useCallback(() => {
    if (isPaused()) {
      resumeRiver();
      setPaused(false);
    } else {
      pauseRiver();
      setPaused(true);
    }
    setNow(Date.now()); // force recompute of effectiveNow
  }, []);

  const handleMute = useCallback((sourceId: string, mutedUntil: number) => {
    const s = stateRef.current;
    const src = (s.status === 'ready' || s.status === 'settings')
      ? s.sources.find(sr => sr.id === sourceId)
      : undefined;
    muteSource(sourceId, src?.title ?? sourceId, mutedUntil);
    setMutedIds(prev => new Set([...prev, sourceId]));
    setMutedEntries(getMutedSources());
  }, []);

  const handleTogglePin = useCallback((sourceId: string, pinned: boolean) => {
    setState(prev => {
      if (prev.status !== 'settings' && prev.status !== 'ready') return prev;
      const cfg = loadVelocityConfig();
      cfg[sourceId] = { tier: cfg[sourceId]?.tier ?? 3, isVoice: pinned };
      saveVelocityConfig(cfg);
      const sources = prev.sources.map(s =>
        s.id === sourceId ? { ...s, isVoice: pinned } : s
      );
      return { ...prev, sources };
    });
  }, []);

  const handleDeleteSource = useCallback(async (sourceId: string) => {
    const s = stateRef.current;
    if (s.status !== 'settings') return;
    await s.adapter.removeSource(sourceId);
    const rawSources = await s.adapter.fetchSources();
    const sources = applySavedVelocity(rawSources, loadVelocityConfig());
    const categories = await s.adapter.fetchCategories().catch(() => [] as Category[]);
    setState(prev =>
      prev.status === 'settings'
        ? { ...prev, sources, categories, articles: prev.articles.filter(a => a.sourceId !== sourceId) }
        : prev
    );
  }, []);

  const handleUnmute = useCallback((sourceId: string) => {
    unmuteSource(sourceId);
    setMutedIds(prev => { const next = new Set(prev); next.delete(sourceId); return next; });
    setMutedEntries(getMutedSources());
  }, []);

  // Auto-connect on mount if credentials are saved.
  // Adapters are dynamically imported so only the one in use is parsed at startup.
  useEffect(() => {
    const saved = loadSavedConnection();
    if (!saved) return;

    const proxyBase = saved.proxyBase ?? null;
    const importAdapter = saved.adapterId === 'feedbin'
      ? import('./adapters/feedbin.js').then(m => new m.FeedbinAdapter(proxyBase))
      : import('./adapters/freshrss.js').then(m => new m.FreshRSSAdapter(proxyBase));

    importAdapter.then(adapter =>
      adapter.authenticate(saved).then(result => {
        if (result.success) {
          loadData(adapter);
        } else {
          setState({ status: 'connect', error: 'Session expired. Please reconnect.' });
        }
      })
    ).catch(() => {
      setState({ status: 'connect', error: 'Could not reach your server.' });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Render
  const isReady    = state.status === 'ready' || state.status === 'settings';
  const inSettings = state.status === 'settings';

  return (
    <>
      <AppShell
        theme={theme}
        onToggleTheme={toggle}
        onRefresh={isReady ? handleRefresh : undefined}
        refreshing={refreshing}
        onSettings={isReady ? handleSettings : undefined}
        inSettings={inSettings}
        onLogoClick={inSettings ? handleSettings : undefined}
        paused={isReady ? paused : undefined}
        onTogglePause={isReady ? handleTogglePause : undefined}
      >
        {state.status === 'connect' && (
          <ConnectScreen
            onConnect={handleConnect}
            initialError={state.error}
          />
        )}

        {state.status === 'loading' && (
          <LoadingView />
        )}

        {state.status === 'error' && (
          <ErrorView
            message={state.message}
            onRetry={() => setState({ status: 'connect' })}
          />
        )}

        {(state.status === 'ready' || state.status === 'settings') && (
          <>
            {showMigrationBanner && (
              <MigrationBanner
                onSwitch={switchFromSharedProxy}
                onDismiss={dismissMigrationBanner}
              />
            )}
            <ReadyView
              adapter={state.adapter}
              sources={state.sources}
              articles={state.articles}
              categories={state.categories}
              now={effectiveNow(now)}
              hidden={inSettings}
              mutedIds={mutedIds}
              onMute={handleMute}
              expiryDays={expiryDays}
            />
            {inSettings && (
              <Settings
                sources={state.sources}
                categories={state.categories}
                adapter={state.adapter}
                onUpdate={handleVelocityUpdate}
                onBulkVelocityUpdate={handleBulkVelocityUpdate}
                onCategoryChange={handleCategoryChange}
                onBulkCategoryChange={handleBulkCategoryChange}
                onImported={handleImported}
                mutedEntries={mutedEntries}
                onUnmute={handleUnmute}
                suggestions={generateSuggestions(state.sources)}
                onApplySuggestion={(sourceId, tier) => {
                  handleVelocityUpdate(sourceId, tier);
                  dismissSuggestion(sourceId);
                  setSuggestions(generateSuggestions(state.sources));
                }}
                onDismissSuggestion={(sourceId) => {
                  dismissSuggestion(sourceId);
                  setSuggestions(generateSuggestions(state.sources));
                }}
                onDeleteSource={handleDeleteSource}
                onExpiryChange={setExpiryDays}
                onTogglePin={handleTogglePin}
              />
            )}
          </>
        )}
      </AppShell>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

/**
 * One-time nudge shown to users whose saved connection was created by a
 * pre-0.10 Stream build. Those connections implicitly use the shared
 * Netlify proxy on production. The banner explains in one line and offers
 * a switch or a dismiss.
 *
 * Uses the same CSS module as the connect screen so the styling stays in
 * one place.
 */
function MigrationBanner({
  onSwitch,
  onDismiss,
}: {
  onSwitch:  () => void;
  onDismiss: () => void;
}) {
  return (
    <div class={connectStyles.migrationBanner} role="status">
      <span class={connectStyles.migrationBannerText}>
        Your connection is routed through this site's shared proxy, which means
        its operator can read your credentials. You can switch to a private mode.
      </span>
      <span class={connectStyles.migrationBannerActions}>
        <button type="button" class={connectStyles.migrationBannerButton} onClick={onSwitch}>
          Switch
        </button>
        <button type="button" class={connectStyles.migrationBannerDismiss} onClick={onDismiss} aria-label="Dismiss">
          Dismiss
        </button>
      </span>
    </div>
  );
}

function LoadingView() {
  return (
    <div role="status" aria-label="Loading your stream" style={{ maxWidth: '680px', margin: '0 auto', padding: '1rem 1rem 5rem' }}>
      {[0, 1, 2, 3, 4].map(i => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{
      position: 'relative',
      background: 'var(--surface)',
      padding: '0.75rem 1rem 0.75rem calc(0.875rem + 4px)',
      marginBottom: '2px',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      {/* age bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
        background: 'var(--border)', borderRadius: 'var(--radius) 0 0 var(--radius)',
      }} />
      {/* header row: favicon + source name + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
        <div style={{ width: '16px', height: '16px', borderRadius: '2px', background: 'var(--border)', flexShrink: 0 }} class="skeleton-pulse" />
        <div style={{ width: '90px', height: '10px', borderRadius: '3px', background: 'var(--border)' }} class="skeleton-pulse" />
        <div style={{ width: '40px', height: '10px', borderRadius: '3px', background: 'var(--border)', marginLeft: 'auto' }} class="skeleton-pulse" />
      </div>
      {/* title */}
      <div style={{ height: '14px', borderRadius: '3px', background: 'var(--border)', marginBottom: '0.375rem' }} class="skeleton-pulse" />
      <div style={{ height: '14px', borderRadius: '3px', background: 'var(--border)', width: '75%', marginBottom: '0.375rem' }} class="skeleton-pulse" />
      {/* preview */}
      <div style={{ height: '12px', borderRadius: '3px', background: 'var(--border)', width: '90%', marginBottom: '0.25rem' }} class="skeleton-pulse" />
      <div style={{ height: '12px', borderRadius: '3px', background: 'var(--border)', width: '60%' }} class="skeleton-pulse" />
    </div>
  );
}

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
}

function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      minHeight: 'calc(100vh - 57px)',
      padding: '2rem',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-muted)',
      textAlign: 'center',
    }}>
      <p style={{ margin: 0, fontSize: '0.9375rem' }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          padding: '0.5rem 1rem',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--bg)',
          background: 'var(--accent-new)',
          borderRadius: 'var(--radius)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Reconnect
      </button>
    </div>
  );
}

interface ReadyViewProps {
  adapter: StreamAdapter;
  sources: Source[];
  articles: Article[];
  categories: Category[];
  now: number;
  hidden?: boolean;
  mutedIds: Set<string>;
  onMute: (sourceId: string, mutedUntil: number) => void;
  expiryDays: number;
}

function ReadyView({ adapter, sources, articles, categories, now, hidden, mutedIds, onMute, expiryDays }: ReadyViewProps) {
  const CATEGORY_KEY = 'stream-active-category';

  const [openArticle, setOpenArticle]       = useState<Article | null>(null);
  const [showHelp, setShowHelp]             = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(() => {
    try { return localStorage.getItem(CATEGORY_KEY) ?? null; } catch { return null; }
  });
  const [unreadOnly, setUnreadOnly]         = useState(false);
  const [savedOnly, setSavedOnly]           = useState(false);
  const [starredOverrides, setStarredOverrides] = useState<Map<string, boolean>>(new Map());

  // Global '?' shortcut — only when not typing in an input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input, textarea, select, [contenteditable]')) return;
      if (e.key === '?') { e.preventDefault(); setShowHelp(prev => !prev); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const sourceMap = useMemo(
    () => new Map(sources.map(s => [s.id, s])),
    [sources],
  );

  const expiryCutoff = expiryDays > 0
    ? new Date(now - expiryDays * 24 * 60 * 60 * 1000)
    : null;

  const filteredArticles = useMemo(() => articles.filter(a => {
    if (mutedIds.has(a.sourceId)) return false;
    const starred = starredOverrides.has(a.id) ? starredOverrides.get(a.id) : a.isStarred;
    if (savedOnly && !starred) return false;
    if (unreadOnly && a.isRead) return false;
    if (expiryCutoff && !starred && a.publishedAt < expiryCutoff) return false;
    if (activeCategory !== null) {
      const src = sourceMap.get(a.sourceId);
      if (!src || src.categoryId !== activeCategory) return false;
    }
    return true;
  }), [articles, mutedIds, starredOverrides, savedOnly, unreadOnly, expiryCutoff, activeCategory, sourceMap]);

  const scoredItems = useMemo(() => savedOnly
    ? scoreRiver(filteredArticles, sourceMap, now, true)
    : scoreRiver(filteredArticles, sourceMap, now),
  [filteredArticles, sourceMap, now, savedOnly]);

  const handleOpen = useCallback((article: Article) => {
    setOpenArticle(article);
    adapter.setArticleRead(article.id).catch(() => {});
    logArticleOpen(article.id, article.sourceId);
  }, [adapter]);

  const handleSave = useCallback(async (article: Article) => {
    const current = starredOverrides.has(article.id)
      ? starredOverrides.get(article.id)!
      : article.isStarred;
    const next = !current;
    setStarredOverrides(prev => new Map(prev).set(article.id, next));
    try {
      await adapter.setArticleStarred(article.id, next);
    } catch {
      setStarredOverrides(prev => {
        const m = new Map(prev);
        m.delete(article.id);
        return m;
      });
    }
  }, [adapter, starredOverrides]);

  const handleRead = useCallback(
    (article: Article) => adapter.setArticleRead(article.id),
    [adapter],
  );

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleShare = useCallback((article: Article) => {
    const doCopy = () => {
      navigator.clipboard.writeText(article.url).catch(() => {});
      setCopiedId(article.id);
      setTimeout(() => setCopiedId(null), 1500);
    };
    if (navigator.share) {
      navigator.share({ url: article.url, title: article.title }).catch(() => doCopy());
    } else {
      doCopy();
    }
  }, []);

  const river = useRiver(scoredItems, handleOpen, handleSave, handleRead, handleShare);

  const savedIds = useMemo(() => new Set(
    articles
      .filter(a => starredOverrides.has(a.id) ? starredOverrides.get(a.id) : a.isStarred)
      .map(a => a.id),
  ), [articles, starredOverrides]);

  // Count unread articles per category for the filter bar
  const unreadByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) {
      if (a.isRead || mutedIds.has(a.sourceId)) continue;
      const src = sourceMap.get(a.sourceId);
      if (src?.categoryId) {
        counts.set(src.categoryId, (counts.get(src.categoryId) ?? 0) + 1);
      }
    }
    return counts;
  }, [articles, mutedIds, sourceMap]);

  const emptyMessage = savedOnly ? 'No saved articles yet.' : 'The stream is quiet.';

  return (
    <div hidden={hidden}>
      <FilterBar
        categories={categories}
        activeCategory={activeCategory}
        unreadOnly={unreadOnly}
        savedOnly={savedOnly}
        unreadByCategory={unreadByCategory}
        onCategory={(id) => {
          setActiveCategory(id);
          try {
            if (id) localStorage.setItem(CATEGORY_KEY, id);
            else localStorage.removeItem(CATEGORY_KEY);
          } catch { /* quota */ }
        }}
        onUnreadOnly={setUnreadOnly}
        onSavedOnly={setSavedOnly}
      />
      <River
        items={river.items}
        focusedIndex={river.focusedIndex}
        sourceMap={sourceMap}
        savedIds={savedIds}
        now={now}
        pendingUndo={river.pendingUndo}
        emptyMessage={emptyMessage}
        copiedId={copiedId}
        onDismiss={river.dismiss}
        onSave={river.save}
        onOpen={river.openItem}
        onUndo={river.undo}
        onMute={onMute}
      />
      {openArticle && (
        <ReadingView
          article={openArticle}
          source={sourceMap.get(openArticle.sourceId)}
          now={now}
          isSaved={savedIds.has(openArticle.id)}
          onSave={() => handleSave(openArticle)}
          onClose={() => setOpenArticle(null)}
        />
      )}
      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
