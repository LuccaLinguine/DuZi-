import { describe, it, expect } from 'vitest';
import { segmentPastedText, buildPastedStory, pastedStoryChars } from './paste-import.ts';

const DICT = new Set(['你好', '朋友', '图书馆', '学习']);
const has = (w: string) => DICT.has(w);

describe('segmentPastedText', () => {
  it('splits into sentences and segments each one', () => {
    const result = segmentPastedText('你好，朋友。我在图书馆学习。', has);
    expect(result).toHaveLength(2);
    expect(result[0]!.zh).toBe('你好，朋友。');
    expect(result[0]!.tokens).toEqual(['你好', '，', '朋友', '。']);
    expect(result[1]!.tokens).toEqual(['我', '在', '图书馆', '学习', '。']);
  });

  it('reassembles each sentence exactly from its tokens', () => {
    const result = segmentPastedText('你好，朋友！还有一句话', has);
    for (const s of result) expect(s.tokens.join('')).toBe(s.zh);
  });

  it('handles empty input', () => {
    expect(segmentPastedText('', has)).toEqual([]);
  });
});

describe('buildPastedStory', () => {
  it('builds a story with empty gloss/pos and no grammar points or questions', () => {
    const story = buildPastedStory({
      id: 'paste-1',
      title: 'My Text',
      level: 'intermediate',
      sentences: [{ zh: '你好。', tokens: ['你好', '。'], pinyin: ['nǐ hǎo', ''] }],
    });
    expect(story.id).toBe('paste-1');
    expect(story.title_en).toBe('My Text');
    expect(story.format).toBe('article');
    expect(story.topic).toBe('Imported text');
    expect(story.grammar_points).toEqual([]);
    expect(story.questions).toEqual([]);
    expect(story.sentences[0]!.en).toBe('');
    expect(story.sentences[0]!.tokens).toEqual([
      { w: '你好', py: 'nǐ hǎo', gloss: '', pos: '' },
      { w: '。', py: '', gloss: '', pos: '' },
    ]);
  });

  it('falls back to the first sentence for a title_zh when none is given', () => {
    const story = buildPastedStory({
      id: 'paste-2',
      title: '',
      level: 'newbie',
      sentences: [{ zh: '今天天气很好。', tokens: ['今天天气很好。'], pinyin: [''] }],
    });
    expect(story.title_zh).toBe('今天天气很好。'.slice(0, 12));
  });

  it('keeps tokens and pinyin in correspondence even with a short pinyin array', () => {
    const story = buildPastedStory({
      id: 'paste-3',
      title: 't',
      level: 'newbie',
      sentences: [{ zh: '你好', tokens: ['你好'], pinyin: [] }],
    });
    expect(story.sentences[0]!.tokens[0]!.py).toBe('');
  });
});

describe('pastedStoryChars', () => {
  it('counts Han characters across all sentences', () => {
    // 你好朋友 (4) + 年 (1) = 5; punctuation and digits don't count.
    expect(pastedStoryChars([{ zh: '你好，朋友。' }, { zh: '2026年' }])).toBe(5);
  });

  it('is zero for no sentences', () => {
    expect(pastedStoryChars([])).toBe(0);
  });
});
