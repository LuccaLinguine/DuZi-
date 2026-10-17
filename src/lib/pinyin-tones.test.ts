import { describe, it, expect } from 'vitest';
import { numberedToToneMarks, syllableToToneMarks, stripTones } from './pinyin-tones.ts';

describe('syllableToToneMarks', () => {
  it('marks each tone on a simple syllable', () => {
    expect(syllableToToneMarks('ma1')).toBe('mā');
    expect(syllableToToneMarks('ma2')).toBe('má');
    expect(syllableToToneMarks('ma3')).toBe('mǎ');
    expect(syllableToToneMarks('ma4')).toBe('mà');
    expect(syllableToToneMarks('ma5')).toBe('ma');
  });

  it('puts the mark on a or e when present', () => {
    expect(syllableToToneMarks('hao3')).toBe('hǎo');
    expect(syllableToToneMarks('xie4')).toBe('xiè');
    expect(syllableToToneMarks('jiao4')).toBe('jiào');
  });

  it('puts the mark on the o of -ou', () => {
    expect(syllableToToneMarks('zhou1')).toBe('zhōu');
    expect(syllableToToneMarks('gou3')).toBe('gǒu');
  });

  it('otherwise marks the last vowel', () => {
    expect(syllableToToneMarks('shui3')).toBe('shuǐ');
    expect(syllableToToneMarks('jiu3')).toBe('jiǔ');
    expect(syllableToToneMarks('xiong1')).toBe('xiōng');
  });

  it('converts the u: spelling to ü', () => {
    expect(syllableToToneMarks('lu:4')).toBe('lǜ');
    expect(syllableToToneMarks('nu:3')).toBe('nǚ');
    expect(syllableToToneMarks('lu:e4')).toBe('lüè');
  });

  it('keeps capitalisation for proper nouns', () => {
    expect(syllableToToneMarks('Zhong1')).toBe('Zhōng');
    expect(syllableToToneMarks('Ao4')).toBe('Ào');
  });

  it('leaves tokens with no tone number alone', () => {
    expect(syllableToToneMarks('xx')).toBe('xx');
    expect(syllableToToneMarks('·')).toBe('·');
  });
});

describe('numberedToToneMarks', () => {
  it('converts a whole pinyin field and keeps the spacing', () => {
    expect(numberedToToneMarks('ni3 hao3')).toBe('nǐ hǎo');
    expect(numberedToToneMarks('Zhong1 guo2 ren2')).toBe('Zhōng guó rén');
    expect(numberedToToneMarks('han4 zi4')).toBe('hàn zì');
  });

  it('leaves neutral tones unmarked', () => {
    expect(numberedToToneMarks('peng2 you5')).toBe('péng you');
    expect(numberedToToneMarks('ge4 zi5')).toBe('gè zi');
  });

  it('passes non-syllable tokens through', () => {
    expect(numberedToToneMarks('CL: ge4')).toBe('CL: gè');
  });
});

describe('stripTones', () => {
  it('removes tone marks', () => {
    expect(stripTones('nǐ hǎo')).toBe('ni hao');
    expect(stripTones('lǜ')).toBe('lu');
  });
});
