import { describe, it, expect } from 'vitest';
import {
  newCardRow,
  gradeCard,
  intervalPreviews,
  formatInterval,
  buildQueue,
  countDue,
  isStable,
  pickCardMode,
  Rating,
  State,
  GRADES,
} from './review.ts';
import type { CardRow } from '../db/types.ts';

const T0 = new Date('2026-10-18T10:00:00Z').getTime();
const DAY = 86_400_000;

function card(overrides: Partial<CardRow> = {}): CardRow {
  return {
    ...newCardRow(
      { w: '朋友', py: 'péng you', gloss: 'friend', exampleZh: '我的朋友', exampleEn: 'My friend', storyId: 's1' },
      T0,
    ),
    ...overrides,
  };
}

describe('newCardRow', () => {
  it('keys the card on the word and is due immediately', () => {
    const c = newCardRow(
      { w: '朋友', py: 'péng you', gloss: 'friend', exampleZh: '我的朋友', exampleEn: 'My friend', storyId: 's1' },
      T0,
    );
    expect(c.id).toBe('朋友');
    expect(c.w).toBe('朋友');
    expect(c.due).toBe(T0);
    expect(c.createdAt).toBe(T0);
    expect(c.fsrs.state).toBe(State.New);
  });

  it('keeps the example sentence it was saved from', () => {
    const c = card();
    expect(c.exampleZh).toBe('我的朋友');
    expect(c.exampleEn).toBe('My friend');
    expect(c.storyId).toBe('s1');
  });
});

describe('gradeCard', () => {
  it('pushes the due date into the future and mirrors it as epoch ms', () => {
    const { row } = gradeCard(card(), Rating.Good, T0);
    expect(row.due).toBeGreaterThan(T0);
    expect(row.due).toBe(new Date(row.fsrs.due).getTime());
  });

  it('leaves the card identity untouched', () => {
    const { row } = gradeCard(card(), Rating.Good, T0);
    expect(row.id).toBe('朋友');
    expect(row.exampleZh).toBe('我的朋友');
    expect(row.createdAt).toBe(T0);
  });

  it('advances a new card out of the New state', () => {
    const { row } = gradeCard(card(), Rating.Good, T0);
    expect(row.fsrs.state).not.toBe(State.New);
    expect(row.fsrs.reps).toBe(1);
  });

  it('schedules Again sooner than Easy', () => {
    const again = gradeCard(card(), Rating.Again, T0).row.due;
    const easy = gradeCard(card(), Rating.Easy, T0).row.due;
    expect(again).toBeLessThan(easy);
  });

  it('orders all four grades by increasing interval', () => {
    const dues = GRADES.map((g) => gradeCard(card(), g, T0).row.due);
    const sorted = [...dues].sort((a, b) => a - b);
    expect(dues).toEqual(sorted);
  });

  it('records a lapse when a review card is failed', () => {
    const reviewed = gradeCard(card(), Rating.Easy, T0).row;
    const lapsed = gradeCard(reviewed, Rating.Again, reviewed.due).row;
    expect(lapsed.fsrs.lapses).toBe(1);
  });

  it('returns a log for the review history', () => {
    const { log } = gradeCard(card(), Rating.Good, T0);
    expect(log.rating).toBe(Rating.Good);
  });

  it('grows stability across repeated Good reviews', () => {
    let row = card();
    const stabilities: number[] = [];
    for (let i = 0; i < 4; i++) {
      row = gradeCard(row, Rating.Good, row.due).row;
      stabilities.push(row.fsrs.stability);
    }
    expect(stabilities[3]).toBeGreaterThan(stabilities[0]!);
  });
});

describe('intervalPreviews', () => {
  it('previews all four grades', () => {
    const p = intervalPreviews(card(), T0);
    for (const g of GRADES) expect(p[g]).toMatch(/^(<1m|\d+(\.\d)?(m|h|d|mo|y))$/);
  });

  it('matches what grading actually schedules (fuzz is off)', () => {
    const row = card();
    const preview = intervalPreviews(row, T0);
    for (const g of GRADES) {
      const actual = formatInterval(gradeCard(row, g, T0).row.due - T0);
      expect(preview[g]).toBe(actual);
    }
  });
});

