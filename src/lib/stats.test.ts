import { describe, it, expect } from 'vitest';
import { charsPerDay, computeReadingTotals, computeStreak, estimateVocabulary } from './stats.ts';

const NOW = new Date(2026, 9, 18, 12, 0).getTime(); // 2026-10-18 noon, local
const DAY = 86_400_000;

describe('charsPerDay', () => {
  it('zero-fills days with no reads', () => {
    const result = charsPerDay([], NOW, 3);
    expect(result).toEqual([
      { date: '2026-10-16', chars: 0 },
      { date: '2026-10-17', chars: 0 },
      { date: '2026-10-18', chars: 0 },
    ]);
  });

  it('sums multiple reads on the same day', () => {
    const result = charsPerDay([{ at: NOW, chars: 100 }, { at: NOW - 3600_000, chars: 50 }], NOW, 1);
    expect(result).toEqual([{ date: '2026-10-18', chars: 150 }]);
  });

  it('buckets reads into the correct local day', () => {
    const yesterday = NOW - DAY;
    const result = charsPerDay([{ at: yesterday, chars: 80 }], NOW, 2);
    expect(result).toEqual([
      { date: '2026-10-17', chars: 80 },
      { date: '2026-10-18', chars: 0 },
    ]);
  });

  it('ignores reads outside the requested window', () => {
    const result = charsPerDay([{ at: NOW - 10 * DAY, chars: 999 }], NOW, 3);
    expect(result.reduce((n, d) => n + d.chars, 0)).toBe(0);
  });
});

describe('computeReadingTotals', () => {
  it('counts stories and total characters', () => {
    const totals = computeReadingTotals([{ at: NOW, chars: 100 }, { at: NOW, chars: 200 }], NOW);
    expect(totals.storiesRead).toBe(2);
    expect(totals.charsReadTotal).toBe(300);
  });

  it('sums only the last 7 days for the weekly figure', () => {
    const totals = computeReadingTotals(
      [
        { at: NOW, chars: 100 },
        { at: NOW - 10 * DAY, chars: 500 },
      ],
      NOW,
    );
    expect(totals.charsReadThisWeek).toBe(100);
    expect(totals.charsReadTotal).toBe(600);
  });

  it('returns zeros for no reads', () => {
    expect(computeReadingTotals([], NOW)).toEqual({ storiesRead: 0, charsReadTotal: 0, charsReadThisWeek: 0 });
  });
});

describe('computeStreak', () => {
  it('is zero with no activity', () => {
    expect(computeStreak(new Set(), NOW)).toBe(0);
  });

  it('counts today alone as a streak of 1', () => {
    expect(computeStreak(new Set(['2026-10-18']), NOW)).toBe(1);
  });

  it('counts consecutive days back from today', () => {
    const days = new Set(['2026-10-16', '2026-10-17', '2026-10-18']);
    expect(computeStreak(days, NOW)).toBe(3);
  });

  it('stops at the first gap', () => {
    const days = new Set(['2026-10-14', '2026-10-17', '2026-10-18']);
    expect(computeStreak(days, NOW)).toBe(2);
  });

  it('does not break the streak just because today has no activity yet', () => {
    const days = new Set(['2026-10-16', '2026-10-17']);
    expect(computeStreak(days, NOW)).toBe(2);
  });

  it('is zero if yesterday was skipped, even with no activity logged today', () => {
    const days = new Set(['2026-10-15', '2026-10-16']);
    expect(computeStreak(days, NOW)).toBe(0);
  });
});

describe('estimateVocabulary', () => {
  const wordLevel = new Map([
    ['我', 1], ['你', 1], ['好', 1],
    ['工作', 2],
    ['经济', 5],
  ]);
  const sizes = { '1': 500, '2': 750, '5': 1059 };

  it('computes known/size/pct per band', () => {
    const result = estimateVocabulary(['我', '你', '工作'], wordLevel, sizes);
    expect(result).toEqual([
      { level: 1, size: 500, known: 2, pct: 0.4 },
      { level: 2, size: 750, known: 1, pct: 0.1 },
      { level: 5, size: 1059, known: 0, pct: 0 },
    ]);
  });

  it('skips words with no known HSK level', () => {
    const result = estimateVocabulary(['龘', '我'], wordLevel, sizes);
    expect(result.find((r) => r.level === 1)?.known).toBe(1);
  });

  it('orders bands ascending by level', () => {
    const result = estimateVocabulary([], wordLevel, sizes);
    expect(result.map((r) => r.level)).toEqual([1, 2, 5]);
  });
});
