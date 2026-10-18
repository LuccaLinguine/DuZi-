/**
 * Turns pasted raw text into a Story object the existing Reader can render
 * (spec section 8). No sentence translations, no gloss, no grammar points or
 * comprehension questions at this stage — those need a human/LLM pass, which
 * is exactly what "Enrich on next batch" queues up. `gloss`/`pos` are left
 * `""` on every token; the reader already treats a missing context gloss as
 * "fall through to the CC-CEDICT lookup", which is the intended behaviour
 * here — tap any word for its dictionary entry, same as any authored story.
 *
 * Deliberately bypasses the authored-content schema in story-schema.ts
 * (which requires at least one grammar point and two questions): that
 * contract is for batches written by /stories, not a rough local import.
 */
import { splitSentences, countChineseChars } from './text.ts';
import { segment } from './segment.ts';
import type { Sentence, Story, Token } from './story-schema.ts';
import type { LevelId } from './levels.ts';

export interface SegmentedSentence {
  zh: string;
  tokens: string[];
}

/** Split and word-segment raw pasted text. Pure — pinyin is filled in afterwards. */
export function segmentPastedText(raw: string, isHeadword: (w: string) => boolean): SegmentedSentence[] {
  return splitSentences(raw).map((zh) => ({ zh, tokens: segment(zh, { has: isHeadword }) }));
}

export interface BuildPastedStoryInput {
  id: string;
  title: string;
  level: LevelId;
  sentences: readonly { zh: string; tokens: readonly string[]; pinyin: readonly string[] }[];
}

/** Assembles the Story object; `pinyin` must already be in 1:1 correspondence with `tokens`. */
export function buildPastedStory(input: BuildPastedStoryInput): Story {
  const sentences: Sentence[] = input.sentences.map((s) => ({
    zh: s.zh,
    en: '',
    tokens: s.tokens.map((w, i): Token => ({ w, py: s.pinyin[i] ?? '', gloss: '', pos: '' })),
  }));

  return {
    id: input.id,
    series_id: null,
    chapter: null,
    topic: 'Imported text',
    format: 'article',
    created_at: new Date().toISOString().slice(0, 10),
    // Not AI-authored — this is the learner's own pasted text, machine-
    // segmented. "Enrich on next batch" is what turns it into a /stories
    // story, which does set this true at that point.
    ai_generated: false,
    title_zh: input.title || input.sentences[0]?.zh.slice(0, 12) || input.id,
    title_en: input.title,
    summary_en: '',
    level: input.level,
    sentences,
    new_words: [],
    grammar_points: [],
    questions: [],
  };
}

export function pastedStoryChars(sentences: readonly { zh: string }[]): number {
  return sentences.reduce((n, s) => n + countChineseChars(s.zh), 0);
}
