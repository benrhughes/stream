import { useState } from 'preact/hooks';
import type { Source } from '../types.js';
import { HALF_LIVES } from '../riverEngine.js';
import styles from './VelocitySettings.module.css';

const TIERS: Array<{ tier: 1|2|3|4|5; label: string }> = [
  { tier: 1, label: `${HALF_LIVES[1]}h` },
  { tier: 2, label: `${HALF_LIVES[2]}h` },
  { tier: 3, label: `${HALF_LIVES[3]}h` },
  { tier: 4, label: `${HALF_LIVES[4]}h` },
  { tier: 5, label: '7d' },
];

interface VelocitySettingsProps {
  sources: Source[];
  onUpdate: (sourceId: string, tier: 1|2|3|4|5) => void;
}

export function VelocitySettings({ sources, onUpdate }: VelocitySettingsProps) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? sources.filter(s => s.title.toLowerCase().includes(query.toLowerCase()))
    : sources;

  const sorted = [...filtered].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div class={styles.wrap}>
      <h2 class={styles.heading}>Velocity</h2>
      <p class={styles.sub}>
        How quickly should each source's articles fade? Shorter = faster.
      </p>

      <input
        class={styles.search}
        type="search"
        placeholder="Filter sources…"
        value={query}
        onInput={e => setQuery((e.target as HTMLInputElement).value)}
        aria-label="Filter sources"
      />

      {sorted.length === 0 ? (
        <p class={styles.empty}>No sources match.</p>
      ) : (
        <div class={styles.list} role="list">
          {sorted.map(source => (
            <SourceRow
              key={source.id}
              source={source}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SourceRowProps {
  source: Source;
  onUpdate: (sourceId: string, tier: 1|2|3|4|5) => void;
}

function SourceRow({ source, onUpdate }: SourceRowProps) {
  const handleFaviconError = (e: Event) => {
    (e.target as HTMLImageElement).setAttribute('data-error', '');
  };

  return (
    <div class={styles.row} role="listitem">
      {source.faviconUrl ? (
        <img
          class={styles.favicon}
          src={source.faviconUrl}
          alt=""
          aria-hidden="true"
          width={14}
          height={14}
          onError={handleFaviconError}
        />
      ) : (
        <span class={styles.favicon} style={{ display: 'inline-block', background: 'var(--border)' }} />
      )}

      <span class={styles.sourceName} title={source.title}>
        {source.title}
      </span>

      <div class={styles.tiers} role="group" aria-label={`Velocity for ${source.title}`}>
        {TIERS.map(({ tier, label }) => (
          <button
            key={tier}
            class={`${styles.tierBtn} ${source.velocityTier === tier ? styles.active : ''}`}
            onClick={() => onUpdate(source.id, tier)}
            aria-pressed={source.velocityTier === tier}
            title={tierTitle(tier)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function tierTitle(tier: 1|2|3|4|5): string {
  const names = ['Breaking', 'News', 'Article', 'Essay', 'Evergreen'];
  return names[tier - 1];
}
