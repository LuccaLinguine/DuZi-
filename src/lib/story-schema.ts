/**
 * The story JSON contract, shared verbatim between the app (which imports
 * story files into IndexedDB) and `scripts/validate-stories.ts` (which checks
 * every batch before it can be deployed).
 *
 * The shapes here are the source of truth for CONTENT.md. If you change one,
 * change CONTENT.md and the `/stories` command in the same commit.
 */
import type { LevelId } from './levels.ts';
import { isLevelId } from './levels.ts';

export type StoryFormat = 'story' | 'dialogue' | 'article';

export interface Token {
  /** The word, or a run of punctuation. */
  w: string;
  /** Tone-marked pinyin for this word in context; "" for punctuation. */
  py: string;
  /** Short English meaning in this context; "" for punctuation. */
  gloss: string;
}

export interface Sentence {
  zh: string;
  en: string;
  /** Word-segmented `zh`, in order; the `w` fields concatenate back to `zh`. */
  tokens: Token[];
}

export interface NewWord {
  w: string;
  py: string;
  gloss: string;
}

export interface GrammarPoint {
  pattern: string;
  explanation_en: string;
  example_zh: string;
  example_en: string;
}

export interface Question {
  q_zh: string;
  q_en: string;
  answer_en: string;
}

export interface Story {
  /** Stable forever once written — reading progress is keyed on it. */
  id: string;
  series_id: string | null;
  chapter: number | null;
  topic: string;
  format: StoryFormat;
  /** ISO date. */
  created_at: string;
  title_zh: string;
  title_en: string;
  summary_en: string;
  level: LevelId;
  sentences: Sentence[];
  new_words: NewWord[];
  grammar_points: GrammarPoint[];
  questions: Question[];
}

/** One row of `content/index.json`, the manifest the app syncs against. */
export interface StoryManifestEntry {
  id: string;
  file: string;
  title_zh: string;
  title_en: string;
  level: LevelId;
  topic: string;
  format: StoryFormat;
  series_id: string | null;
  chapter: number | null;
  created_at: string;
  chars: number;
  /** Share of non-punctuation tokens at or below the level's HSK ceiling. */
  in_level_pct: number;
  /** Changes whenever the story file's content changes; drives re-import. */
  hash: string;
}

export interface StoryManifest {
  generated_at: string;
  stories: StoryManifestEntry[];
}

export const STORY_FORMATS: StoryFormat[] = ['story', 'dialogue', 'article'];

/* ------------------------------------------------------------------ */
/* Structural validation                                               */
/* ------------------------------------------------------------------ */

