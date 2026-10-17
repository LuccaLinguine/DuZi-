import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../db/index.ts';
import { DEFAULT_SETTINGS } from '../db/settings.ts';
import type { Settings } from '../db/types.ts';
import { applyTheme, watchSystemTheme } from '../lib/theme.ts';
import { resolveSettingsPatch, type SettingsPatch } from '../lib/settings-patch.ts';

export type { SettingsPatch };

/**
 * Settings live in IndexedDB but are read constantly, so they are mirrored in
 * React state. `ready` stays false until the stored row has loaded, so the app
 * never flashes the defaults over the user's choices.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  // React batches/defers the re-render triggered by setSettings, so a second
  // call to `update()` before that flush would otherwise close over the same
  // stale `settings` value as the first — e.g. two quick taps of "cycle
  // playback speed" both computing "current + 1 step" from the same starting
  // rate, so the second tap is silently lost. This ref is updated
  // synchronously inside `update()` itself, so each call always sees the
  // true latest value regardless of whether React has re-rendered yet.
  const latest = useRef(settings);

  useEffect(() => {
    let live = true;
    void db.getSettings().then((s) => {
      if (!live) return;
      latest.current = s;
      setSettings(s);
      applyTheme(s.theme);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  // `getMode` reads through a ref-like closure over the latest state via the
  // functional setter, so the listener is registered once.
  useEffect(() => watchSystemTheme(() => settings.theme), [settings.theme]);

  const update = useCallback((patch: SettingsPatch) => {
    const { resolved, next } = resolveSettingsPatch(latest.current, patch);
    latest.current = next;
    setSettings(next);
    if (resolved.theme) applyTheme(resolved.theme);
    void db.putSettings(resolved);
  }, []);

  return { settings, update, ready };
}
