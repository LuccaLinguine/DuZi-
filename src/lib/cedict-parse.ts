/**
 * CC-CEDICT line parsing. Lives in src/ rather than scripts/ so the unit tests
 * cover exactly the code the build script runs.
 *
 * A CC-CEDICT line looks like:
 *   漢字 汉字 [han4 zi4] /Chinese character/CL:個|个[ge4]/
 * Lines starting with `#` are comments.
 */
import { numberedToToneMarks } from './pinyin-tones.ts';

export interface CedictEntry {
  /** Simplified headword — the key the app looks up by. */
  simp: string;
  /** Traditional headword. */
  trad: string;
  /** Tone-marked pinyin, e.g. "hàn zì". */
  py: string;
  /** Numbered pinyin as published, kept for debugging. */
  pyNumbered: string;
  defs: string[];
}

/**
 * Definitions carry cross-references with their own numbered pinyin, e.g.
 * "CL:個|个[ge4]". Tone-mark those too so the word sheet reads consistently.
 */
function toneMarkCrossRefs(def: string): string {
  return def.replace(/\[([a-zA-Z0-9:\u00b7\s,]+)\]/g, (whole, inner: string) =>
    /\d/.test(inner) ? `[${numberedToToneMarks(inner)}]` : whole,
  );
}

export function parseCedictLine(line: string): CedictEntry | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const m = /^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.*)\/\s*$/.exec(trimmed);
  if (!m) return null;

  const [, trad, simp, pyNumbered, defBlock] = m as unknown as [
    string, string, string, string, string,
  ];

  const defs = defBlock
    .split('/')
    .map((d) => toneMarkCrossRefs(d.trim()))
    .filter(Boolean);
  if (defs.length === 0) return null;

  return {
    simp,
    trad,
    py: numberedToToneMarks(pyNumbered),
    pyNumbered,
    defs,
  };
}

/** Parse a whole CC-CEDICT file into entries, skipping comments and junk. */
export function parseCedict(text: string): CedictEntry[] {
  const out: CedictEntry[] = [];
  for (const line of text.split('\n')) {
    const entry = parseCedictLine(line);
    if (entry) out.push(entry);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Shard layout                                                        */
/* ------------------------------------------------------------------ */

/**
 * The dictionary is split into shards so the app loads ~200 KB at a time
 * instead of a 12 MB blob. Sharding on the first character means the words of
 * one story cluster into few shards, and the mapping is stable across rebuilds.
 */
export const CEDICT_SHARDS = 64;

export function shardFor(headword: string): number {
  const cp = headword.codePointAt(0);
  if (cp === undefined) return 0;
  return cp % CEDICT_SHARDS;
}

/**
 * On-disk shard format, kept terse on purpose:
 *   { "汉字": [["漢字", "hàn zì", "Chinese character/CL:個|个[ge4]"]] }
 * Definitions are re-joined with "/" because CC-CEDICT definitions never
 * contain a bare slash.
 */
export type PackedEntry = [trad: string, py: string, defs: string];
export type CedictShard = Record<string, PackedEntry[]>;

export function packEntry(e: CedictEntry): PackedEntry {
  return [e.trad, e.py, e.defs.join('/')];
}

export interface DictEntry {
  trad: string;
  py: string;
  defs: string[];
}

export function unpackEntry(p: PackedEntry): DictEntry {
  return { trad: p[0], py: p[1], defs: p[2].split('/').filter(Boolean) };
}

/**
 * The entry to show when only one fits (the character-breakdown chip's short
 * gloss, a headword's headline pinyin). Several simplified headwords collapse
 * two distinct traditional characters into one CC-CEDICT key — 家 (home,
 * common) and 傢 (a bound form used only in 傢伙/傢俱, rare) both simplify to
 * 家 — and the rare one isn't reliably last, so entries[0] is not safe to
 * assume is the common reading. An entry whose traditional form is unchanged
 * from the simplified query is the modern, undifferentiated character, which
 * is the one a learner means; entries that only exist because of a
 * simplification are the secondary ones.
 */
export function primaryEntry(word: string, entries: readonly DictEntry[]): DictEntry | undefined {
  return entries.find((e) => e.trad === word) ?? entries[0];
}

/**
 * Best-effort pinyin for a word: its own primary CC-CEDICT entry if it has
 * one, or — for a transparent compound CC-CEDICT doesn't carry as a headword
 * in its own right (我家, 星期六) — each character's primary reading joined
 * together. `dict` must already cover both the word and its characters.
 * Used where a rough reading is good enough (profile export); anywhere
 * context matters, the story's own token pinyin is used instead.
 */
export function bestEffortPinyin(word: string, dict: ReadonlyMap<string, DictEntry[]>): string {
  const whole = primaryEntry(word, dict.get(word) ?? []);
  if (whole) return whole.py;

  const chars = [...word];
  if (chars.length < 2) return '';
  const readings = chars.map((c) => primaryEntry(c, dict.get(c) ?? [])?.py);
  return readings.every((p): p is string => Boolean(p)) ? readings.join(' ') : '';
}
