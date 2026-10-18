/**
 * Local calendar days. Everything day-shaped in the app — the daily new-card
 * budget, the reading streak, the per-day stats rows — is keyed on the
 * device's *local* date, not UTC: a review at 11pm and one at 1am should land
 * on different days the way the learner experiences them, which is what the
 * `days` table's `YYYY-MM-DD` primary key means.
 */

/** `YYYY-MM-DD` for a timestamp, in the device's local timezone. */
export function localDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Midnight at the start of the local day containing `ms`. */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** `YYYY-MM-DD` keys for the `count` days ending at `ms`, oldest first. */
export function recentDayKeys(ms: number, count: number): string[] {
  const start = startOfLocalDay(ms);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    keys.push(localDayKey(d.getTime()));
  }
  return keys;
}
