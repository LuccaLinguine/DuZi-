/**
 * Colours for the reader's optional "colour by grammatical function" mode.
 * An 8-slot categorical palette, derived from a validated reference set
 * (dataviz skill) and re-stepped for two things that reference instance
 * doesn't cover: these are literal text glyphs, not chart marks, so they're
 * held to WCAG text contrast (4.5:1) rather than the 3:1 mark threshold —
 * and the app has a third, sepia theme alongside light/dark, which the
 * light-mode steps are re-targeted to clear as well (sepia's cream surface
 * gives noticeably less headroom than white).
 *
 * Re-validated after re-stepping: all CVD/lightness/chroma/contrast checks
 * pass against #ffffff, #f8efdd (sepia) and #1a1713 (dark) surfaces; the
 * floor-band CVD pair (quant↔pron) is legal because colour is never the only
 * cue — the word sheet always shows the part of speech as text too.
 */
import type { Pos } from './story-schema.ts';

export const POS_LABELS: Record<Pos, string> = {
  noun: 'Noun',
  verb: 'Verb',
  adj: 'Adjective',
  adv: 'Adverb',
  pron: 'Pronoun',
  quant: 'Number / measure word',
  part: 'Particle',
  conn: 'Preposition / conjunction',
};

const LIGHT: Record<Pos, string> = {
  noun: '#256cc1',
  verb: '#c04413',
  adj: '#137a55',
  adv: '#8d5c07',
  pron: '#ca2362',
  quant: '#007e00',
  part: '#4a3aa7',
  conn: '#d32120',
};

const DARK: Record<Pos, string> = {
  noun: '#3987e5',
  verb: '#d95926',
  adj: '#199e70',
  adv: '#c98500',
  pron: '#d55181',
  quant: '#009a00',
  part: '#9085e9',
  conn: '#e66767',
};

/**
 * Light and sepia themes share the same steps — both are light-family
 * surfaces. Takes the *resolved* theme (never 'system' — applyTheme() always
 * stamps a concrete 'light' or 'dark' onto <html>, even for the system
 * setting, so callers read that rather than the raw user preference).
 */
export function posColor(pos: Pos, resolvedTheme: 'light' | 'dark' | 'sepia'): string {
  return (resolvedTheme === 'dark' ? DARK : LIGHT)[pos];
}

export const POS_ORDER: Pos[] = ['noun', 'verb', 'adj', 'adv', 'pron', 'quant', 'part', 'conn'];