describe('formatInterval', () => {
  it('formats minutes, hours and days', () => {
    expect(formatInterval(30_000)).toBe('<1m');
    expect(formatInterval(10 * 60_000)).toBe('10m');
    expect(formatInterval(3 * 3_600_000)).toBe('3h');
    expect(formatInterval(5 * DAY)).toBe('5d');
  });

  it('switches to months and years for long intervals', () => {
    expect(formatInterval(45 * DAY)).toBe('1.5mo');
    expect(formatInterval(400 * DAY)).toBe('1.1y');
  });
});

describe('buildQueue', () => {
  it('excludes cards that are not due yet', () => {
    const future = card({ id: 'a', w: 'a', due: T0 + DAY });
    expect(buildQueue([future], T0, 10, 0)).toEqual([]);
  });

  it('excludes suspended cards', () => {
    const suspended = card({ id: 'a', w: 'a', due: T0, suspended: true });
    expect(buildQueue([suspended], T0, 10, 0)).toEqual([]);
  });

  it('puts in-progress cards before brand-new ones', () => {
    const fresh = card({ id: 'new', w: 'new', due: T0 });
    const seen = gradeCard(card({ id: 'seen', w: 'seen' }), Rating.Again, T0).row;
    const queue = buildQueue([fresh, { ...seen, due: T0 }], T0, 10, 0);
    expect(queue.map((c) => c.id)).toEqual(['seen', 'new']);
  });

  it('caps new cards at the daily limit', () => {
    const cards = Array.from({ length: 5 }, (_, i) =>
      card({ id: `n${i}`, w: `n${i}`, due: T0, createdAt: T0 + i }),
    );
    expect(buildQueue(cards, T0, 3, 0)).toHaveLength(3);
  });

  it('accounts for new cards already done today', () => {
    const cards = Array.from({ length: 5 }, (_, i) => card({ id: `n${i}`, w: `n${i}`, due: T0 }));
    expect(buildQueue(cards, T0, 3, 2)).toHaveLength(1);
    expect(buildQueue(cards, T0, 3, 3)).toHaveLength(0);
  });

  it('never caps cards already in progress', () => {
    const seen = Array.from({ length: 5 }, (_, i) =>
      ({ ...gradeCard(card({ id: `s${i}`, w: `s${i}` }), Rating.Again, T0).row, due: T0 }),
    );
    expect(buildQueue(seen, T0, 1, 1)).toHaveLength(5);
  });

  it('orders due cards oldest-first', () => {
    const a = { ...gradeCard(card({ id: 'a', w: 'a' }), Rating.Again, T0).row, due: T0 - 2 * DAY };
    const b = { ...gradeCard(card({ id: 'b', w: 'b' }), Rating.Again, T0).row, due: T0 - DAY };
    expect(buildQueue([b, a], T0, 10, 0).map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('countDue', () => {
  it('counts only unsuspended cards at or before now', () => {
    const cards = [
      card({ id: 'a', w: 'a', due: T0 - DAY }),
      card({ id: 'b', w: 'b', due: T0 }),
      card({ id: 'c', w: 'c', due: T0 + DAY }),
      card({ id: 'd', w: 'd', due: T0, suspended: true }),
    ];
    expect(countDue(cards, T0)).toBe(2);
  });
});

describe('isStable', () => {
  it('is false for a new card and true once stability passes the threshold', () => {
    expect(isStable(card(), 21)).toBe(false);
    expect(isStable(card({ fsrs: { ...card().fsrs, stability: 25 } }), 21)).toBe(true);
  });

  it('treats exactly-at-threshold as stable', () => {
    expect(isStable(card({ fsrs: { ...card().fsrs, stability: 21 } }), 21)).toBe(true);
  });
});

describe('pickCardMode', () => {
  it('falls back to hanzi-meaning when no modes are enabled', () => {
    expect(pickCardMode([], 0)).toBe('hanzi-meaning');
  });

  it('always returns the only enabled mode', () => {
    expect(pickCardMode(['meaning-hanzi'], 7)).toBe('meaning-hanzi');
  });

  it('cycles deterministically through several modes', () => {
    const modes = ['hanzi-meaning', 'meaning-hanzi', 'audio-meaning'] as const;
    expect(pickCardMode(modes, 0)).toBe('hanzi-meaning');
    expect(pickCardMode(modes, 1)).toBe('meaning-hanzi');
    expect(pickCardMode(modes, 2)).toBe('audio-meaning');
    expect(pickCardMode(modes, 3)).toBe('hanzi-meaning');
  });
});
