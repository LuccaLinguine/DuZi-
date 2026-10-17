/**
 * Status transitions for the word memory (spec §5a). Every function here is
 * pure — takes a row, returns the next row — so the Dexie-touching code in
 * src/db/word-memory.ts stays a thin wrapper and the rules themselves are
 * fully unit tested without a database.
 *
 * Status meanings and what Smart pinyin shows:
 *   new      never seen before             → pinyin shown
 *   learning seen/looked up/saved, shaky    → pinyin shown
 *   known    solid                          → pinyin hidden
 *   ignored  names, places, don't care      → pinyin hidden
 */
import type { WordRow, WordStatus } from '../db/types.ts';
import type { PinyinMode } from '../db/types.ts';

/** A fresh row for a word this device has never encountered before. */
export function newWordRow(w: string, now: number): WordRow {
  return {
    w,
    status: 'new',
    timesSeen: 0,
    timesLookedUp: 0,
    seenWithoutLookup: 0,
    firstSeen: now,
    lastSeen: now,
    lastLookedUp: null,
    cardId: null,
  };
}

/**
 * Tapping a word to look it up. Moves `new`/`learning` to `learning`, and
 * demotes `known` back to `learning` — "I evidently forgot it". `ignored`
 * words (proper nouns the learner deliberately excluded) are left alone: a
 * lookup is just a pronunciation check, not a request to start tracking them.
 */
export function applyLookup(row: WordRow, now: number): WordRow {
  return {
    ...row,
    status: row.status === 'ignored' ? 'ignored' : 'learning',
    timesLookedUp: row.timesLookedUp + 1,
    seenWithoutLookup: 0,
    lastSeen: now,
    lastLookedUp: now,
  };
}

/**
 * Marking a story as read, for one word that appeared in it. `tapped` is
 * whether the learner looked this word up at any point during that read.
 *
 * A tapped word already went through `applyLookup` when it was tapped, so
 * this only adds the read to its seen count. An untapped word's streak grows,
 * and graduates to `known` once it crosses the threshold — proof the learner
 * breezed past it several times running without needing help.
 */
export function applyStoryRead(
  row: WordRow,
  tapped: boolean,
  now: number,
  graduateAfterStories: number,
): WordRow {
  if (tapped) {
    return { ...row, timesSeen: row.timesSeen + 1, lastSeen: now };
  }

  const seenWithoutLookup = row.seenWithoutLookup + 1;
  const graduates =
    row.status !== 'known' && row.status !== 'ignored' && seenWithoutLookup >= graduateAfterStories;

  return {
    ...row,
    timesSeen: row.timesSeen + 1,
    seenWithoutLookup,
    lastSeen: now,
    status: graduates ? 'known' : row.status,
  };
}

/**
 * A saved flashcard's FSRS stability crossed the graduation threshold:
 * promote to `known`. Pressing "Again" on a known card's review demotes it
 * back to `learning` — the counterpart to the lookup demotion above. Neither
 * touches a word the learner has explicitly set to `ignored`.
 */
export function applyCardGraduated(row: WordRow, now: number): WordRow {
  if (row.status === 'ignored') return row;
  return { ...row, status: 'known', lastSeen: now };
}

export function applyCardLapsed(row: WordRow, now: number): WordRow {
  if (row.status !== 'known') return row;
  return { ...row, status: 'learning', lastSeen: now };
}

/**
 * Manual override from the word sheet's status control, "mark all untapped
 * words as known", or the onboarding bulk action. Always wins outright — the
 * learner said so.
 */
export function applyManualStatus(row: WordRow, status: WordStatus, now: number): WordRow {
  return { ...row, status, lastSeen: now };
}

/** Whether pinyin should render for one token, given the active mode. */
export function pinyinVisible(
  mode: PinyinMode,
  status: WordStatus | undefined,
  isAboveLevel: boolean,
): boolean {
  switch (mode) {
    case 'off':
      return false;
    case 'all':
      return true;
    case 'above':
      return isAboveLevel;
    case 'smart':
      // A word with no row yet (not imported, or a pasted-text token) reads
      // as `new` — pinyin shown, same as any other word nobody has met yet.
      return status === undefined || status === 'new' || status === 'learning';
  }
}
