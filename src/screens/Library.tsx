/**
 * Phase 1: a plain list of whatever the content sync imported, which is what
 * proves the pipeline works offline. The card design, filters, search and
 * series grouping of spec §7 land in phase 4.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/index.ts';
import { LEVELS, levelBadge } from '../lib/levels.ts';
import { Screen, EmptyState } from '../components/Screen.tsx';
import type { Tab } from '../components/TabBar.tsx';

export function Library({ onGoTo }: { onGoTo: (tab: Tab) => void }) {
  const stories = useLiveQuery(
    () => db.stories.filter((s) => !s.hidden).reverse().sortBy('created_at'),
    [],
  );
  const progress = useLiveQuery(() => db.progress.toArray(), []);
  const readIds = new Set((progress ?? []).filter((p) => p.read).map((p) => p.storyId));

  if (stories === undefined) {
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
      subtitle={stories.length === 1 ? '1 story' : `${stories.length} stories`}
    >
      {stories.length === 0 ? (
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
        <ul className="px-4 py-3">
          {stories.map((s) => (
            <li key={s.id} className="mb-3">
              <article
                className="rounded-xl border p-4"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="han text-[19px] font-semibold">{s.title_zh}</h2>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    {levelBadge(s.level)}
                  </span>
                </div>
                <p className="mt-0.5 text-[14px]" style={{ color: 'var(--ink-2)' }}>
                  {s.title_en}
                </p>
                <p className="mt-2 text-[13px] leading-snug" style={{ color: 'var(--ink-3)' }}>
                  {s.story.summary_en}
                </p>
                <p className="mt-3 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  {LEVELS[s.level].name} · {s.chars} chars · {s.in_level_pct}% in level · {s.topic}
                  {readIds.has(s.id) && ' · read'}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
