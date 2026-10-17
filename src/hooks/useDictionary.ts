import { useEffect, useState } from 'react';
import { lookupWords } from '../lib/dictionary.ts';
import type { DictEntry } from '../lib/cedict-parse.ts';

/** CC-CEDICT entries for a set of words, loaded on demand and cached by the dictionary module. */
export function useDictEntries(words: readonly string[]): Map<string, DictEntry[]> | undefined {
  const key = words.join(' ');
  const [entries, setEntries] = useState<Map<string, DictEntry[]> | undefined>(undefined);

  useEffect(() => {
    if (words.length === 0) {
      setEntries(new Map());
      return;
    }
    let live = true;
    setEntries(undefined);
    void lookupWords(words).then((m) => {
      if (live) setEntries(m);
    });
    return () => {
      live = false;
    };
    // `key` (not `words`) is the dependency on purpose: a fresh array each
    // render would otherwise refetch every time.
  }, [key]);

  return entries;
}
