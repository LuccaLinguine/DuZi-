/**
 * The Library (spec section 7): covers, filters, search, series grouping,
 * swipe-to-delete with undo. Word counts per card (section 5a) carried over
 * from phase 2.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/index.ts';
import { LEVEL_LIST, LEVELS, levelBadge } from '../lib/levels.ts';
import { storyWords } from '../lib/content-sync.ts';
import { computeWordCounts, formatWordCounts } from '../lib/word-counts.ts';
import {
  filterCards,
  groupBySeries,
  topicsIn,
  hasActiveFilters,
  DEFAULT_FILTERS,
  type LibraryCard,
  type LibraryFilters,
  type ReadFilter,
} from '../lib/library-filter.ts';
import { removeStory, restoreStory } from '../db/stories.ts';
import { useWordRows } from '../hooks/useWordRows.ts';
import { Screen, EmptyState } from '../components/Screen.tsx';
import { Cover } from '../components/Cover.tsx';
import { SwipeToDelete } from '../components/SwipeToDelete.tsx';
import type { Tab } from '../components/TabBar.tsx';
import type { StoryRow } from '../db/types.ts';

const UNDO_WINDOW_MS = 6000;

export function Library({
  onGoTo,
  onOpenStory,
  onImportText,
}: {
  onGoTo: (tab: Tab) => void;
  onOpenStory: (id: string) => void;
  onImportText: () => void;
}) {
  const rows = useLiveQuery(
    () => db.stories.filter((s) => !s.hidden && !s.userRemoved).toArray(),
    [],
  );
  const progress = useLiveQuery(() => db.progress.toArray(), []);
  const readIds = useMemo(
    () => new Set((progress ?? []).filter((p) => p.read).map((p) => p.storyId)),
    [progress],
  );

  const allCards = useMemo(
    () => (rows ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((s) => toCard(s, readIds)),
    [rows, readIds],
  );
  const rowsById = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows]);

  const [filters, setFilters] = useState<LibraryFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [removed, setRemoved] = useState<{ id: string; title: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const topics = useMemo(() => topicsIn(allCards), [allCards]);
  const filtered = useMemo(() => filterCards(allCards, filters), [allCards, filters]);
  const groups = useMemo(() => groupBySeries(filtered), [filtered]);

  const allWords = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows ?? []) for (const w of storyWords(r.story)) set.add(w);
    return [...set];
  }, [rows]);
  const wordRows = useWordRows(allWords);

  const handleDelete = (card: LibraryCard) => {
    void removeStory(card.id);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRemoved({ id: card.id, title: card.title_zh });
    undoTimer.current = setTimeout(() => setRemoved(null), UNDO_WINDOW_MS);
  };

  const handleUndo = () => {
    if (!removed) return;
    void restoreStory(removed.id);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRemoved(null);
  };

  if (rows === undefined) {
    return (
      <Screen title="Library">
        <p className="px-4 py-6 text-[14px]" style={{ color: 'var(--ink-3)' }}>
          Loading…
        </p>
      </Screen>
    );
  }

  return (
    <Screen
      title="Library"
      subtitle={allCards.length === 1 ? '1 story' : `${allCards.length} stories`}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onImportText}
            className="tap rounded-lg border px-2.5 text-[13px] font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
          >
            + Paste text
          </button>
          {allCards.length > 0 && (
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-pressed={filtersOpen}
              className="tap rounded-lg border px-2.5 text-[13px] font-medium"
              style={{
                borderColor: hasActiveFilters(filters) ? 'var(--accent)' : 'var(--border)',
                color: hasActiveFilters(filters) ? 'var(--accent)' : 'var(--ink)',
              }}
            >
              Filter{hasActiveFilters(filters) ? ' •' : ''}
            </button>
          )}
        </div>
      }
    >
      {allCards.length === 0 ? (
        <EmptyState
          icon="读"
          title="No stories yet"
          body={
            <>
              Stories are written on your Mac and arrive with each deploy. Queue what you
              want on the Requests screen, export your profile, and run{' '}
              <code className="rounded px-1" style={{ background: 'var(--surface-2)' }}>
                /stories
              </code>{' '}
              there.
            </>
          }
          action={
            <button
              type="button"
              onClick={() => onGoTo('requests')}
              className="tap rounded-lg px-4 text-[15px] font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Go to Requests
            </button>
          }
        />
      ) : (
        <>
          {filtersOpen && (
            <FilterPanel filters={filters} onChange={setFilters} topics={topics} />
          )}

          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[14px]" style={{ color: 'var(--ink-2)' }}>
                No stories match these filters.
              </p>
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="tap mt-2 text-[14px] font-medium"
                style={{ color: 'var(--accent)' }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="px-4 py-3">
              {groups.map((g) =>
                g.kind === 'single' ? (
                  <li key={g.card.id} className="mb-3">
                    <StoryCard
                      row={rowsById.get(g.card.id)!}
                      card={g.card}
                      wordRows={wordRows}
                      onOpen={() => onOpenStory(g.card.id)}
                      onDelete={() => handleDelete(g.card)}
                    />
                  </li>
                ) : (
                  <li key={g.seriesId} className="mb-3">
                    <p className="mb-2 px-1 text-[12px] font-semibold tracking-wide uppercase" style={{ color: 'var(--ink-3)' }}>
                      Series · {g.cards.length} {g.cards.length === 1 ? 'chapter' : 'chapters'}
                    </p>
                    <div className="space-y-2">
                      {g.cards.map((card) => (
                        <StoryCard
                          key={card.id}
                          row={rowsById.get(card.id)!}
                          card={card}
                          wordRows={wordRows}
                          onOpen={() => onOpenStory(card.id)}
                          onDelete={() => handleDelete(card)}
                          chapterLabel={card.chapter !== null ? `Ch. ${card.chapter}` : undefined}
                        />
                      ))}
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </>
      )}

      {removed && (
        <div className="pointer-events-none fixed inset-x-0 bottom-32 z-50 flex justify-center px-4">
          <div
            className="pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2 text-[14px] shadow-lg"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            <span className="han max-w-[160px] truncate">Removed {removed.title}</span>
            <button type="button" onClick={handleUndo} className="font-semibold" style={{ color: 'var(--accent)' }}>
              Undo
            </button>
          </div>
        </div>
      )}
    </Screen>
  );
}

function toCard(row: StoryRow, readIds: Set<string>): LibraryCard {
  return {
    id: row.id,
    title_zh: row.title_zh,
    title_en: row.title_en,
    level: row.level,
    topic: row.topic,
    seriesId: row.series_id,
    chapter: row.chapter,
    createdAt: row.created_at,
    read: readIds.has(row.id),
  };
}

function FilterPanel({
  filters,
  onChange,
  topics,
}: {
  filters: LibraryFilters;
  onChange: (f: LibraryFilters) => void;
  topics: string[];
}) {
  return (
    <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <input
        type="text"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        placeholder="Search titles"
        className="w-full rounded-lg border px-3 py-2 text-[15px]"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Choice label="All levels" selected={filters.level === 'all'} onSelect={() => onChange({ ...filters, level: 'all' })} />
        {LEVEL_LIST.map((l) => (
          <Choice
            key={l.id}
            label={levelBadge(l.id)}
            selected={filters.level === l.id}
            onSelect={() => onChange({ ...filters, level: l.id })}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {(['all', 'unread', 'read'] as ReadFilter[]).map((r) => (
          <Choice
            key={r}
            label={r === 'all' ? 'All' : r === 'unread' ? 'Unread' : 'Read'}
            selected={filters.read === r}
            onSelect={() => onChange({ ...filters, read: r })}
          />
        ))}
      </div>

      {topics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Choice label="All topics" selected={filters.topic === 'all'} onSelect={() => onChange({ ...filters, topic: 'all' })} />
          {topics.map((t) => (
            <Choice key={t} label={t} selected={filters.topic === t} onSelect={() => onChange({ ...filters, topic: t })} />
          ))}
        </div>
      )}

      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="tap mt-3 text-[13px] font-medium"
          style={{ color: 'var(--accent)' }}
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function Choice({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="tap rounded-lg border px-2.5 text-[13px]"
      style={{
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        background: selected ? 'var(--accent-soft)' : 'transparent',
        color: selected ? 'var(--accent)' : 'var(--ink-2)',
      }}
    >
      {label}
    </button>
  );
}

function StoryCard({
  row,
  card,
  wordRows,
  onOpen,
  onDelete,
  chapterLabel,
}: {
  row: StoryRow;
  card: LibraryCard;
  wordRows: ReturnType<typeof useWordRows>;
  onOpen: () => void;
  onDelete: () => void;
  chapterLabel?: string;
}) {
  const counts = computeWordCounts(storyWords(row.story), wordRows ?? new Map());
  const countsLabel = formatWordCounts(counts);

  return (
    <SwipeToDelete onDelete={onDelete}>
      <button type="button" onClick={onOpen} className="w-full text-left">
        <article
          className="flex gap-3 rounded-xl border p-3"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <Cover id={card.id} titleZh={card.title_zh} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="han truncate text-[17px] font-semibold">{card.title_zh}</h2>
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                {chapterLabel ?? levelBadge(card.level)}
              </span>
            </div>
            <p className="truncate text-[13px]" style={{ color: 'var(--ink-2)' }}>
              {card.title_en}
            </p>
            <p className="mt-1.5 text-[12px]" style={{ color: 'var(--ink-3)' }}>
              {LEVELS[card.level].name} · {row.chars} chars · {row.in_level_pct}% in level
              {card.read && ' · read'}
              {countsLabel && ` · ${countsLabel}`}
            </p>
          </div>
        </article>
      </button>
    </SwipeToDelete>
  );
}
