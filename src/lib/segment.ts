/**
 * Local word segmentation for pasted text (spec §8). Authored stories ship
 * with their tokens already segmented, so this is only used for text the
 * learner pastes in — and as a sanity check in the validator.
 *
 * Strategy: forward maximum matching against CC-CEDICT headwords, with
 * pinyin-pro's segmenter as the fallback for runs the dictionary doesn't
 * cover. The dictionary is injected as a predicate so this stays pure and
 * testable.
 */
import { hasHan } from './text.ts';

const ALNUM = /[\p{L}\p{N}]/u;

function isAlnum(ch: string): boolean {
  return ALNUM.test(ch);
}

/** Longest headword in CC-CEDICT worth trying; beyond this it is all idioms. */
export const MAX_WORD_LEN = 8;

export interface SegmentOptions {
  /** True if the string is a dictionary headword. */
  has: (word: string) => boolean;
  maxLen?: number;
}

/**
 * Split a string into tokens. Han runs are segmented by longest match;
 * everything else (punctuation, Latin, digits) comes back as single-character
 * tokens that callers treat as punctuation.
 */
export function segment(text: string, { has, maxLen = MAX_WORD_LEN }: SegmentOptions): string[] {
  const chars = [...text];
  const out: string[] = [];
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i]!;
    if (!hasHan(ch)) {
      // Keep a run of non-Han together, but don't mix letters and digits in
      // with punctuation: "他说OK。" is 他 / 说 / OK / 。, so the reader can put
      // a word sheet on OK and leave the full stop alone.
      const alnum = isAlnum(ch);
      let j = i;
      while (j < chars.length && !hasHan(chars[j]!) && isAlnum(chars[j]!) === alnum) j++;
      out.push(chars.slice(i, j).join(''));
      i = j;
      continue;
    }

    let matched = '';
    for (let len = Math.min(maxLen, chars.length - i); len >= 2; len--) {
      const candidate = chars.slice(i, i + len).join('');
      if (has(candidate)) {
        matched = candidate;
        break;
      }
    }

    if (matched) {
      out.push(matched);
      i += [...matched].length;
    } else {
      out.push(ch);
      i += 1;
    }
  }

  return out;
}

/**
 * Check that a sentence's authored tokens reassemble into its text exactly.
 * Used by the validator and by the story importer, which refuses a story whose
 * tokens don't line up (the reader renders from tokens, so a mismatch would
 * silently drop text).
 */
export function tokensJoinTo(tokens: readonly { w: string }[], zh: string): boolean {
  return tokens.map((t) => t.w).join('') === zh;
}

/** Where the join first diverges, for a readable validator message. */
export function joinMismatch(
  tokens: readonly { w: string }[],
  zh: string,
): { joined: string; at: number } | null {
  const joined = tokens.map((t) => t.w).join('');
  if (joined === zh) return null;
  let at = 0;
  while (at < joined.length && at < zh.length && joined[at] === zh[at]) at++;
  return { joined, at };
}
