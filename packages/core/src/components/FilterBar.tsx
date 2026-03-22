import type { Category } from '../types.js';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  categories: Category[];
  activeCategory: string | null;
  unreadOnly: boolean;
  onCategory: (id: string | null) => void;
  onUnreadOnly: (v: boolean) => void;
}

export function FilterBar({
  categories,
  activeCategory,
  unreadOnly,
  onCategory,
  onUnreadOnly,
}: FilterBarProps) {
  const hasCats = categories.length > 0;

  return (
    <div class={styles.bar}>
      {hasCats && (
        <div class={styles.cats}>
          <button
            class={`${styles.pill} ${activeCategory === null ? styles.active : ''}`}
            onClick={() => onCategory(null)}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              class={`${styles.pill} ${activeCategory === cat.id ? styles.active : ''}`}
              onClick={() => onCategory(activeCategory === cat.id ? null : cat.id)}
            >
              {cat.title}
            </button>
          ))}
        </div>
      )}
      <button
        class={`${styles.pill} ${unreadOnly ? styles.active : ''} ${hasCats ? '' : styles.solo}`}
        onClick={() => onUnreadOnly(!unreadOnly)}
        aria-pressed={unreadOnly}
        title={unreadOnly ? 'Showing unread only — click to show all' : 'Show unread only'}
      >
        Unread
      </button>
    </div>
  );
}
