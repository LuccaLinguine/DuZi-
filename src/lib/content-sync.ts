/**
 * Keeps IndexedDB in step with the stories shipped in a deploy.
 *
 * Rules that matter (spec §4):
 *  - new ids are imported
 *  - a changed `hash` on an existing id replaces the story but keeps all
 *    progress, so a story can be corrected or enriched without a reset
 *  - an id that vanishes from the manifest is *hidden*, never deleted — its
 *    progress, ratings and saved words survive
 *  - words new to the device are created as `new` in the word memory
 */
import type { Story, StoryManifest, StoryManifestEntry } from './story-schema.ts';
import { validateStoryShape, asStory } from './story-schema.ts';
import { tokensJoinTo } from './segment.ts';
import { countChineseChars, isWordToken } from './text.ts';
import type { DuziDB } from '../db/index.ts';
import type { StoryRow, WordRow } from '../db/types.ts';

export interface SyncPlan {
  /** Manifest entries with no row yet. */
  added: StoryManifestEntry[];
  /** Entries whose hash differs from the stored row. */
  updated: StoryManifestEntry[];
  /** Ids present on the device but gone from the manifest. */
  removed: string[];
  /** Ids already hidden that came back. */
  restored: string[];
  unchanged: number;
}

/** Pure diff — the half of sync that the unit tests exercise. */
export function planSync(
  manifest: StoryManifest,
  existing: readonly Pick<StoryRow, 'id' | 'hash' | 'source' | 'hidden'>[],
): SyncPlan {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const plan: SyncPlan = { added: [], updated: [], removed: [], restored: [], unchanged: 0 };

  for (const entry of manifest.stories) {
    const row = byId.get(entry.id);
    if (!row) {
      plan.added.push(entry);
    } else if (row.hash !== entry.hash) {
      plan.updated.push(entry);
    } else {
      plan.unchanged++;
      if (row.hidden) plan.restored.push(entry.id);
    }
  }

  const manifestIds = new Set(manifest.stories.map((s) => s.id));
  for (const row of existing) {
    // Only bundled stories can go missing; pasted and hand-imported stories
    // are not in the manifest and must never be hidden by a sync.
    if (row.source === 'bundled' && !manifestIds.has(row.id) && !row.hidden) {
      plan.removed.push(row.id);
    }
  }

  return plan;
}

export function isPlanEmpty(plan: SyncPlan): boolean {
  return (
    plan.added.length === 0 &&
    plan.updated.length === 0 &&
    plan.removed.length === 0 &&
    plan.restored.length === 0
  );
}

/** Turn an authored story + its manifest entry into a storable row. */
export function toStoryRow(
  story: Story,
  entry: Pick<StoryManifestEntry, 'hash' | 'chars' | 'in_level_pct'>,
  source: StoryRow['source'] = 'bundled',
): StoryRow {
  return {
    id: story.id,
    story,
    level: story.level,
    topic: story.topic,
    format: story.format,
    series_id: story.series_id,
    chapter: story.chapter,
    created_at: story.created_at,
    title_zh: story.title_zh,
    title_en: story.title_en,
    chars: entry.chars,
    in_level_pct: entry.in_level_pct,
    hash: entry.hash,
    imported_at: Date.now(),
    source,
    hidden: false,
  };
}

/** Character count of a story's body, used when a manifest entry is absent. */
export function storyChars(story: Story): number {
  return story.sentences.reduce((n, s) => n + countChineseChars(s.zh), 0);
}

/** Every distinct vocabulary word in a story, in first-appearance order. */
export function storyWords(story: Story): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of story.sentences) {
    for (const t of s.tokens) {
      if (!isWordToken(t.w) || seen.has(t.w)) continue;
      seen.add(t.w);
      out.push(t.w);
    }
  }
  return out;
}

export class StoryRejected extends Error {
  constructor(
    readonly storyId: string,
    readonly issues: string[],
  ) {
    super(`Story ${storyId} rejected: ${issues[0] ?? 'unknown problem'}`);
    this.name = 'StoryRejected';
  }
}

/**
 * Validate a story file before it reaches the database. A malformed file from
 * a bad deploy or a hand-import must not take the library down with it.
 */
