/**
 * Loads the HSK 3.0 word → level map once and keeps it in a module-level
 * cache, since every screen that needs "is this word in level" wants the
 * same ~120 KB map.
 */
import { useEffect, useState } from 'react';
import type { HskMap } from '../lib/hsk.ts';
import { dataUrl } from '../lib/paths.ts';

let cached: Promise<HskMap> | null = null;

function load(): Promise<HskMap> {
  if (!cached) {
    cached = fetch(dataUrl('hsk/hsk3.json')).then((r) => {
      if (!r.ok) throw new Error(`hsk3.json: ${r.status}`);
      return r.json() as Promise<HskMap>;
    });
  }
  return cached;
}

export function useHsk(): HskMap | null {
  const [map, setMap] = useState<HskMap | null>(null);
  useEffect(() => {
    let live = true;
    void load().then((m) => {
      if (live) setMap(m);
    });
    return () => {
      live = false;
    };
  }, []);
  return map;
}
