/** Per-band word-list sizes (public/data/hsk/meta.json), for the vocabulary estimate in Stats. */
import { useEffect, useState } from 'react';
import { dataUrl } from '../lib/paths.ts';

interface HskMeta {
  sizes: { hsk3: Record<string, number>; hsk2: Record<string, number> };
}

let cached: Promise<HskMeta> | null = null;

function load(): Promise<HskMeta> {
  if (!cached) {
    cached = fetch(dataUrl('hsk/meta.json')).then((r) => {
      if (!r.ok) throw new Error(`hsk/meta.json: ${r.status}`);
      return r.json() as Promise<HskMeta>;
    });
  }
  return cached;
}

/** HSK 3.0 band sizes: { "1": 506, "2": 750, ... "7": 5606 }. */
export function useHskSizes(): Record<string, number> | null {
  const [sizes, setSizes] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let live = true;
    void load().then((m) => {
      if (live) setSizes(m.sizes.hsk3);
    });
    return () => {
      live = false;
    };
  }, []);
  return sizes;
}
