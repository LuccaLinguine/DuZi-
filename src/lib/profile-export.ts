/**
 * Builds `learner-profile.json` (spec section 4) from already-gathered data.
 * Kept free of Dexie and dictionary lookups so the shape and the aggregation
 * math (known-word counts per HSK band, average rating per topic) are unit
 * tested directly; src/db/profile.ts does the gathering and calls this.
 */
import type { LevelId } from './levels.ts';
import type { StoryFormat } from './story-schema.ts';
import type { HskMap } from './hsk.ts';

export interface LearnerProfile {
  exported_at: string;
  level: LevelId;
  learning: { w: string; py: string; lookups: number; lastSeen: string }[];
  known_counts: Record<string, number>;
  read: { id: string; title_zh: string; topic: string; rating: 'up' | 'down' | null }[];
  topic_ratings: Record<string, number>;
  pasted_texts: { id: string; title: string; raw: string }[];
  requests: {
    id: string;
    level: LevelId;
    topic: string;
    format: StoryFormat;
    count: number;
    seriesId: string | null;
    note: string;
  }[];
}

/** YYYY-MM-DD in local time — matches the format `/stories` and CONTENT.md expect. */
export function formatLocalDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Known words bucketed by HSK 3.0 band; words absent from the list are skipped. */
export function computeKnownCounts(knownWords: readonly string[], hsk: HskMap): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const w of knownWords) {
    const level = hsk[w];
    if (level === undefined) continue;
    const key = String(level);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Mean rating per topic, on a -1…1 scale (👎 = -1, 👍 = +1), rounded to two
 * decimals. Unrated reads are excluded rather than counted as 0 — "no
 * opinion" shouldn't drag a topic's average down.
 */
export function computeTopicRatings(
  reads: readonly { topic: string; rating: 'up' | 'down' | null }[],
): Record<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const r of reads) {
    if (r.rating === null) continue;
    const entry = sums.get(r.topic) ?? { total: 0, count: 0 };
    entry.total += r.rating === 'up' ? 1 : -1;
    entry.count += 1;
    sums.set(r.topic, entry);
  }
  const out: Record<string, number> = {};
  for (const [topic, { total, count }] of sums) {
    out[topic] = Math.round((total / count) * 100) / 100;
  }
  return out;
}

export interface BuildProfileInput {
  level: LevelId;
  /** Words currently in `learning` status, with a dictionary-resolved reading. */
  learningWords: { w: string; py: string; lookups: number; lastSeen: number }[];
  /** Words currently in `known` status, by headword only. */
  knownWords: string[];
  hsk: HskMap;
  reads: { id: string; title_zh: string; topic: string; rating: 'up' | 'down' | null }[];
  pastedTexts: { id: string; title: string; raw: string }[];
  queuedRequests: LearnerProfile['requests'];
  now: number;
}

export function buildLearnerProfile(input: BuildProfileInput): LearnerProfile {
  return {
    exported_at: new Date(input.now).toISOString(),
    level: input.level,
    // Least-recently-seen first, so /stories works through the words most
    // overdue for reinforcement first when it spreads them across a batch.
    learning: [...input.learningWords]
      .sort((a, b) => a.lastSeen - b.lastSeen)
      .map((w) => ({ w: w.w, py: w.py, lookups: w.lookups, lastSeen: formatLocalDate(w.lastSeen) })),
    known_counts: computeKnownCounts(input.knownWords, input.hsk),
    read: input.reads,
    topic_ratings: computeTopicRatings(input.reads),
    pasted_texts: input.pastedTexts,
    requests: input.queuedRequests,
  };
}
