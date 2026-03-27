const LOG_KEY = 'stream-reading-log';
const DISMISSED_KEY = 'stream-suggestion-dismissed';
const LOG_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface ReadingLogEntry {
  articleId: string;
  sourceId: string;
  ts: number;
}

export interface VelocitySuggestion {
  sourceId: string;
  sourceTitle: string;
  currentTier: 1 | 2 | 3 | 4 | 5;
  suggestedTier: 1 | 2 | 3 | 4 | 5;
  reason: string;
  openCount: number;
}

// ---------------------------------------------------------------------------
// Log management
// ---------------------------------------------------------------------------

function loadLog(): ReadingLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) return JSON.parse(raw) as ReadingLogEntry[];
  } catch {}
  return [];
}

function saveLog(entries: ReadingLogEntry[]): void {
  localStorage.setItem(LOG_KEY, JSON.stringify(entries));
}

/** Append an open event, deduplicating by articleId, pruning entries older than 14 days. */
export function logArticleOpen(articleId: string, sourceId: string): void {
  const cutoff = Date.now() - LOG_MAX_AGE_MS;
  const entries = loadLog()
    .filter(e => e.ts > cutoff && e.articleId !== articleId); // prune old + deduplicate
  entries.push({ articleId, sourceId, ts: Date.now() });
  saveLog(entries);
}

// ---------------------------------------------------------------------------
// Dismissed suggestions
// ---------------------------------------------------------------------------

type DismissedMap = Record<string, number>; // sourceId -> dismissedUntil timestamp

function loadDismissed(): DismissedMap {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (raw) return JSON.parse(raw) as DismissedMap;
  } catch {}
  return {};
}

export function dismissSuggestion(sourceId: string): void {
  const map = loadDismissed();
  map[sourceId] = Date.now() + DISMISS_DURATION_MS;
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
}

// ---------------------------------------------------------------------------
// Suggestion engine
// ---------------------------------------------------------------------------

const MIN_OPENS_FOR_HIGH = 5;   // opens in 14 days to consider "high engagement"
const MIN_DAYS_BEFORE_LOW = 7;  // must have at least 7 days of data to suggest "low"

/**
 * Generates velocity tier suggestions for sources based on reading patterns.
 * Only generates suggestions for sources with sufficient signal (>= 5 opens for
 * "read more" suggestions; source must be at least 7 days old in the log for
 * "read less" suggestions).
 */
export function generateSuggestions(
  sources: Array<{ id: string; title: string; velocityTier: 1 | 2 | 3 | 4 | 5 }>,
): VelocitySuggestion[] {
  const cutoff = Date.now() - LOG_MAX_AGE_MS;
  const entries = loadLog().filter(e => e.ts > cutoff);
  const dismissed = loadDismissed();
  const now = Date.now();

  // Count opens per source in last 14 days
  const opensBySource = new Map<string, number>();
  const oldestBySource = new Map<string, number>();
  for (const entry of entries) {
    opensBySource.set(entry.sourceId, (opensBySource.get(entry.sourceId) ?? 0) + 1);
    const oldest = oldestBySource.get(entry.sourceId);
    if (oldest === undefined || entry.ts < oldest) {
      oldestBySource.set(entry.sourceId, entry.ts);
    }
  }

  const suggestions: VelocitySuggestion[] = [];

  for (const source of sources) {
    // Skip if dismissed recently
    const dismissedUntil = dismissed[source.id];
    if (dismissedUntil && now < dismissedUntil) continue;

    const openCount = opensBySource.get(source.id) ?? 0;
    const oldestEntry = oldestBySource.get(source.id);
    const dataAgeMs = oldestEntry ? now - oldestEntry : 0;

    // High engagement + fast tier → suggest slowing down
    if (openCount >= MIN_OPENS_FOR_HIGH && source.velocityTier <= 2) {
      const suggestedTier = Math.min(5, source.velocityTier + 2) as 1 | 2 | 3 | 4 | 5;
      suggestions.push({
        sourceId: source.id,
        sourceTitle: source.title,
        currentTier: source.velocityTier,
        suggestedTier,
        reason: `You've opened ${openCount} articles in 14 days. A slower fade would keep them visible longer.`,
        openCount,
      });
      continue;
    }

    // No engagement + slow tier + enough data → suggest speeding up
    if (
      openCount === 0 &&
      source.velocityTier >= 4 &&
      dataAgeMs === 0 && // source has no log entries at all
      entries.some(e => e.ts < now - MIN_DAYS_BEFORE_LOW * 86_400_000) // log has 7+ days of data
    ) {
      const suggestedTier = Math.max(1, source.velocityTier - 2) as 1 | 2 | 3 | 4 | 5;
      suggestions.push({
        sourceId: source.id,
        sourceTitle: source.title,
        currentTier: source.velocityTier,
        suggestedTier,
        reason: `No articles opened in 14 days. A faster fade would clear space for sources you do read.`,
        openCount: 0,
      });
    }
  }

  return suggestions;
}
