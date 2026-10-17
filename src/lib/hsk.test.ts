import { describe, it, expect } from 'vitest';
import { computeInLevel, isInLevel, isInLevelAt, type HskMap } from './hsk.ts';

const MAP: HskMap = {
  我: 1, 是: 1, 学生: 1, 书: 1, 手: 1, 里: 1, 星期: 1, 六: 1, 二: 1, 十: 1,
  可是: 2, 小说: 2, 故事: 2,
  奇怪: 3,
  手里: 4,
  经济: 5,
};

describe('isInLevelAt', () => {
  it('accepts words at or below the ceiling', () => {
    expect(isInLevelAt('我', 1, MAP)).toBe(true);
    expect(isInLevelAt('可是', 2, MAP)).toBe(true);
    expect(isInLevelAt('奇怪', 3, MAP)).toBe(true);
  });

  it('rejects words above the ceiling', () => {
    expect(isInLevelAt('可是', 1, MAP)).toBe(false);
    expect(isInLevelAt('奇怪', 2, MAP)).toBe(false);
  });

  it('accepts unlisted compounds whose parts are in level', () => {
    // 星期六 and 二十 are not HSK entries, but their pieces are.
    expect(isInLevelAt('星期六', 1, MAP)).toBe(true);
    expect(isInLevelAt('二十', 1, MAP)).toBe(true);
  });

  it('still rejects a listed compound at a higher band', () => {
    // 手里 is an HSK 4 entry even though 手 and 里 are both HSK 1.
    expect(isInLevelAt('手里', 3, MAP)).toBe(false);
    expect(isInLevelAt('手里', 4, MAP)).toBe(true);
    // Same for 小说, whose meaning is not the sum of its characters.
    expect(isInLevelAt('小说', 1, MAP)).toBe(false);
  });

  it('rejects unlisted single characters', () => {
    expect(isInLevelAt('龘', 9, MAP)).toBe(false);
  });

  it('rejects a compound with an unlisted part', () => {
    expect(isInLevelAt('我龘', 9, MAP)).toBe(false);
  });
});

describe('isInLevel', () => {
  it('maps a level id to its ceiling', () => {
    expect(isInLevel('我', 'newbie', MAP)).toBe(true);
    expect(isInLevel('可是', 'newbie', MAP)).toBe(false);
    expect(isInLevel('可是', 'elementary', MAP)).toBe(true);
    expect(isInLevel('经济', 'advanced', MAP)).toBe(true);
  });
});

describe('computeInLevel', () => {
  it('ignores punctuation when counting', () => {
    const stats = computeInLevel(['我', '，', '是', '。'], 'newbie', MAP);
    expect(stats.total).toBe(2);
    expect(stats.inLevel).toBe(2);
    expect(stats.pct).toBe(100);
  });

  it('counts per occurrence, not per distinct word', () => {
    const stats = computeInLevel(['我', '奇怪', '奇怪', '奇怪'], 'newbie', MAP);
    expect(stats.total).toBe(4);
    expect(stats.inLevel).toBe(1);
    expect(stats.pct).toBe(25);
    expect(stats.aboveLevel).toEqual([{ w: '奇怪', count: 3, hsk: 3 }]);
  });

  it('rounds to one decimal place', () => {
    // 2 of 3 in level = 66.666…
    expect(computeInLevel(['我', '是', '奇怪'], 'newbie', MAP).pct).toBe(66.7);
  });

  it('reports above-level words most frequent first', () => {
    const stats = computeInLevel(['小说', '奇怪', '奇怪'], 'newbie', MAP);
    expect(stats.aboveLevel.map((a) => a.w)).toEqual(['奇怪', '小说']);
  });

  it('treats words absent from the lists as above level', () => {
    const stats = computeInLevel(['龘'], 'master', MAP);
    expect(stats.inLevel).toBe(0);
    expect(stats.aboveLevel[0]).toEqual({ w: '龘', count: 1, hsk: undefined });
  });

  it('returns 0% for a story with no words', () => {
    expect(computeInLevel(['。', '，'], 'newbie', MAP).pct).toBe(0);
  });
});
