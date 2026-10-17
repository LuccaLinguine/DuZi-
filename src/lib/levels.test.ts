import { describe, it, expect } from 'vitest';
import { levelBadge, hskRangeLabel } from './levels.ts';

describe('levelBadge', () => {
  it('shows the HSK ceiling for most levels', () => {
    expect(levelBadge('newbie')).toBe('HSK 1');
    expect(levelBadge('intermediate')).toBe('HSK 3');
  });

  it('collapses the top band to "6+"', () => {
    expect(levelBadge('master')).toBe('HSK 6+');
  });
});

describe('hskRangeLabel', () => {
  it('collapses a single-band range instead of printing "HSK 1-1"', () => {
    expect(hskRangeLabel(1)).toBe('HSK 1');
  });

  it('shows a real range above one band', () => {
    expect(hskRangeLabel(2)).toBe('HSK 1–2');
    expect(hskRangeLabel(5)).toBe('HSK 1–5');
  });

  it('collapses the top band to "6+"', () => {
    expect(hskRangeLabel(9)).toBe('HSK 1–6+');
  });
});