export interface SchemaIssue {
  path: string;
  message: string;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function checkString(
  v: unknown,
  path: string,
  issues: SchemaIssue[],
  { allowEmpty = false } = {},
): void {
  if (typeof v !== 'string') {
    issues.push({ path, message: `expected a string, got ${describe(v)}` });
  } else if (!allowEmpty && v.trim() === '') {
    issues.push({ path, message: 'must not be empty' });
  }
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'an array';
  return typeof v;
}

function checkArray(
  v: unknown,
  path: string,
  issues: SchemaIssue[],
  min = 0,
): v is unknown[] {
  if (!Array.isArray(v)) {
    issues.push({ path, message: `expected an array, got ${describe(v)}` });
    return false;
  }
  if (v.length < min) {
    issues.push({ path, message: `expected at least ${min} item(s), got ${v.length}` });
  }
  return true;
}

/**
 * Validate the *shape* of a parsed story file. Content-quality checks (token
 * joins, HSK coverage, length) live in `scripts/validate-stories.ts`, which
 * runs this first.
 */
export function validateStoryShape(data: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  if (!isObj(data)) {
    return [{ path: '', message: `expected a JSON object, got ${describe(data)}` }];
  }

  checkString(data.id, 'id', issues);
  checkString(data.topic, 'topic', issues);
  checkString(data.title_zh, 'title_zh', issues);
  checkString(data.title_en, 'title_en', issues);
  checkString(data.summary_en, 'summary_en', issues);
  checkString(data.created_at, 'created_at', issues);

  if (typeof data.created_at === 'string' && Number.isNaN(Date.parse(data.created_at))) {
    issues.push({ path: 'created_at', message: `not a parseable date: ${data.created_at}` });
  }

  if (!isLevelId(data.level)) {
    issues.push({ path: 'level', message: `unknown level: ${JSON.stringify(data.level)}` });
  }
  if (!STORY_FORMATS.includes(data.format as StoryFormat)) {
    issues.push({
      path: 'format',
      message: `expected one of ${STORY_FORMATS.join(' | ')}, got ${JSON.stringify(data.format)}`,
    });
  }

  if (data.series_id !== null && typeof data.series_id !== 'string') {
    issues.push({ path: 'series_id', message: 'expected a string or null' });
  }
  if (data.chapter !== null && !Number.isInteger(data.chapter)) {
    issues.push({ path: 'chapter', message: 'expected an integer or null' });
  }
  if (typeof data.series_id === 'string' && data.chapter === null) {
    issues.push({ path: 'chapter', message: 'a story in a series needs a chapter number' });
  }

  if (checkArray(data.sentences, 'sentences', issues, 1)) {
    data.sentences.forEach((s, i) => validateSentence(s, `sentences[${i}]`, issues));
  }

  if (checkArray(data.new_words, 'new_words', issues)) {
    data.new_words.forEach((w, i) => {
      const p = `new_words[${i}]`;
      if (!isObj(w)) {
        issues.push({ path: p, message: 'expected an object' });
        return;
      }
      checkString(w.w, `${p}.w`, issues);
      checkString(w.py, `${p}.py`, issues);
      checkString(w.gloss, `${p}.gloss`, issues);
    });
  }

  if (checkArray(data.grammar_points, 'grammar_points', issues, 1)) {
    if (data.grammar_points.length > 3) {
      issues.push({ path: 'grammar_points', message: 'expected 1–3 points' });
    }
    data.grammar_points.forEach((g, i) => {
      const p = `grammar_points[${i}]`;
      if (!isObj(g)) {
        issues.push({ path: p, message: 'expected an object' });
        return;
      }
      checkString(g.pattern, `${p}.pattern`, issues);
      checkString(g.explanation_en, `${p}.explanation_en`, issues);
      checkString(g.example_zh, `${p}.example_zh`, issues);
      checkString(g.example_en, `${p}.example_en`, issues);
    });
  }

  if (checkArray(data.questions, 'questions', issues, 2)) {
    if (data.questions.length > 3) {
      issues.push({ path: 'questions', message: 'expected 2–3 questions' });
    }
    data.questions.forEach((q, i) => {
      const p = `questions[${i}]`;
      if (!isObj(q)) {
        issues.push({ path: p, message: 'expected an object' });
        return;
      }
      checkString(q.q_zh, `${p}.q_zh`, issues);
      checkString(q.q_en, `${p}.q_en`, issues);
      checkString(q.answer_en, `${p}.answer_en`, issues);
    });
  }

  return issues;
}

function validateSentence(s: unknown, path: string, issues: SchemaIssue[]): void {
  if (!isObj(s)) {
    issues.push({ path, message: 'expected an object' });
    return;
  }
  checkString(s.zh, `${path}.zh`, issues);
  checkString(s.en, `${path}.en`, issues);
  if (!checkArray(s.tokens, `${path}.tokens`, issues, 1)) return;

  s.tokens.forEach((t, i) => {
    const p = `${path}.tokens[${i}]`;
    if (!isObj(t)) {
      issues.push({ path: p, message: 'expected an object' });
      return;
    }
    checkString(t.w, `${p}.w`, issues);
    // py/gloss are legitimately "" for punctuation; the content checks in
    // validate-stories.ts enforce non-empty for real words.
    checkString(t.py, `${p}.py`, issues, { allowEmpty: true });
    checkString(t.gloss, `${p}.gloss`, issues, { allowEmpty: true });
  });
}

/** Narrow a parsed file to `Story` once `validateStoryShape` found no issues. */
export function asStory(data: unknown): Story {
  return data as Story;
}
