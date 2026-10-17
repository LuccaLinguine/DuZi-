import { describe, it, expect } from 'vitest';
import { segment, tokensJoinTo, joinMismatch } from './segment.ts';

/** A stand-in dictionary; the real one is the CC-CEDICT shard set. */
const WORDS = new Set([
  '你好', '汉字', '中国', '中国人', '朋友', '图书馆', '北京', '学习', '大学',
  '大学生', '不是', '一个',
]);
const has = (w: string) => WORDS.has(w);

describe('segment', () => {
  it('prefers the longest match', () => {
    expect(segment('中国人', { has })).toEqual(['中国人']);
    expect(segment('大学生', { has })).toEqual(['大学生']);
  });

  it('falls back to single characters for unknown runs', () => {
    expect(segment('我去', { has })).toEqual(['我', '去']);
  });

  it('segments a sentence into words and punctuation', () => {
    expect(segment('你好，朋友！', { has })).toEqual(['你好', '，', '朋友', '！']);
  });

  it('keeps runs of non-Han text together', () => {
    expect(segment('2026年', { has })).toEqual(['2026', '年']);
    expect(segment('他说OK。', { has })).toEqual(['他', '说', 'OK', '。']);
  });

  it('reassembles into the original string', () => {
    const text = '我在图书馆学习汉字，他是中国人。';
    expect(segment(text, { has }).join('')).toBe(text);
  });

  it('handles an empty string', () => {
    expect(segment('', { has })).toEqual([]);
  });

  it('respects maxLen', () => {
    expect(segment('中国人', { has, maxLen: 2 })).toEqual(['中国', '人']);
  });
});

describe('tokensJoinTo', () => {
  const tokens = [{ w: '你好' }, { w: '，' }, { w: '朋友' }];

  it('accepts tokens that join exactly', () => {
    expect(tokensJoinTo(tokens, '你好，朋友')).toBe(true);
  });

  it('rejects a missing token', () => {
    expect(tokensJoinTo([{ w: '你好' }, { w: '朋友' }], '你好，朋友')).toBe(false);
  });

  it('rejects a different order', () => {
    expect(tokensJoinTo([{ w: '朋友' }, { w: '，' }, { w: '你好' }], '你好，朋友')).toBe(false);
  });
});

describe('joinMismatch', () => {
  it('returns null when the tokens join', () => {
    expect(joinMismatch([{ w: '你好' }], '你好')).toBeNull();
  });

  it('reports where the join diverges', () => {
    const m = joinMismatch([{ w: '你好' }, { w: '朋友' }], '你好，朋友');
    expect(m).toEqual({ joined: '你好朋友', at: 2 });
  });
});
