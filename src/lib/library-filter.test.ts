import { describe, it, expect } from 'vitest';
import {
  filterCards,
  topicsIn,
  groupBySeries,
  hasActiveFilters,
  DEFAULT_FILTERS,
  type LibraryCard,
} from './library-filter.ts';

function card(overrides: Partial<LibraryCard> = {}): LibraryCard {
  return {
    id: 's1',
    title_zh: '丢了的猫',
    title_en: 'Lost Cat',
    level: 'elementary',
    topic: 'Daily life',
    seriesId: null,
    chapter: null,
    createdAt: '2026-10-01',
    read: false,
    ...overrides,
  };
}

describe('hasActiveFilters', () => {
  it('is false for the defaults', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it('is true when any field differs', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, level: 'newbie' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, search: 'cat' })).toBe(true);
  });
});

describe('filterCards', () => {
  const cards = [
    card({ id: 'a', level: 'newbie', topic: 'Food', read: true, title_zh: '猫', title_en: 'Cat' }),
    card({ id: 'b', level: 'elementary', topic: 'Travel', read: false, title_zh: '狗', title_en: 'Dog' }),
  ];

  it('returns everything with no filters', () => {
    expect(filterCards(cards, DEFAULT_FILTERS)).toHaveLength(2);
  });

  it('filters by level', () => {
    expect(filterCards(cards, { ...DEFAULT_FILTERS, level: 'newbie' }).map((c) => c.id)).toEqual(['a']);
  });

  it('filters by read state', () => {
    expect(filterCards(cards, { ...DEFAULT_FILTERS, read: 'read' }).map((c) => c.id)).toEqual(['a']);
    expect(filterCards(cards, { ...DEFAULT_FILTERS, read: 'unread' }).map((c) => c.id)).toEqual(['b']);
  });

  it('filters by topic', () => {
    expect(filterCards(cards, { ...DEFAULT_FILTERS, topic: 'Travel' }).map((c) => c.id)).toEqual(['b']);
  });

  it('searches case-insensitively in the English title', () => {
    expect(filterCards(cards, { ...DEFAULT_FILTERS, search: 'dog' }).map((c) => c.id)).toEqual(['b']);
  });

  it('searches the Chinese title', () => {
    expect(filterCards(cards, { ...DEFAULT_FILTERS, search: '猫' }).map((c) => c.id)).toEqual(['a']);
  });

  it('combines filters with AND', () => {
    expect(filterCards(cards, { ...DEFAULT_FILTERS, level: 'newbie', read: 'unread' })).toHaveLength(0);
  });
});

describe('topicsIn', () => {
  it('lists distinct topics, sorted', () => {
    const cards = [card({ topic: 'Travel' }), card({ topic: 'Food' }), card({ topic: 'Travel' })];
    expect(topicsIn(cards)).toEqual(['Food', 'Travel']);
  });
});

describe('groupBySeries', () => {
  it('leaves a standalone story as a single', () => {
    const groups = groupBySeries([card({ id: 'a' })]);
    expect(groups).toEqual([{ kind: 'single', card: expect.objectContaining({ id: 'a' }) }]);
  });

  it('groups chapters of the same series together, sorted by chapter', () => {
    const groups = groupBySeries([
      card({ id: 'ch2', seriesId: 'mystery', chapter: 2, createdAt: '2026-10-05' }),
      card({ id: 'ch1', seriesId: 'mystery', chapter: 1, createdAt: '2026-10-01' }),
    ]);
    expect(groups).toHaveLength(1);
    const g = groups[0]!;
    if (g.kind !== 'series') throw new Error('expected a series group');
    expect(g.seriesId).toBe('mystery');
    expect(g.cards.map((c) => c.id)).toEqual(['ch1', 'ch2']);
  });

  it('positions a series by its most recently added chapter', () => {
    const groups = groupBySeries([
      card({ id: 'standalone', createdAt: '2026-10-10' }),
      card({ id: 'ch1', seriesId: 'mystery', chapter: 1, createdAt: '2026-10-01' }),
      card({ id: 'ch2', seriesId: 'mystery', chapter: 2, createdAt: '2026-10-15' }),
    ]);
    // ch2 (10-15) is the newest thing overall, so the series group leads.
    expect(groups[0]).toMatchObject({ kind: 'series', seriesId: 'mystery' });
    expect(groups[1]).toMatchObject({ kind: 'single', card: { id: 'standalone' } });
  });

  it('keeps distinct series separate', () => {
    const groups = groupBySeries([
      card({ id: 'a1', seriesId: 'a', chapter: 1 }),
      card({ id: 'b1', seriesId: 'b', chapter: 1 }),
    ]);
    expect(groups).toHaveLength(2);
  });
});
