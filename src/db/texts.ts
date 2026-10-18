/**
 * Paste-your-own-text (spec section 8). Orchestrates the async dictionary and
 * pinyin lookups, then stores the result as a `StoryRow` with
 * `source: 'pasted'` so it opens in the exact same Reader as any other story.
 */
import { db } from './index.ts';
import { headwordChecker } from '../lib/dictionary.ts';
import { pinyinForTokens } from '../lib/local-pinyin.ts';
import { segmentPastedText, buildPastedStory, pastedStoryChars } from '../lib/paste-import.ts';
import { storyWords, newWordRows } from '../lib/content-sync.ts';
import { computeInLevel } from '../lib/hsk.ts';
import type { LevelId } from '../lib/levels.ts';
import type { HskMap } from '../lib/hsk.ts';
import type { StoryRow, PastedTextRow } from './types.ts';

export interface ImportTextInput {
  title: string;
  raw: string;
  level: LevelId;
  enrich: boolean;
  hsk: HskMap;
}

export async function importPastedText({ title, raw, level, enrich, hsk }: ImportTextInput): Promise<string> {
  const id = `paste-${Date.now()}`;
  const isHeadword = await headwordChecker(raw);
  const segmented = segmentPastedText(raw, isHeadword);

  const withPinyin = await Promise.all(
    segmented.map(async (s) => ({ ...s, pinyin: await pinyinForTokens(s.tokens, s.zh) })),
  );

  const story = buildPastedStory({ id, title, level, sentences: withPinyin });
  const chars = pastedStoryChars(story.sentences);
  const allTokens = story.sentences.flatMap((s) => s.tokens.map((t) => t.w));
  const inLevelPct = computeInLevel(allTokens, level, hsk).pct;

  const row: StoryRow = {
    id,
    story,
    level,
    topic: story.topic,
    format: story.format,
    series_id: null,
    chapter: null,
    created_at: story.created_at,
    title_zh: story.title_zh,
    title_en: story.title_en,
    chars,
    in_level_pct: inLevelPct,
    hash: id, // local-only row; a server batch with the same id replaces it wholesale on sync
    imported_at: Date.now(),
    source: 'pasted',
    hidden: false,
  };

  const textRow: PastedTextRow = {
    id,
    title: title || story.title_zh,
    raw,
    createdAt: Date.now(),
    enrich,
    enrichedAt: null,
  };

  await db.transaction('rw', db.stories, db.texts, db.words, async () => {
    await db.stories.put(row);
    await db.texts.put(textRow);

    const words = storyWords(story);
    const existing = await db.words.bulkGet(words);
    const missing = words.filter((_, i) => existing[i] === undefined);
    if (missing.length > 0) await db.words.bulkAdd(newWordRows(missing));
  });

  return id;
}

export async function setTextEnrich(id: string, enrich: boolean): Promise<void> {
  await db.texts.update(id, { enrich });
}

export async function deletePastedText(id: string): Promise<void> {
  await db.transaction('rw', db.stories, db.texts, async () => {
    await db.stories.delete(id);
    await db.texts.delete(id);
  });
}
