import { describe, it, expect } from 'vitest';
import { resolveSettingsPatch } from './settings-patch.ts';
import { DEFAULT_SETTINGS } from '../db/settings.ts';
import type { Settings } from '../db/types.ts';

describe('resolveSettingsPatch', () => {
  it('merges a plain object patch over the previous settings', () => {
    const { resolved, next } = resolveSettingsPatch(DEFAULT_SETTINGS, { speechRate: 1.2 });
    expect(resolved).toEqual({ speechRate: 1.2 });
    expect(next.speechRate).toBe(1.2);
    expect(next.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });

  it('resolves a functional patch against the given previous value', () => {
    const { resolved, next } = resolveSettingsPatch(DEFAULT_SETTINGS, (prev) => ({
      showTranslations: !prev.showTranslations,
    }));
    expect(resolved).toEqual({ showTranslations: true });
    expect(next.showTranslations).toBe(true);
  });

  it('chains correctly: the second call sees the first call\'s result, not the original', () => {
    // This is the property that was broken: cycling through a list of values
    // via a plain-object patch computed from a possibly-stale snapshot would
    // make two quick calls both compute the same "next" value. The functional
    // form fixes it by resolving against whatever `prev` the caller passes —
    // here, explicitly the previous call's `next`, simulating the ref in
    // useSettings always being up to date before the second call runs.
    const SPEEDS = [0.6, 0.8, 1, 1.2] as const;
    const cycle = (prev: Settings) => {
      const i = SPEEDS.indexOf(prev.speechRate as (typeof SPEEDS)[number]);
      return { speechRate: SPEEDS[(i === -1 ? 0 : i + 1) % SPEEDS.length]! };
    };

    const first = resolveSettingsPatch(DEFAULT_SETTINGS, cycle);
    expect(first.next.speechRate).toBe(1.2);

    const second = resolveSettingsPatch(first.next, cycle);
    expect(second.next.speechRate).toBe(0.6);

    const third = resolveSettingsPatch(second.next, cycle);
    expect(third.next.speechRate).toBe(0.8);
  });

  it('demonstrates the bug a plain-object patch would have had', () => {
    // If two dispatches both compute their patch from the SAME stale
    // snapshot (as a naive `onChange({ speechRate: next(settings.speechRate) })`
    // in a component would, before a re-render lands), they collapse into one
    // transition instead of two.
    const SPEEDS = [0.6, 0.8, 1, 1.2] as const;
    const nextRate = (rate: number) => {
      const i = SPEEDS.indexOf(rate as (typeof SPEEDS)[number]);
      return SPEEDS[(i === -1 ? 0 : i + 1) % SPEEDS.length]!;
    };
    const staleRate = DEFAULT_SETTINGS.speechRate; // 1
    const firstPatch = { speechRate: nextRate(staleRate) }; // 1.2, computed from stale snapshot
    const secondPatch = { speechRate: nextRate(staleRate) }; // ALSO 1.2 — the bug

    const afterFirst = resolveSettingsPatch(DEFAULT_SETTINGS, firstPatch);
    const afterSecond = resolveSettingsPatch(afterFirst.next, secondPatch);
    // Two taps, but the rate only moved once.
    expect(afterSecond.next.speechRate).toBe(1.2);
  });

  it('only writes the changed fields to resolved, not the whole object', () => {
    const { resolved } = resolveSettingsPatch(DEFAULT_SETTINGS, { fontSize: 24 });
    expect(Object.keys(resolved)).toEqual(['fontSize']);
  });
});
