import { describe, it, expect } from 'vitest';
import {
  hasHan, isHanOnly, isWordToken, isPunctuationToken,
  countChineseChars, splitChars, splitSentences,
} from './text.ts';

describe('word vs punctuation', () => {
  it('treats Han text as words', () => {
    expect(isWordToken('汉字')).toBe(true);
    expect(isWordToken('好')).toBe(true);
  });

  it('treats punctuation, digits and Latin as non-words', () => {
    for (const t of ['，', '。', '：“', '  ', '2026', 'OK', '！？']) {
      expect(isWordToken(t)).toBe(false);
      expect(isPunctuationToken(t)).toBe(true);
    }
  });

  it('distinguishes pure Han from mixed', () => {
    expect(isHanOnly('汉字')).toBe(true);
    expect(isHanOnly('汉字A')).toBe(false);
    expect(hasHan('汉字A')).toBe(true);
  });
});

describe('countChineseChars', () => {
  it('counts only Han characters', () => {
    expect(countChineseChars('你好，朋友。')).toBe(4);
    expect(countChineseChars('2026年1月')).toBe(2);
    expect(countChineseChars('hello')).toBe(0);
  });
});

describe('splitChars', () => {
  it('splits a word into its Han characters', () => {
    expect(splitChars('图书馆')).toEqual(['图', '书', '馆']);
    expect(splitChars('，')).toEqual([]);
  });
});

describe('splitSentences', () => {
  it('keeps the ending punctuation with its sentence', () => {
    expect(splitSentences('我很好。你呢？')).toEqual(['我很好。', '你呢？']);
  });

  it('pulls a closing quote into the sentence', () => {
    expect(splitSentences('他说：“你好！”我笑了。')).toEqual(['他说：“你好！”', '我笑了。']);
  });

  it('keeps a trailing fragment with no ending punctuation', () => {
    expect(splitSentences('我很好。还有一句话')).toEqual(['我很好。', '还有一句话']);
  });

  it('splits on line breaks too', () => {
    expect(splitSentences('第一段\n第二段')).toEqual(['第一段', '第二段']);
  });

  it('returns nothing for empty input', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences('   ')).toEqual([]);
  });
});
