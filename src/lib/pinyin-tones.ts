/**
 * CC-CEDICT stores pinyin with trailing tone numbers ("ni3 hao3", "lu:4 shi1").
 * The reader shows tone marks, so the build scripts convert once, at build time.
 *
 * Shared by `scripts/build-cedict.ts` and the app's unit tests.
 */

const TONE_MARKS: Record<string, string[]> = {
  // index = tone - 1; tone 5 (neutral) is unmarked
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

const VOWELS = 'aeiouü';

/**
 * Which vowel in a syllable carries the mark:
 *   1. an `a` or `e` always wins (they never co-occur in a syllable)
 *   2. in `ou`, the `o` takes it
 *   3. otherwise the last vowel takes it
 */
function markedVowelIndex(syllable: string): number {
  const lower = syllable.toLowerCase();
  for (const v of ['a', 'e']) {
    const i = lower.indexOf(v);
    if (i !== -1) return i;
  }
  const ou = lower.indexOf('ou');
  if (ou !== -1) return ou;
  for (let i = lower.length - 1; i >= 0; i--) {
    if (VOWELS.includes(lower[i]!)) return i;
  }
  return -1;
}

/** Convert one numbered syllable ("hao3", "lu:4", "r5") to tone marks. */
export function syllableToToneMarks(raw: string): string {
  // CC-CEDICT writes ü as "u:" (and occasionally "v").
  let s = raw.replace(/u:/gi, 'ü').replace(/v/g, 'ü').replace(/V/g, 'Ü');

  const m = /^(.*?)([1-5])$/.exec(s);
  if (!m) return s;
  const [, body, digit] = m as unknown as [string, string, string];
  s = body;

  const tone = Number(digit);
  if (tone === 5) return s; // neutral tone: no mark

  const i = markedVowelIndex(s);
  if (i === -1) return s;

  const vowel = s[i]!;
  const marks = TONE_MARKS[vowel.toLowerCase()];
  if (!marks) return s;
  const marked = marks[tone - 1]!;
  return s.slice(0, i) + (vowel === vowel.toUpperCase() ? marked.toUpperCase() : marked) + s.slice(i + 1);
}

/**
 * Convert a whole CC-CEDICT pinyin field ("Zhong1 guo2 ren2") to tone marks
 * ("Zhōng guó rén"). Non-syllable tokens (punctuation, Latin abbreviations,
 * the "xx5" placeholder) are passed through untouched.
 */
export function numberedToToneMarks(pinyin: string): string {
  return pinyin
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : syllableToToneMarks(part)))
    .join('');
}

/** Strip tone marks, e.g. for accent-insensitive search. "nǐ hǎo" → "ni hao". */
export function stripTones(pinyin: string): string {
  return pinyin.normalize('NFD').replace(/[\u0300-\u030f]/g, '').normalize('NFC');
}
