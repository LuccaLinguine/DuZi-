/**
 * Settings → Import stories (spec section 4): a no-deploy fallback for
 * getting authored story JSON onto the phone directly — AirDropped files,
 * say — without waiting for a Pages deploy. Reuses the exact same validation
 * (`checkStory`) and HSK-coverage math the content sync and the build-time
 * validator use, so a hand-imported story is held to the same bar.
 */
import { db } from './index.ts';
import { checkStory, toStoryRow, storyChars, storyWords, newWordRows, StoryRejected } from '../lib/content-sync.ts';
import { computeInLevel } from '../lib/hsk.ts';
import type { HskMap } from '../lib/hsk.ts';
import type { StoryRow } from './types.ts';

export interface ManualImportResult {
  imported: string[];
  rejected: { file: string; issues: string[] }[];
}

/** `files` are raw JSON text keyed by filename, for a readable error report. */
export async function importStoryFiles(
  files: Record<string, string>,
  hsk: HskMap,
): Promise<ManualImportResult> {
  const result: ManualImportResult = { imported: [], rejected: [] };
  const rows: StoryRow[] = [];
  const allWords = new Set<string>();

  for (const [filename, text] of Object.entries(files)) {
    try {
      const data = JSON.parse(text) as unknown;
      const story = checkStory(data);
      const chars = storyChars(story);
      const tokens = story.sentences.flatMap((s) => s.tokens.map((t) => t.w));
      const inLevelPct = computeInLevel(tokens, story.level, hsk).pct;
      // Content hash mirrors the manifest's role: a re-import of the same
      // file with the same content is a no-op; edited content re-imports.
      const hash = await sha256Hex(text);
      rows.push(toStoryRow(story, { hash, chars, in_level_pct: inLevelPct }, 'imported'));
      for (const w of storyWords(story)) allWords.add(w);
      result.imported.push(story.id);
    } catch (err) {
      const issues =
        err instanceof StoryRejected
          ? err.issues
          : err instanceof SyntaxError
            ? [`invalid JSON: ${err.message}`]
            : [err instanceof Error ? err.message : String(err)];
      result.rejected.push({ file: filename, issues });
    }
  }

  if (rows.length > 0) {
    await db.transaction('rw', db.stories, db.words, async () => {
      await db.stories.bulkPut(rows);
      const words = [...allWords];
      const existing = await db.words.bulkGet(words);
      const missing = words.filter((_, i) => existing[i] === undefined);
      if (missing.length > 0) await db.words.bulkAdd(newWordRows(missing));
    });
  }

  return result;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
