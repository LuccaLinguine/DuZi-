import { describe, it, expect } from 'vitest';
import { localDayKey, startOfLocalDay, recentDayKeys } from './day.ts';

describe('localDayKey', () => {
  it('formats as YYYY-MM-DD, zero-padded', () => {
    expect(localDayKey(new Date(2026, 0, 5).getTime())).toBe('2026-01-05');
    expect(localDayKey(new Date(2026, 10, 17).getTime())).toBe('2026-11-17');
  });

  it('uses local time, so late-night and early-morning are different days', () => {
    const lateNight = new Date(2026, 9, 17, 23, 30).getTime();
    const earlyNext = new Date(2026, 9, 18, 1, 0).getTime();
    expect(localDayKey(lateNight)).toBe('2026-10-17');
    expect(localDayKey(earlyNext)).toBe('2026-10-18');
  });
});

describe('startOfLocalDay', () => {
  it('rolls back to local midnight', () => {
    const d = new Date(startOfLocalDay(new Date(2026, 9, 18, 14, 37, 12).getTime()));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getDate()).toBe(18);
  });

  it('is idempotent', () => {
    const once = startOfLocalDay(new Date(2026, 9, 18, 14, 0).getTime());
    expect(startOfLocalDay(once)).toBe(once);
  });
});

describe('recentDayKeys', () => {
  it('returns the requested number of days, oldest first, ending today', () => {
    const keys = recentDayKeys(new Date(2026, 9, 18, 12, 0).getTime(), 5);
    expect(keys).toEqual(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  });

  it('crosses a month boundary correctly', () => {
    const keys = recentDayKeys(new Date(2026, 10, 2, 12, 0).getTime(), 4);
    expect(keys).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('returns just today for a count of 1', () => {
    expect(recentDayKeys(new Date(2026, 9, 18, 12, 0).getTime(), 1)).toEqual(['2026-10-18']);
  });
});
