import type { ThemeMode } from '../db/types.ts';

/**
 * Applies the theme by stamping `data-theme` on <html>. "system" stamps
 * nothing and lets the media query decide, so the app follows iOS/Android
 * appearance settings by default.
 */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', mode);
  }
  const themeColor = mode === 'dark' ? '#15130f' : mode === 'sepia' ? '#f1e5cf' : '#faf7f2';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
}

/** Re-apply on system appearance changes while "system" is selected. */
export function watchSystemTheme(getMode: () => ThemeMode): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (getMode() === 'system') applyTheme('system');
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
