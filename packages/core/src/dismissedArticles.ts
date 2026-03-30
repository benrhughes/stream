const DISMISSED_KEY = 'stream-dismissed';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

interface DismissedEntry {
  ts: number;
}

type DismissedMap = Record<string, DismissedEntry>;

function load(): DismissedMap {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (raw) return JSON.parse(raw) as DismissedMap;
  } catch { /* ignore */ }
  return {};
}

function save(map: DismissedMap): void {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
}

export function getDismissedIds(): Set<string> {
  const now = Date.now();
  const map = load();
  const ids = new Set<string>();
  for (const [id, entry] of Object.entries(map)) {
    if (now - entry.ts <= MAX_AGE_MS) ids.add(id);
  }
  return ids;
}

export function addDismissed(articleId: string): void {
  const map = load();
  map[articleId] = { ts: Date.now() };
  save(map);
}

export function removeDismissed(articleId: string): void {
  const map = load();
  delete map[articleId];
  save(map);
}

export function purgeDismissed(): void {
  const now = Date.now();
  const map = load();
  const pruned: DismissedMap = {};
  for (const [id, entry] of Object.entries(map)) {
    if (now - entry.ts <= MAX_AGE_MS) pruned[id] = entry;
  }
  save(pruned);
}
