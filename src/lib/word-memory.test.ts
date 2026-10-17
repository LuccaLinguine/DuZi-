import { describe, it, expect } from 'vitest';
import {
  newWordRow,
  applyLookup,
  applyStoryRead,
  applyCardGraduated,
  applyCardLapsed,
  applyManualStatus,
  pinyinVisible,
} from './word-memory.ts';
import type { WordRow } from '../db/types.ts';

const T0 = 1_000;
const T1 = 2_000;

function row(overrides: Partial<WordRow> = {}): WordRow {
  return { ...newWordRow('汉字', T0), ...overrides };
}

describe('newWordRow', () => {
  it('starts as new with zeroed counters', () => {
    expect(newWordRow('汉字', T0)).toEqual({
      w: '汉字',
      status: 'new',
      timesSeen: 0,
      timesLookedUp: 0,
      seenWithoutLookup: 0,
      firstSeen: T0,
      lastSeen: T0,
      lastLookedUp: null,
      cardId: null,
    });
  });
});

describe('applyLookup', () => {
  it('moves new to learning', () => {
    const r = applyLookup(row({ status: 'new' }), T1);
    expect(r.status).toBe('learning');
    expect(r.timesLookedUp).toBe(1);
    expect(r.lastLookedUp).toBe(T1);
    expect(r.lastSeen).toBe(T1);
  });

  it('keeps learning as learning', () => {
    expect(applyLookup(row({ status: 'learning', timesLookedUp: 2 }), T1)).toMatchObject({
      status: 'learning',
      timesLookedUp: 3,
    });
  });

  it('demotes known back to learning — "I evidently forgot it"', () => {
    const r = applyLookup(row({ status: 'known' }), T1);
    expect(r.status).toBe('learning');
  });

  it('leaves ignored words ignored', () => {
    const r = applyLookup(row({ status: 'ignored' }), T1);
    expect(r.status).toBe('ignored');
    // Counters still move — it was still a lookup.
    expect(r.timesLookedUp).toBe(1);
  });

  it('always resets the seen-without-lookup streak to 0', () => {
    const r = applyLookup(row({ status: 'learning', seenWithoutLookup: 2 }), T1);
    expect(r.seenWithoutLookup).toBe(0);
  });
});

describe('applyStoryRead', () => {
  const threshold = 3;

  it('increments timesSeen for a tapped word without touching the streak', () => {
    const r = applyStoryRead(row({ status: 'learning', seenWithoutLookup: 0, timesSeen: 1 }), true, T1, threshold);
    expect(r.timesSeen).toBe(2);
    expect(r.seenWithoutLookup).toBe(0);
    expect(r.status).toBe('learning');
  });

  it('grows the streak for an untapped word below threshold', () => {
    const r = applyStoryRead(row({ status: 'new', seenWithoutLookup: 1, timesSeen: 1 }), false, T1, threshold);
    expect(r.seenWithoutLookup).toBe(2);
    expect(r.status).toBe('new');
  });

  it('graduates to known once the streak reaches the threshold', () => {
    const r = applyStoryRead(row({ status: 'learning', seenWithoutLookup: 2, timesSeen: 2 }), false, T1, threshold);
    expect(r.seenWithoutLookup).toBe(3);
    expect(r.status).toBe('known');
  });

  it('graduates a never-looked-up new word the same way', () => {
    const r = applyStoryRead(row({ status: 'new', seenWithoutLookup: 2 }), false, T1, threshold);
    expect(r.status).toBe('known');
  });

  it('leaves an already-known word known', () => {
    const r = applyStoryRead(row({ status: 'known', seenWithoutLookup: 5 }), false, T1, threshold);
    expect(r.status).toBe('known');
    expect(r.seenWithoutLookup).toBe(6);
  });

  it('leaves an ignored word ignored, streak still counted', () => {
    const r = applyStoryRead(row({ status: 'ignored', seenWithoutLookup: 5 }), false, T1, threshold);
    expect(r.status).toBe('ignored');
  });

  it('respects a custom threshold', () => {
    const r1 = applyStoryRead(row({ status: 'learning', seenWithoutLookup: 0 }), false, T1, 1);
    expect(r1.status).toBe('known');
  });
});

describe('applyCardGraduated / applyCardLapsed', () => {
  it('graduates a card to known', () => {
    expect(applyCardGraduated(row({ status: 'learning' }), T1).status).toBe('known');
  });

  it('does not touch an ignored word', () => {
    expect(applyCardGraduated(row({ status: 'ignored' }), T1).status).toBe('ignored');
  });

  it('demotes a known word on a lapsed review', () => {
    expect(applyCardLapsed(row({ status: 'known' }), T1).status).toBe('learning');
  });

  it('leaves a non-known word alone on lapse', () => {
    expect(applyCardLapsed(row({ status: 'learning' }), T1).status).toBe('learning');
    expect(applyCardLapsed(row({ status: 'new' }), T1).status).toBe('new');
  });
});

describe('applyManualStatus', () => {
  it('sets the status outright, from any starting point', () => {
    expect(applyManualStatus(row({ status: 'known' }), 'ignored', T1).status).toBe('ignored');
    expect(applyManualStatus(row({ status: 'ignored' }), 'learning', T1).status).toBe('learning');
  });
});

describe('pinyinVisible', () => {
  it('off hides everything', () => {
    expect(pinyinVisible('off', 'new', true)).toBe(false);
    expect(pinyinVisible('off', 'known', false)).toBe(false);
  });

  it('all shows everything', () => {
    expect(pinyinVisible('all', 'known', false)).toBe(true);
    expect(pinyinVisible('all', undefined, false)).toBe(true);
  });

  it('above shows only above-level words, regardless of status', () => {
    expect(pinyinVisible('above', 'known', true)).toBe(true);
    expect(pinyinVisible('above', 'new', false)).toBe(false);
  });

  it('smart shows new and learning, hides known and ignored', () => {
    expect(pinyinVisible('smart', 'new', false)).toBe(true);
    expect(pinyinVisible('smart', 'learning', false)).toBe(true);
    expect(pinyinVisible('smart', 'known', false)).toBe(false);
    expect(pinyinVisible('smart', 'ignored', false)).toBe(false);
  });

  it('smart treats a word with no row yet as new', () => {
    expect(pinyinVisible('smart', undefined, false)).toBe(true);
  });
});
