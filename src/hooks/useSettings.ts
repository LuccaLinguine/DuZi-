import { useCallback, useEffect, useState } from 'react';
import { db } from '../db/index.ts';
import { DEFAULT_SETTINGS } from '../db/settings.ts';
import type { Settings } from '../db/types.ts';
import { applyTheme, watchSystemTheme } from '../lib/theme.ts';

/**
 * Settings live in IndexedDB but are read constantly, so they are mirrored in
 * React state. `ready` stays false until the stored row has loaded, so the app
 * never flashes the defaults over the user's choices.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    void db.getSettings().then((s) => {
      if (!live) return;
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

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.theme) applyTheme(patch.theme);
      return next;
    });
    void db.putSettings(patch);
  }, []);

  return { settings, update, ready };
}
