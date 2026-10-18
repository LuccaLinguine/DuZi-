/**
 * Pure aggregation for the Stats screen (spec section 9). Reading stats
 * (characters, stories read) are derived from `db.reads` rows rather than a
 * separately-maintained day counter, so there is one source of truth and no
 * risk of the two drifting apart.
 */
import { localDayKey, recentDayKeys } from './day.ts';

export interface ReadEvent {
  at: number;
  chars: number;
}

export interface DailyChars {
  date: string;
  chars: number;
}

/** Characters read per day for the last `days` days, oldest first, zero-filled. */
export function charsPerDay(reads: readonly ReadEvent[], now: number, days: number): DailyChars[] {
  const totals = new Map<string, number>();
  for (const r of reads) {
    const key = localDayKey(r.at);
    totals.set(key, (totals.get(key) ?? 0) + r.chars);
  }
  return recentDayKeys(now, days).map((date) => ({ date, chars: totals.get(date) ?? 0 }));
}

export interface ReadingTotals {
  storiesRead: number;
  charsReadTotal: number;
  charsReadThisWeek: number;
}

export function computeReadingTotals(reads: readonly ReadEvent[], now: number): ReadingTotals {
  const weekKeys = new Set(recentDayKeys(now, 7));
  let total = 0;
  let week = 0;
  for (const r of reads) {
    total += r.chars;
    if (weekKeys.has(localDayKey(r.at))) week += r.chars;
  }
  return { storiesRead: reads.length, charsReadTotal: total, charsReadThisWeek: week };
}

/**
 * Current daily streak: consecutive local days with at least one read or
 * review, counting back from today. A day with nothing yet but no activity
 * logged today doesn't break yesterday's streak — "today" just hasn't
 * happened yet.
 */
export function computeStreak(activeDayKeys: ReadonlySet<string>, now: number): number {
  const today = localDayKey(now);
  let streak = 0;
  let cursor = now;
  // If nothing has happened yet today, start counting from yesterday instead
  // of breaking the streak at zero.
  if (!activeDayKeys.has(today)) cursor -= 86_400_000;

  for (;;) {
    const key = localDayKey(cursor);
    if (!activeDayKeys.has(key)) break;
    streak++;
    cursor -= 86_400_000;
  }
  return streak;
}

export interface VocabEstimate {
  level: number;
  size: number;
  known: number;
  pct: number;
}

/**
 * Known-or-saved words per HSK band against each band's total size, for the
 * "estimated vocabulary by HSK level" stat. `wordsLevel` maps each counted
 * word to its band (level 7 = the combined 7–9 band).
 */
export function estimateVocabulary(
  countedWords: readonly string[],
  wordLevel: ReadonlyMap<string, number>,
  bandSizes: Record<string, number>,
): VocabEstimate[] {
  const counts = new Map<number, number>();
  for (const w of countedWords) {
    const level = wordLevel.get(w);
    if (level === undefined) continue;
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  return Object.entries(bandSizes)
    .map(([levelStr, size]) => {
      const level = Number(levelStr);
      const known = counts.get(level) ?? 0;
      return { level, size, known, pct: size === 0 ? 0 : Math.round((known / size) * 1000) / 10 };
    })
    .sort((a, b) => a.level - b.level);
}
