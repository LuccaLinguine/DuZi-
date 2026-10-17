/**
 * Gathers learner-profile.json from IndexedDB and the dictionary, then hands
 * it to lib/profile-export.ts to assemble. This half is deliberately not
 * unit tested — it's a thin fan-out of reads; the aggregation math it feeds
 * is tested where it's defined.
 */
import { db } from './index.ts';
import { lookupWords } from '../lib/dictionary.ts';
import { bestEffortPinyin } from '../lib/cedict-parse.ts';
import { splitChars } from '../lib/text.ts';
import { buildLearnerProfile, type LearnerProfile } from '../lib/profile-export.ts';
import { dataUrl } from '../lib/paths.ts';
import type { HskMap } from '../lib/hsk.ts';

async function loadHsk(): Promise<HskMap> {
  const res = await fetch(dataUrl('hsk/hsk3.json'));
  if (!res.ok) throw new Error(`hsk3.json: ${res.status}`);
  return res.json() as Promise<HskMap>;
}

export async function gatherLearnerProfile(): Promise<LearnerProfile> {
  const [settings, allWords, allProgress, allTexts, allRequests, hsk] = await Promise.all([
    db.getSettings(),
    db.words.toArray(),
    db.progress.toArray(),
    db.texts.toArray(),
    db.requests.toArray(),
    loadHsk(),
  ]);

  // Booleans aren't valid IndexedDB index keys, so `read`/`enrich` can't be
  // queried with `.where(...).equals(...)` — filter the full table in JS,
  // same as the Library screen already does for `read`.
  const progressRows = allProgress.filter((p) => p.read);
  const texts = allTexts.filter((t) => t.enrich);
  const queued = allRequests.filter((r) => r.status === 'queued');

  const learningRows = allWords.filter((w) => w.status === 'learning');
  const knownWords = allWords.filter((w) => w.status === 'known').map((w) => w.w);

  // Look up both the whole words and their individual characters, so
  // bestEffortPinyin can fall back to joining character readings for a
  // compound CC-CEDICT doesn't carry as its own headword (我家, 星期六).
  const learningLookups = [...new Set(learningRows.flatMap((w) => [w.w, ...splitChars(w.w)]))];
  const dict = await lookupWords(learningLookups);
  const learningWords = learningRows.map((w) => ({
    w: w.w,
    py: bestEffortPinyin(w.w, dict),
    lookups: w.timesLookedUp,
    lastSeen: w.lastSeen,
  }));

  const readStoryIds = progressRows.map((p) => p.storyId);
  const stories = await db.stories.bulkGet(readStoryIds);
  const reads = progressRows.map((p, i) => {
    const story = stories[i];
    return {
      id: p.storyId,
      title_zh: story?.title_zh ?? p.storyId,
      topic: story?.topic ?? '',
      rating: p.rating,
    };
  });

  return buildLearnerProfile({
    level: settings.defaultLevel,
    learningWords,
    knownWords,
    hsk,
    reads,
    pastedTexts: texts.map((t) => ({ id: t.id, title: t.title, raw: t.raw })),
    queuedRequests: queued.map((r) => ({
      id: r.id,
      level: r.level,
      topic: r.topic,
      format: r.format,
      count: r.count,
      seriesId: r.seriesId,
      note: r.note,
    })),
    now: Date.now(),
  });
}
