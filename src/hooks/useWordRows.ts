import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/index.ts';
import type { WordRow } from '../db/types.ts';

/**
 * Live word-memory rows for a set of words, as a Map. Re-runs whenever any of
 * them changes, which is what makes Smart pinyin "disappear everywhere on the
 * page at once" when a word is marked known (spec section 5a).
 */
export function useWordRows(words: readonly string[]): Map<string, WordRow> | undefined {
  return useLiveQuery(async () => {
    if (words.length === 0) return new Map<string, WordRow>();
    const rows = await db.words.bulkGet([...words]);
    const map = new Map<string, WordRow>();
    rows.forEach((row, i) => {
      if (row) map.set(words[i]!, row);
    });
    return map;
    // Re-run when the word *list* changes, not on every render — join gives a
    // stable dependency for a string array.
  }, [words.join(' ')]);
}
