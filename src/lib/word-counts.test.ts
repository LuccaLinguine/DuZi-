import { describe, it, expect } from 'vitest';
import { computeWordCounts, formatWordCounts } from './word-counts.ts';

describe('computeWordCounts', () => {
  it('treats a word with no row as new', () => {
    const counts = computeWordCounts(['你好'], new Map());
    expect(counts).toEqual({ new: 1, learning: 0, known: 0, ignored: 0 });
  });

  it('tallies by status', () => {
    const rows = new Map([
      ['你好', { status: 'learning' as const }],
      ['朋友', { status: 'known' as const }],
      ['北京', { status: 'ignored' as const }],
    ]);
    expect(computeWordCounts(['你好', '朋友', '北京', '新词'], rows)).toEqual({
      new: 1,
      learning: 1,
      known: 1,
      ignored: 1,
    });
  });
});

describe('formatWordCounts', () => {
  it('shows new and learning, omitting zero terms', () => {
    expect(formatWordCounts({ new: 12, learning: 5, known: 3, ignored: 0 })).toBe('12 new · 5 learning');
    expect(formatWordCounts({ new: 4, learning: 0, known: 0, ignored: 0 })).toBe('4 new');
  });

  it('reads "all known" once nothing is left to learn', () => {
    expect(formatWordCounts({ new: 0, learning: 0, known: 10, ignored: 2 })).toBe('all known');
  });

  it('is empty for a story with no tracked words at all', () => {
    expect(formatWordCounts({ new: 0, learning: 0, known: 0, ignored: 0 })).toBe('');
  });
});
