/**
 * Filtering, searching and series-grouping for the Library (spec section 7).
 * Pure over a slimmed-down view of StoryRow + ProgressRow, so it's unit
 * tested without touching Dexie; the screen just maps its live-query rows
 * into this shape.
 */
import type { LevelId } from './levels.ts';

export interface LibraryCard {
  id: string;
  title_zh: string;
  title_en: string;
  level: LevelId;
  topic: string;
  seriesId: string | null;
  chapter: number | null;
  createdAt: string;
  read: boolean;
}

export type ReadFilter = 'all' | 'read' | 'unread';

export interface LibraryFilters {
  level: LevelId | 'all';
  read: ReadFilter;
  topic: string | 'all';
  search: string;
}

export const DEFAULT_FILTERS: LibraryFilters = { level: 'all', read: 'all', topic: 'all', search: '' };

export function hasActiveFilters(f: LibraryFilters): boolean {
  return f.level !== 'all' || f.read !== 'all' || f.topic !== 'all' || f.search.trim() !== '';
}

function matchesSearch(card: LibraryCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return card.title_zh.includes(query.trim()) || card.title_en.toLowerCase().includes(q);
}

export function filterCards(cards: readonly LibraryCard[], filters: LibraryFilters): LibraryCard[] {
  return cards.filter((c) => {
    if (filters.level !== 'all' && c.level !== filters.level) return false;
    if (filters.read === 'read' && !c.read) return false;
    if (filters.read === 'unread' && c.read) return false;
    if (filters.topic !== 'all' && c.topic !== filters.topic) return false;
    if (!matchesSearch(c, filters.search)) return false;
    return true;
  });
}

/** Distinct topics present in a set of cards, for the topic filter's options. */
export function topicsIn(cards: readonly LibraryCard[]): string[] {
  return [...new Set(cards.map((c) => c.topic))].sort((a, b) => a.localeCompare(b));
}

export type LibraryGroup =
  | { kind: 'single'; card: LibraryCard }
  | { kind: 'series'; seriesId: string; cards: LibraryCard[] };

/**
 * Groups series chapters together (sorted by chapter number) and leaves
 * standalone stories as singles, in each group's most-recent-first order —
 * a series slot takes the position of its most recently added chapter, so a
 * freshly arrived chapter brings its whole series back to the top with it.
 */
export function groupBySeries(cards: readonly LibraryCard[]): LibraryGroup[] {
  const bySeries = new Map<string, LibraryCard[]>();
  const singles: LibraryCard[] = [];
  // Position each group by its most-recently-added chapter's createdAt.
  const latestCreatedAt = new Map<string, string>();

  for (const card of cards) {
    if (!card.seriesId) {
      singles.push(card);
      continue;
    }
    const list = bySeries.get(card.seriesId) ?? [];
    list.push(card);
    bySeries.set(card.seriesId, list);
    const prev = latestCreatedAt.get(card.seriesId);
    if (!prev || card.createdAt > prev) latestCreatedAt.set(card.seriesId, card.createdAt);
  }

  const groups: LibraryGroup[] = [
    ...singles.map((card): LibraryGroup => ({ kind: 'single', card })),
    ...[...bySeries.entries()].map(
      ([seriesId, seriesCards]): LibraryGroup => ({
        kind: 'series',
        seriesId,
        cards: [...seriesCards].sort((a, b) => (a.chapter ?? 0) - (b.chapter ?? 0)),
      }),
    ),
  ];

  const sortKey = (g: LibraryGroup) => (g.kind === 'single' ? g.card.createdAt : latestCreatedAt.get(g.seriesId)!);
  return groups.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
}
