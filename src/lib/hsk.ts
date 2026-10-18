/**
 * HSK level lookups and the "% in level" figure shown on every library card.
 *
 * The maps themselves are built at build time into /data/hsk/*.json; this
 * module only knows how to read them, so the same code serves the app (which
 * fetches them) and the validator (which reads them from disk).
 */
import type { LevelId } from './levels.ts';
import { LEVELS } from './levels.ts';
import { isWordToken, splitChars } from './text.ts';

/** word → level number. Level 7 means the combined HSK 3.0 7–9 band. */
export type HskMap = Record<string, number>;

export function hskLevelOf(word: string, map: HskMap): number | undefined {
  return map[word];
}

/**
 * True if `word` is at or below a level's HSK ceiling. Words absent from the
 * HSK lists count as above level: proper nouns and the like are declared in a
 * story's `new_words` instead.
 */
export function isInLevel(word: string, levelId: LevelId, map: HskMap): boolean {
  return isInLevelAt(word, LEVELS[levelId].hskCeiling, map);
}

/**
 * A word counts as in-level when the HSK lists place it at or below the
 * ceiling, or — for words the lists don't contain at all — when every one of
 * its characters is already in level.
 *
 * That second rule is what keeps transparent compounds out of the "new word"
 * count: 二十, 星期六 and 手里 are not HSK entries, but nobody who knows their
 * parts has to learn them. A word the lists *do* contain at a higher band
 * (小说 at HSK 2, say) stays above level even when its characters are easy,
 * because its meaning is not the sum of them.
 */
export function isInLevelAt(word: string, ceiling: number, map: HskMap): boolean {
  const level = map[word];
  if (level !== undefined) return level <= ceiling;

  const chars = splitChars(word);
  if (chars.length < 2) return false;
  return decomposesInLevel(chars, ceiling, map);
}

/** Longest-match the pieces of a word against the HSK lists themselves. */
function decomposesInLevel(chars: readonly string[], ceiling: number, map: HskMap): boolean {
  let i = 0;
  while (i < chars.length) {
    let matched = 0;
    for (let len = chars.length - i; len >= 1; len--) {
      const level = map[chars.slice(i, i + len).join('')];
      if (level !== undefined && level <= ceiling) {
        matched = len;
        break;
      }
    }
    if (matched === 0) return false;
    i += matched;
  }
  return true;
}

export interface InLevelStats {
  /** Non-punctuation tokens considered. */
  total: number;
  inLevel: number;
  /** 0–100, rounded to one decimal. */
  pct: number;
  /** Distinct out-of-level words, most frequent first. */
  aboveLevel: { w: string; count: number; hsk: number | undefined }[];
}

/**
 * Share of a story's word tokens that sit at or below its level ceiling.
 * Counted per token occurrence (not per distinct word), so a hard word used
 * ten times costs ten times as much — which is how it reads.
 */
export function computeInLevel(
  tokens: readonly string[],
  levelId: LevelId,
  map: HskMap,
): InLevelStats {
  const ceiling = LEVELS[levelId].hskCeiling;
  const above = new Map<string, number>();
  let total = 0;
  let inLevel = 0;

  for (const w of tokens) {
    if (!isWordToken(w)) continue;
    total++;
    if (isInLevelAt(w, ceiling, map)) {
      inLevel++;
    } else {
      above.set(w, (above.get(w) ?? 0) + 1);
    }
  }

  return {
    total,
    inLevel,
    pct: total === 0 ? 0 : Math.round((inLevel / total) * 1000) / 10,
    aboveLevel: [...above.entries()]
      .map(([w, count]) => ({ w, count, hsk: map[w] }))
      .sort((a, b) => b.count - a.count || a.w.localeCompare(b.w)),
  };
}
