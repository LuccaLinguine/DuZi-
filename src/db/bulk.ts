/**
 * Bulk word-memory writes that don't fit the per-word flow in word-memory.ts:
 * onboarding's "mark everything up to my level as known" and its Settings
 * counterpart (spec section 5a, "redo this from Settings").
 */
import { db } from './index.ts';
import type { HskMap } from '../lib/hsk.ts';
import { newWordRow, applyManualStatus } from '../lib/word-memory.ts';

/** Every HSK headword at or below `ceiling`, across all bands. */
export function hskWordsAtOrBelow(hsk: HskMap, ceiling: number): string[] {
  return Object.entries(hsk)
    .filter(([, level]) => level <= ceiling)
    .map(([w]) => w);
}

/** Marks every HSK word at or below `ceiling` as `known`. Returns how many. */
export async function markHskCeilingKnown(hsk: HskMap, ceiling: number): Promise<number> {
  const words = hskWordsAtOrBelow(hsk, ceiling);
  if (words.length === 0) return 0;

  const now = Date.now();
  const existing = await db.words.bulkGet(words);
  const rows = words.map((w, i) => applyManualStatus(existing[i] ?? newWordRow(w, now), 'known', now));
  await db.words.bulkPut(rows);
  return rows.length;
}
