import { describe, it, expect } from 'vitest';
import { autoAdvance, nextSentence, prevSentence } from './sentence-player.ts';

describe('autoAdvance', () => {
  it('moves to the next sentence', () => {
    expect(autoAdvance(0, 5)).toBe(1);
    expect(autoAdvance(3, 5)).toBe(4);
  });

  it('stops after the last sentence', () => {
    expect(autoAdvance(4, 5)).toBeNull();
  });

  it('stops immediately for a single-sentence story', () => {
    expect(autoAdvance(0, 1)).toBeNull();
  });
});

describe('nextSentence', () => {
  it('starts at the first sentence when nothing has played yet', () => {
    expect(nextSentence(null, 5)).toBe(0);
  });

  it('advances from the current sentence', () => {
    expect(nextSentence(2, 5)).toBe(3);
  });

  it('refuses to go past the last sentence', () => {
    expect(nextSentence(4, 5)).toBeNull();
  });

  it('returns null for an empty story', () => {
    expect(nextSentence(null, 0)).toBeNull();
  });
});

describe('prevSentence', () => {
  it('treats "not started" as the first sentence, so there is nothing before it', () => {
    expect(prevSentence(null)).toBeNull();
  });

  it('steps back from the current sentence', () => {
    expect(prevSentence(3)).toBe(2);
  });

  it('refuses to go before the first sentence', () => {
    expect(prevSentence(0)).toBeNull();
  });
});
