const MUTED_KEY = 'stream-muted-sources';

export interface MuteEntry {
  sourceId: string;
  sourceTitle: string;
  mutedUntil: number;
}

function load(): MuteEntry[] {
  try {
    const raw = localStorage.getItem(MUTED_KEY);
    if (raw) return JSON.parse(raw) as MuteEntry[];
  } catch {}
  return [];
}

function save(entries: MuteEntry[]): void {
  localStorage.setItem(MUTED_KEY, JSON.stringify(entries));
}

export function getMutedSources(): MuteEntry[] {
  return load();
}

/** Returns the set of currently-muted sourceIds (expired entries excluded). */
export function activeMutedIds(): Set<string> {
  const now = Date.now();
  return new Set(
    load()
      .filter(e => e.mutedUntil > now)
      .map(e => e.sourceId),
  );
}

export function muteSource(sourceId: string, sourceTitle: string, mutedUntil: number): void {
  const entries = load().filter(e => e.sourceId !== sourceId);
  entries.push({ sourceId, sourceTitle, mutedUntil });
  save(entries);
}

export function unmuteSource(sourceId: string): void {
  save(load().filter(e => e.sourceId !== sourceId));
}

/** Removes entries that have already auto-expired. */
export function cleanExpiredMutes(): void {
  const now = Date.now();
  save(load().filter(e => e.mutedUntil > now));
}

export const MUTE_DURATIONS: Array<{ label: string; ms: number }> = [
  { label: '1 day',   ms: 24 * 60 * 60 * 1000 },
  { label: '1 week',  ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '1 month', ms: 30 * 24 * 60 * 60 * 1000 },
];
