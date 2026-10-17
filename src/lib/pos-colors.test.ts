import { describe, it, expect } from 'vitest';
import { posColor, POS_LABELS, POS_ORDER } from './pos-colors.ts';
import { POS_TAGS } from './story-schema.ts';

describe('posColor', () => {
  it('returns a distinct hex for every pos', () => {
    const colors = POS_TAGS.map((p) => posColor(p, 'light'));
    expect(new Set(colors).size).toBe(POS_TAGS.length);
  });

  it('uses the same colours for light and sepia (both light-family surfaces)', () => {
    for (const pos of POS_TAGS) {
      expect(posColor(pos, 'sepia')).toBe(posColor(pos, 'light'));
    }
  });

  it('uses different colours for dark mode', () => {
    for (const pos of POS_TAGS) {
      expect(posColor(pos, 'dark')).not.toBe(posColor(pos, 'light'));
    }
  });

  it('returns valid hex strings', () => {
    for (const pos of POS_TAGS) {
      expect(posColor(pos, 'light')).toMatch(/^#[0-9a-f]{6}$/);
      expect(posColor(pos, 'dark')).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('POS_LABELS / POS_ORDER', () => {
  it('has a label for every pos tag', () => {
    for (const pos of POS_TAGS) expect(POS_LABELS[pos]).toBeTruthy();
  });

  it('orders every pos tag exactly once', () => {
    expect([...POS_ORDER].sort()).toEqual([...POS_TAGS].sort());
  });
});
