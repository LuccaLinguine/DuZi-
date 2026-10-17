import { describe, it, expect } from 'vitest';
import { coverGradient, coverChar } from './cover.ts';

describe('coverGradient', () => {
  it('is deterministic for the same id', () => {
    expect(coverGradient('story-1')).toEqual(coverGradient('story-1'));
  });

  it('differs for different ids (usually)', () => {
    expect(coverGradient('story-1')).not.toEqual(coverGradient('story-2'));
  });

  it('produces valid hsl() strings', () => {
    const { from, to } = coverGradient('x');
    expect(from).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
    expect(to).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
  });
});

describe('coverChar', () => {
  it('picks the first Han character', () => {
    expect(coverChar('丢了的猫')).toBe('丢');
  });

  it('skips leading non-Han characters', () => {
    expect(coverChar('"丢了的猫"')).toBe('丢');
  });

  it('falls back to the first character for a title with no Han at all', () => {
    expect(coverChar('ABC')).toBe('A');
  });
});
