import { useEffect, useState } from 'react';
import { loadTraditionalConverter, type ScriptConverter } from '../lib/script.ts';
import type { Script } from '../db/types.ts';

const identity: ScriptConverter = (s) => s;

/**
 * Resolves to a Simplified→Traditional converter once the toggle is actually
 * on, loading the conversion tables lazily on first use. Before that (or in
 * Simplified mode) it's just the identity function, no network or bundle cost.
 */
export function useScriptConverter(script: Script): ScriptConverter {
  const [converter, setConverter] = useState<ScriptConverter | null>(null);

  useEffect(() => {
    if (script !== 'traditional' || converter) return;
    let live = true;
    void loadTraditionalConverter().then((c) => {
      if (live) setConverter(() => c);
    });
    return () => {
      live = false;
    };
  }, [script, converter]);

  return script === 'traditional' && converter ? converter : identity;
}
