import { useEffect, useState } from 'react';
import { db } from '../db/index.ts';
import { syncContent, type SyncResult } from '../lib/content-sync.ts';
import { MANIFEST_URL, contentUrl } from '../lib/paths.ts';

/**
 * Imports any stories the current deploy carries that this device doesn't have.
 * Runs once per launch. Offline, the fetch fails and we simply keep what is
 * already in IndexedDB — that is the normal case for a PWA on a plane.
 */
export function useContentSync(enabled: boolean) {
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;

    void (async () => {
      try {
        const r = await syncContent(MANIFEST_URL, {
          db,
          fetchStory: async (file) => {
            const res = await fetch(contentUrl(file), { cache: 'no-cache' });
            if (!res.ok) throw new Error(`${file}: ${res.status}`);
            return res.json();
          },
        });
        if (live && r) setResult(r);
      } catch (err) {
        // Offline or a bad deploy: log it, show nothing, keep the library.
        if (live) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      live = false;
    };
  }, [enabled]);

  return { result, error };
}

/** The "5 new stories" toast text, or null when there is nothing to say. */
export function syncMessage(result: SyncResult | null): string | null {
  if (!result) return null;
  const parts: string[] = [];
  if (result.added.length > 0) {
    parts.push(result.added.length === 1 ? '1 new story' : `${result.added.length} new stories`);
  }
  if (result.updated.length > 0) parts.push(`${result.updated.length} updated`);
  if (result.rejected.length > 0) parts.push(`${result.rejected.length} could not be read`);
  return parts.length > 0 ? parts.join(' · ') : null;
}
