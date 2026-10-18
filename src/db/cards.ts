/**
 * Flashcard persistence: saving a word from the reader, grading a card in a
 * review session, and the day's new-card budget. The scheduling maths lives
 * in lib/review.ts; this is the Dexie half.
 */
import { db } from './index.ts';
import type { CardRow, WordRow } from './types.ts';
import { gradeCard, newCardRow, isStable, Rating, type Grade, type NewCardInput } from '../lib/review.ts';
import { applyCardGraduated, applyCardLapsed, newWordRow } from '../lib/word-memory.ts';
import { localDayKey } from '../lib/day.ts';

/** Save a word as a flashcard, linking it back to the word memory. */
export async function saveCard(input: NewCardInput): Promise<CardRow> {
  const now = Date.now();
  const row = newCardRow(input, now);

  await db.transaction('rw', db.cards, db.words, async () => {
    await db.cards.put(row);
    // Saving a word is an act of "I want to learn this", so it also moves the
    // word memory to `learning` if it was still `new` (spec §5a).
    const existing = await db.words.get(input.w);
    const word: WordRow = existing ?? newWordRow(input.w, now);
    await db.words.put({
      ...word,
      cardId: row.id,
      status: word.status === 'new' ? 'learning' : word.status,
      lastSeen: now,
    });
  });

  return row;
}

export async function deleteCard(id: string): Promise<void> {
  await db.transaction('rw', db.cards, db.words, async () => {
    await db.cards.delete(id);
    const word = await db.words.get(id);
    // Unlink, but leave the word's learned status alone — deleting a
    // flashcard means "stop drilling this", not "I never knew it".
    if (word?.cardId === id) await db.words.update(id, { cardId: null });
  });
}

export async function setCardSuspended(id: string, suspended: boolean): Promise<void> {
  await db.cards.update(id, { suspended });
}

/**
 * Grade a card: write the new schedule, log the review, bump today's counters,
 * and feed the result back into the word memory — a card that's become solid
 * graduates its word to `known`, and pressing Again on a known word's card
 * drops it back to `learning` (spec §5a).
 */
export async function reviewCard(row: CardRow, grade: Grade): Promise<CardRow> {
  const now = Date.now();
  const { row: next, log } = gradeCard(row, grade, now);
  const wasNew = row.fsrs.reps === 0;

  // Read the threshold before opening the transaction: `settings` is not one
  // of its tables, and Dexie rejects a read outside the declared set.
  const { graduateAtStabilityDays } = await db.getSettings();

  await db.transaction('rw', db.cards, db.reviewLog, db.words, db.days, async () => {
    await db.cards.put(next);
    await db.reviewLog.add({ cardId: next.id, at: now, log });

    const word = await db.words.get(next.w);
    if (word) {
      if (grade === Rating.Again) {
        await db.words.put(applyCardLapsed(word, now));
      } else if (isStable(next, graduateAtStabilityDays)) {
        await db.words.put(applyCardGraduated(word, now));
      }
    }

    const key = localDayKey(now);
    const day = await db.days.get(key);
    await db.days.put({
      date: key,
      charsRead: day?.charsRead ?? 0,
      storiesRead: day?.storiesRead ?? 0,
      reviews: (day?.reviews ?? 0) + 1,
      // "Words learned today" counts first-ever reviews, which is what the
      // new-card budget is measured against.
      wordsLearned: (day?.wordsLearned ?? 0) + (wasNew ? 1 : 0),
    });
  });

  return next;
}

/** How many brand-new cards have already been introduced today. */
export async function newCardsToday(now = Date.now()): Promise<number> {
  const day = await db.days.get(localDayKey(now));
  return day?.wordsLearned ?? 0;
}
