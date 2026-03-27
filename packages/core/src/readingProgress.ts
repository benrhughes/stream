const PROGRESS_KEY = 'stream-reading-progress';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (longest half-life)

interface ProgressEntry {
  pct: number;      // 0–1 scroll percentage
  ts: number;       // timestamp for expiry
}

type ProgressMap = Record<string, ProgressEntry>;

function load(): ProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) return JSON.parse(raw) as ProgressMap;
  } catch {}
  return {};
}

function save(map: ProgressMap): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
}

export function getProgress(articleId: string): number | null {
  const map = load();
  const entry = map[articleId];
  if (!entry) return null;
  if (Date.now() - entry.ts > MAX_AGE_MS) return null;
  return entry.pct;
}

export function saveProgress(articleId: string, pct: number): void {
  const map = load();
  map[articleId] = { pct, ts: Date.now() };
  save(map);
}

export function purgeProgress(): void {
  const map = load();
  const now = Date.now();
  const pruned: ProgressMap = {};
  for (const [id, entry] of Object.entries(map)) {
    if (now - entry.ts <= MAX_AGE_MS) pruned[id] = entry;
  }
  save(pruned);
}