export function checkStory(data: unknown): Story {
  const issues = validateStoryShape(data).map((i) => `${i.path}: ${i.message}`);
  if (issues.length > 0) {
    const id = (data as { id?: unknown })?.id;
    throw new StoryRejected(typeof id === 'string' ? id : '(unknown id)', issues);
  }
  const story = asStory(data);
  for (const [i, s] of story.sentences.entries()) {
    if (!tokensJoinTo(s.tokens, s.zh)) {
      throw new StoryRejected(story.id, [`sentences[${i}]: tokens do not join to zh`]);
    }
  }
  return story;
}

/** Create word-memory rows for words this device has never seen (status `new`). */
export function newWordRows(words: readonly string[], now = Date.now()): WordRow[] {
  return words.map((w) => ({
    w,
    status: 'new' as const,
    timesSeen: 0,
    timesLookedUp: 0,
    seenWithoutLookup: 0,
    firstSeen: now,
    lastSeen: now,
    lastLookedUp: null,
    cardId: null,
  }));
}

export interface SyncResult extends SyncPlan {
  /** Stories that failed validation and were skipped, with the reason. */
  rejected: { id: string; issues: string[] }[];
  /** Words created in the word memory by this sync. */
  newWords: number;
}

export interface SyncDeps {
  db: DuziDB;
  /** Fetches `content/<file>` relative to the deployed base path. */
  fetchStory: (file: string) => Promise<unknown>;
}

/**
 * Apply a plan: import the added and updated stories, hide the removed ones,
 * un-hide anything that came back, and seed the word memory.
 */
export async function applySync(
  plan: SyncPlan,
  { db, fetchStory }: SyncDeps,
): Promise<SyncResult> {
  const result: SyncResult = { ...plan, rejected: [], newWords: 0 };
  const rows: StoryRow[] = [];
  const words = new Set<string>();

  for (const entry of [...plan.added, ...plan.updated]) {
    try {
      const story = checkStory(await fetchStory(entry.file));
      if (story.id !== entry.id) {
        throw new StoryRejected(story.id, [`id does not match the manifest entry ${entry.id}`]);
      }
      rows.push(toStoryRow(story, entry));
      for (const w of storyWords(story)) words.add(w);
    } catch (err) {
      const issues =
        err instanceof StoryRejected ? err.issues : [err instanceof Error ? err.message : String(err)];
      result.rejected.push({ id: entry.id, issues });
      // Keep going: one bad file must not block the rest of the batch.
    }
  }

  await db.transaction('rw', db.stories, db.words, async () => {
    if (rows.length > 0) {
      // `put` keeps the row's id, so progress (keyed on storyId) is untouched.
      await db.stories.bulkPut(rows);
    }

    for (const id of plan.removed) {
      await db.stories.update(id, { hidden: true });
    }
    for (const id of plan.restored) {
      await db.stories.update(id, { hidden: false });
    }

    const list = [...words];
    if (list.length > 0) {
      const existing = await db.words.bulkGet(list);
      const missing = list.filter((_, i) => existing[i] === undefined);
      if (missing.length > 0) {
        await db.words.bulkAdd(newWordRows(missing));
        result.newWords = missing.length;
      }
    }
  });

  return result;
}

/** Fetch the manifest, diff it, apply it. Returns null when there is nothing to do. */
export async function syncContent(
  manifestUrl: string,
  deps: SyncDeps,
): Promise<SyncResult | null> {
  const res = await fetch(manifestUrl, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load the story manifest (${res.status})`);
  const manifest = (await res.json()) as StoryManifest;
  if (!Array.isArray(manifest.stories)) throw new Error('The story manifest is malformed');

  const existing = await deps.db.stories.toArray();
  const plan = planSync(manifest, existing);
  if (isPlanEmpty(plan)) {
    await deps.db.putSettings({ lastSyncAt: Date.now(), lastManifestAt: manifest.generated_at });
    return null;
  }

  const result = await applySync(plan, deps);
  await deps.db.putSettings({ lastSyncAt: Date.now(), lastManifestAt: manifest.generated_at });
  return result;
}
