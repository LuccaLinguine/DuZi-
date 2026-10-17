/**
 * Small text predicates shared by the app, the validator and the segmenter.
 *
 * "Word" here means something worth tracking in the word memory and counting
 * towards HSK coverage: punctuation, digits and Latin runs are not words.
 */

const CJK = /\p{Script=Han}/u;
const CJK_ONLY = /^\p{Script=Han}+$/u;

/** True if the string contains at least one Han character. */
export function hasHan(s: string): boolean {
  return CJK.test(s);
}

/** True for a token made entirely of Han characters. */
export function isHanOnly(s: string): boolean {
  return CJK_ONLY.test(s);
}

/**
 * Tokens that carry no vocabulary: punctuation (full- and half-width),
 * whitespace, digits, and Latin-only runs. These get `py: ""` / `gloss: ""`
 * in story files and are skipped by the word memory and the HSK count.
 */
export function isPunctuationToken(w: string): boolean {
  return !hasHan(w);
}

/** True if this token should be tracked as a vocabulary item. */
export function isWordToken(w: string): boolean {
  return hasHan(w);
}

/** Number of Han characters in a string — the unit story lengths are given in. */
export function countChineseChars(s: string): number {
  return (s.match(/\p{Script=Han}/gu) ?? []).length;
}

/** The characters of a word, for the per-character breakdown in the word sheet. */
export function splitChars(w: string): string[] {
  return [...w].filter((c) => hasHan(c));
}

/**
 * Chinese punctuation that ends a sentence — used when splitting pasted text
 * (section 8) into sentences.
 */
export const SENTENCE_ENDERS = '。！？；…';

/** Split a raw Chinese paragraph into sentences, keeping trailing punctuation. */
export function splitSentences(text: string): string[] {
  // Each match is a run up to and including its sentence-ending punctuation,
  // plus any closing quote or bracket that belongs with it; the final
  // alternative catches a trailing fragment with no ender.
  const re = /[^\u3002\uff01\uff1f\uff1b\u2026]*[\u3002\uff01\uff1f\uff1b\u2026]+[\u201d\u300d\u300f)\uff09]*|[^\u3002\uff01\uff1f\uff1b\u2026]+$/gu;
  const out: string[] = [];
  for (const line of text.split(/[\r\n]+/)) {
    for (const m of line.matchAll(re)) {
      const s = m[0].trim();
      if (s) out.push(s);
    }
  }
  return out;
}
