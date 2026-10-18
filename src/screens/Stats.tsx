/**
 * Stats (spec section 9): words saved/known, stories read, characters read
 * (total and this week), the daily streak, a 30-day characters-read bar
 * chart, and an estimated vocabulary by HSK level.
 */
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/index.ts';
import { useHsk } from '../hooks/useHsk.ts';
import { useHskSizes } from '../hooks/useHskMeta.ts';
import { charsPerDay, computeReadingTotals, computeStreak, estimateVocabulary } from '../lib/stats.ts';
import { localDayKey } from '../lib/day.ts';
import { Screen, Section, Row } from '../components/Screen.tsx';
import { BarChart } from '../components/BarChart.tsx';

const CHART_DAYS = 30;

export function Stats() {
  const words = useLiveQuery(() => db.words.toArray(), []);
  const cards = useLiveQuery(() => db.cards.count(), []);
  const reads = useLiveQuery(() => db.reads.toArray(), []);
  const days = useLiveQuery(() => db.days.toArray(), []);
  const hsk = useHsk();
  const hskSizes = useHskSizes();

  const now = Date.now();

  const totals = useMemo(() => computeReadingTotals(reads ?? [], now), [reads, now]);
  const chart = useMemo(() => charsPerDay(reads ?? [], now, CHART_DAYS), [reads, now]);

  const streak = useMemo(() => {
    const active = new Set<string>();
    for (const r of reads ?? []) active.add(localDayKey(r.at));
    for (const d of days ?? []) if (d.reviews > 0) active.add(d.date);
    return computeStreak(active, now);
  }, [reads, days, now]);

  const known = useMemo(() => (words ?? []).filter((w) => w.status === 'known').length, [words]);

  const vocab = useMemo(() => {
    if (!words || !hsk || !hskSizes) return null;
    // "Known" vocabulary counts status=known words only — a word that's
    // merely saved to a flashcard isn't known yet, that's the whole point of
    // drilling it.
    const knownWords = words.filter((w) => w.status === 'known').map((w) => w.w);
    return estimateVocabulary(knownWords, new Map(Object.entries(hsk)), hskSizes);
  }, [words, hsk, hskSizes]);

  if (words === undefined || reads === undefined || days === undefined || cards === undefined) {
    return (
      <Screen title="Stats">
        <p className="px-4 py-6 text-[14px]" style={{ color: 'var(--ink-3)' }}>
          Loading…
        </p>
      </Screen>
    );
  }

  return (
    <Screen title="Stats">
      <Section>
        <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--border)' }}>
          <StatTile label="Words known" value={known} />
          <StatTile label="Words saved" value={cards} />
          <StatTile label="Stories read" value={totals.storiesRead} />
          <StatTile label="Day streak" value={streak} suffix={streak === 1 ? ' day' : ' days'} />
        </div>
      </Section>

      <Section title="Characters read">
        <Row label="Total" value={totals.charsReadTotal.toLocaleString()} />
        <Row label="This week" value={totals.charsReadThisWeek.toLocaleString()} />
        <div className="px-4 pb-4">
          <p className="mb-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
            Last {CHART_DAYS} days
          </p>
          <BarChart data={chart} />
        </div>
      </Section>

      {vocab && vocab.some((v) => v.size > 0) && (
        <Section title="Estimated vocabulary">
          <div className="px-4 py-3">
            {vocab.map((v) => (
              <div key={v.level} className="mb-3 last:mb-0">
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span style={{ color: 'var(--ink-2)' }}>HSK {v.level >= 7 ? '6+' : v.level}</span>
                  <span style={{ color: 'var(--ink-3)' }}>
                    {v.known.toLocaleString()} / {v.size.toLocaleString()} ({v.pct}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, v.pct)}%`, background: 'var(--accent)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="h-6" />
    </Screen>
  );
}

function StatTile({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="p-4" style={{ background: 'var(--surface)' }}>
      <p className="text-[24px] leading-tight font-semibold">
        {value.toLocaleString()}
        <span className="text-[14px] font-normal" style={{ color: 'var(--ink-3)' }}>
          {suffix}
        </span>
      </p>
      <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-3)' }}>
        {label}
      </p>
    </div>
  );
}
