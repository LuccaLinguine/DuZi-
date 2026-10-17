import { describe, it, expect } from 'vitest';
import { computeKnownCounts, computeTopicRatings, formatLocalDate, buildLearnerProfile } from './profile-export.ts';
import type { HskMap } from './hsk.ts';

describe('formatLocalDate', () => {
  it('formats as YYYY-MM-DD, zero-padded', () => {
    expect(formatLocalDate(new Date(2026, 0, 5).getTime())).toBe('2026-01-05');
    expect(formatLocalDate(new Date(2026, 10, 17).getTime())).toBe('2026-11-17');
  });
});

describe('computeKnownCounts', () => {
  const hsk: HskMap = { 你好: 1, 朋友: 1, 奇怪: 3, 经济: 5 };

  it('buckets known words by their HSK band', () => {
    expect(computeKnownCounts(['你好', '朋友', '奇怪'], hsk)).toEqual({ '1': 2, '3': 1 });
  });

  it('skips words absent from the HSK list', () => {
    expect(computeKnownCounts(['你好', '龘'], hsk)).toEqual({ '1': 1 });
  });

  it('returns an empty object for no known words', () => {
    expect(computeKnownCounts([], hsk)).toEqual({});
  });
});

describe('computeTopicRatings', () => {
  it('averages up/down as +1/-1', () => {
    const ratings = computeTopicRatings([
      { topic: 'Food', rating: 'up' },
      { topic: 'Food', rating: 'up' },
      { topic: 'Food', rating: 'down' },
    ]);
    // (1 + 1 - 1) / 3 = 0.33
    expect(ratings.Food).toBeCloseTo(0.33, 2);
  });

  it('excludes unrated reads rather than counting them as neutral', () => {
    const ratings = computeTopicRatings([
      { topic: 'Mystery', rating: 'up' },
      { topic: 'Mystery', rating: null },
    ]);
    expect(ratings.Mystery).toBe(1);
  });

  it('omits a topic with no rated reads at all', () => {
    const ratings = computeTopicRatings([{ topic: 'Travel', rating: null }]);
    expect(ratings.Travel).toBeUndefined();
  });

  it('keeps topics separate', () => {
    const ratings = computeTopicRatings([
      { topic: 'Food', rating: 'up' },
      { topic: 'Travel', rating: 'down' },
    ]);
    expect(ratings).toEqual({ Food: 1, Travel: -1 });
  });
});

describe('buildLearnerProfile', () => {
  const hsk: HskMap = { 忘记: 3 };

  it('assembles the full shape', () => {
    const profile = buildLearnerProfile({
      level: 'elementary',
      learningWords: [{ w: '忘记', py: 'wàng jì', lookups: 4, lastSeen: new Date(2026, 9, 14).getTime() }],
      knownWords: ['忘记'],
      hsk,
      reads: [{ id: 's1', title_zh: '丢了的猫', topic: 'Daily life', rating: 'up' }],
      pastedTexts: [],
      queuedRequests: [
        { id: 'req-1', level: 'elementary', topic: 'Food', format: 'story', count: 3, seriesId: null, note: '' },
      ],
      now: new Date(2026, 9, 17, 9, 0, 0).getTime(),
    });

    expect(profile.level).toBe('elementary');
    expect(profile.learning).toEqual([{ w: '忘记', py: 'wàng jì', lookups: 4, lastSeen: '2026-10-14' }]);
    expect(profile.known_counts).toEqual({ '3': 1 });
    expect(profile.read).toHaveLength(1);
    expect(profile.topic_ratings).toEqual({ 'Daily life': 1 });
    expect(profile.requests).toHaveLength(1);
    expect(profile.exported_at).toMatch(/^2026-10-17T/);
  });

  it('sorts learning words least-recently-seen first', () => {
    const profile = buildLearnerProfile({
      level: 'newbie',
      learningWords: [
        { w: 'recent', py: '', lookups: 1, lastSeen: 300 },
        { w: 'oldest', py: '', lookups: 1, lastSeen: 100 },
        { w: 'middle', py: '', lookups: 1, lastSeen: 200 },
      ],
      knownWords: [],
      hsk: {},
      reads: [],
      pastedTexts: [],
      queuedRequests: [],
      now: 1000,
    });
    expect(profile.learning.map((w) => w.w)).toEqual(['oldest', 'middle', 'recent']);
  });
});
