/**
 * Pure sequencing rules for the reader's sentence player. Kept separate from
 * useSentencePlayer.ts (the React + Web Speech API glue) so the boundary
 * cases — empty stories, the first and last sentence — are unit tested
 * without mocking speechSynthesis.
 */

/** The sentence to advance to when the current one finishes, or null to stop. */
export function autoAdvance(current: number, length: number): number | null {
  const next = current + 1;
  return next < length ? next : null;
}

/** Where "Next" goes from `current` (null = not started yet), or null at/past the end. */
export function nextSentence(current: number | null, length: number): number | null {
  const next = (current ?? -1) + 1;
  return next < length ? next : null;
}

/** Where "Previous" goes from `current`, or null already at the start. */
export function prevSentence(current: number | null): number | null {
  const prev = (current ?? 0) - 1;
  return prev >= 0 ? prev : null;
}
