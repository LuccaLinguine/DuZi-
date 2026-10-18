/**
 * Flashcard scheduling (spec section 6). Wraps ts-fsrs so the rest of the app
 * never touches its types directly, and keeps the pure parts — building a new
 * card, grading one, picking the day's queue, formatting an interval preview —
 * testable without a database.
 */
import { fsrs, createEmptyCard, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { CardRow, CardMode } from '../db/types.ts';

/**
 * Fuzz is off: it randomises intervals by a few percent to stop big decks
 * bunching up on one day, which matters for a 10k-card Anki deck and not for
 * a personal reader's vocabulary. Off means a grade always previews the
 * interval it actually schedules, so the buttons never lie.
 */
const scheduler = fsrs(generatorParameters({ enable_fuzz: false }));

export { Rating, State };
export type { Card, Grade };

/** The four buttons, in the order they're shown. */
export const GRADES: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

export const GRADE_LABELS: Record<Grade, string> = {
  [Rating.Again]: 'Again',
  [Rating.Hard]: 'Hard',
  [Rating.Good]: 'Good',
  [Rating.Easy]: 'Easy',
};

export interface NewCardInput {
  w: string;
  py: string;
  gloss: string;
  exampleZh: string;
  exampleEn: string;
  storyId: string | null;
}

/** A freshly saved word, due immediately so it enters the next session. */
export function newCardRow(input: NewCardInput, now: number): CardRow {
  const card = createEmptyCard(new Date(now));
  return {
    id: input.w,
    w: input.w,
    py: input.py,
    gloss: input.gloss,
    exampleZh: input.exampleZh,
    exampleEn: input.exampleEn,
    storyId: input.storyId,
    createdAt: now,
    fsrs: card,
    due: new Date(card.due).getTime(),
  };
}

/**
 * Apply a grade. Returns the updated row plus the ts-fsrs review log, which
 * the caller writes to the reviewLog table for the stats screen.
 *
 * `due` is mirrored out of the Card as epoch ms because IndexedDB can't index
 * a Date inside a nested object, and the tab-bar badge needs a fast range
 * query over "due today".
 */
export function gradeCard(row: CardRow, grade: Grade, now: number) {
  const result = scheduler.next(row.fsrs, new Date(now), grade);
  const next: CardRow = {
    ...row,
    fsrs: result.card,
    due: new Date(result.card.due).getTime(),
  };
  return { row: next, log: result.log };
}

/** Next interval per grade, for the previews on the grade buttons. */
export function intervalPreviews(row: CardRow, now: number): Record<Grade, string> {
  const scheduled = scheduler.repeat(row.fsrs, new Date(now));
  const out = {} as Record<Grade, string>;
  for (const grade of GRADES) {
    const due = new Date(scheduled[grade].card.due).getTime();
    out[grade] = formatInterval(due - now);
  }
  return out;
}

/** Compact human interval: "10m", "2h", "3d", "1.5mo", "2y". */
export function formatInterval(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  const months = days / 30;
  if (months < 12) return `${months < 10 ? months.toFixed(1) : Math.round(months)}mo`;
  const years = days / 365;
  return `${years < 10 ? years.toFixed(1) : Math.round(years)}y`;
}

/**
 * The cards to review right now: everything overdue, oldest-due first, with
 * brand-new cards capped at the daily limit so a big import doesn't bury the
 * learner. `newToday` is how many new cards were already introduced today.
 */
export function buildQueue(
  cards: readonly CardRow[],
  now: number,
  newCardsPerDay: number,
  newToday: number,
): CardRow[] {
  const due = cards.filter((c) => !c.suspended && c.due <= now);
  const fresh = due.filter((c) => c.fsrs.state === State.New);
  const seen = due.filter((c) => c.fsrs.state !== State.New);

  const newBudget = Math.max(0, newCardsPerDay - newToday);
  const allowedNew = fresh.slice(0, newBudget);

  // Cards already in progress come first — they're the ones at risk of being
  // forgotten; new cards are additive and can wait until the end of a session.
  return [...seen.sort((a, b) => a.due - b.due), ...allowedNew.sort((a, b) => a.createdAt - b.createdAt)];
}

/** Cards due at or before `now`, for the tab-bar badge. Excludes suspended. */
export function countDue(cards: readonly CardRow[], now: number): number {
  return cards.filter((c) => !c.suspended && c.due <= now).length;
}

/**
 * Has this card's memory become solid enough to call the word `known`?
 * Drives the word-memory graduation in spec section 5a.
 */
export function isStable(row: CardRow, stabilityThresholdDays: number): boolean {
  return row.fsrs.stability >= stabilityThresholdDays;
}

/** Which side of a card to show first, per the Settings card modes. */
export function pickCardMode(modes: readonly CardMode[], seed: number): CardMode {
  if (modes.length === 0) return 'hanzi-meaning';
  return modes[seed % modes.length]!;
}
