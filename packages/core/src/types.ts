// --- Article ---

export interface Article {
  id: string;
  sourceId: string;
  title: string;
  author?: string;
  url: string;
  content: string;        // HTML content or summary from the backend
  imageUrl?: string;       // Featured / lead image extracted from content or enclosures
  publishedAt: Date;
  isRead: boolean;
  isStarred: boolean;
}

// --- Source ---

export interface Source {
  id: string;
  title: string;
  siteUrl?: string;
  feedUrl: string;
  faviconUrl?: string;
  categoryId?: string;
  // Stream-specific — stored in IndexedDB, never sent to the backend
  velocityTier: 1 | 2 | 3 | 4 | 5;   // defaults to 3 (Article, 24h)
  customHalfLife?: number;             // hours; overrides tier when set
  isVoice: boolean;
}

// --- Category ---

export interface Category {
  id: string;
  title: string;
}

// --- Adapter config / auth ---

/**
 * How Stream reaches the RSS backend from the browser.
 *
 * - `direct`   — no proxy; the browser calls the backend directly.
 *                Only works when the backend sends CORS headers.
 * - `byop`     — "bring your own proxy": the user deployed a proxy under
 *                their own cloud account and pasted the URL.
 * - `shared`   — route through whatever proxy the current origin offers
 *                (e.g. /.netlify/functions/proxy at stream.dynamicskillset.com).
 *                Opt-in, with a trust warning — the proxy operator can read
 *                credentials from platform logs.
 * - `dev`      — local Vite dev server's /dev-proxy helper. Implicit; never
 *                surfaced in the UI.
 */
export type ConnectionMode = 'direct' | 'byop' | 'shared' | 'dev';

export interface AdapterConfig {
  baseUrl?: string;       // for self-hosted adapters
  username?: string;
  password?: string;
  apiKey?: string;
  connectionMode?: ConnectionMode;
  /**
   * Base URL of the proxy that adapter fetches should go through.
   * `null` or absent means direct (no proxy).
   * Shape: `${proxyBase}?url=<encoded upstream URL>`.
   */
  proxyBase?: string | null;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

// --- Fetch options / result ---

export interface FetchOptions {
  since?: Date;
  limit?: number;
  continuation?: string;  // opaque pagination token
}

export interface FetchResult {
  articles: Article[];
  continuation?: string;
  hasMore: boolean;
}

// --- Adapter interface ---

export interface StreamAdapter {
  readonly id: string;
  readonly name: string;

  authenticate(config: AdapterConfig): Promise<AuthResult>;
  isAuthenticated(): boolean;

  fetchArticles(options?: FetchOptions): Promise<FetchResult>;
  fetchSources(): Promise<Source[]>;
  fetchCategories(): Promise<Category[]>;

  setArticleRead(articleId: string): Promise<void>;
  setArticleStarred(articleId: string, starred: boolean): Promise<void>;

  setSourceCategory(sourceId: string, categoryId: string): Promise<void>;

  addSource(feedUrl: string): Promise<Source>;
  removeSource(sourceId: string): Promise<void>;
  importOPML(opmlXml: string): Promise<Source[]>;
}
