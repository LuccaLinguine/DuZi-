/**
 * "12 new · 5 learning" — shown on the library card and the reader's header
 * (spec §5a), computed from a story's distinct vocabulary against whatever
 * the word memory currently says about each one.
 */
import type { WordRow, WordStatus } from '../db/types.ts';

export type WordCounts = Record<WordStatus, number>;

export function emptyWordCounts(): WordCounts {
  return { new: 0, learning: 0, known: 0, ignored: 0 };
}

/**
 * `rows` need only cover the words this story uses; a word with no row yet
 * (just imported, never encountered elsewhere) counts as `new`.
 */
export function computeWordCounts(
  words: readonly string[],
  rows: ReadonlyMap<string, Pick<WordRow, 'status'>>,
): WordCounts {
  const counts = emptyWordCounts();
  for (const w of words) {
    const status = rows.get(w)?.status ?? 'new';
    counts[status]++;
  }
  return counts;
}

/** The compact "12 new · 5 learning" label; omits zero terms. */
export function formatWordCounts(counts: WordCounts): string {
  const parts: string[] = [];
  if (counts.new > 0) parts.push(`${counts.new} new`);
  if (counts.learning > 0) parts.push(`${counts.learning} learning`);
  if (parts.length === 0) {
    return counts.known > 0 ? 'all known' : '';
  }
  return parts.join(' · ');
}
