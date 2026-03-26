const DISPLAY_KEY = 'stream-display';

export type TextSize = 'small' | 'default' | 'large';
export type FadeLevel = 'none' | 'subtle' | 'full';
export type AccentColor = 'frost' | 'yellow' | 'green' | 'berry';

export interface DisplayPrefs {
  textSize: TextSize;
  fadeLevel: FadeLevel;
  accentColor: AccentColor;
}

export const TEXT_SIZE_PX: Record<TextSize, number> = { small: 14, default: 16, large: 18 };
export const FADE_MAX: Record<FadeLevel, number> = { none: 0, subtle: 0.35, full: 0.7 };

export const ACCENT_OPTIONS: Array<{ id: AccentColor; label: string; swatch: string }> = [
  { id: 'frost',  label: 'Frost',  swatch: '#88C0D0' },   /* nord8  */
  { id: 'yellow', label: 'Yellow', swatch: '#EBCB8B' },    /* nord13 */
  { id: 'green',  label: 'Green',  swatch: '#A3BE8C' },    /* nord14 */
  { id: 'berry',  label: 'Berry',  swatch: '#B48EAD' },    /* nord15 */
];

export const DEFAULTS: DisplayPrefs = { textSize: 'default', fadeLevel: 'full', accentColor: 'frost' };

export function loadDisplayPrefs(): DisplayPrefs {
  try {
    const raw = localStorage.getItem(DISPLAY_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

export function saveDisplayPrefs(prefs: DisplayPrefs): void {
  localStorage.setItem(DISPLAY_KEY, JSON.stringify(prefs));
}

export function applyDisplayPrefs(prefs: DisplayPrefs): void {
  document.documentElement.style.fontSize = `${TEXT_SIZE_PX[prefs.textSize]}px`;
  document.documentElement.style.setProperty('--fade-max', String(FADE_MAX[prefs.fadeLevel]));
  document.documentElement.setAttribute('data-accent', prefs.accentColor);
}
