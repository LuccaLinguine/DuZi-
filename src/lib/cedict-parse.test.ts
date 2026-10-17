import { describe, it, expect } from 'vitest';
import {
  parseCedictLine,
  parseCedict,
  shardFor,
  packEntry,
  unpackEntry,
  primaryEntry,
  CEDICT_SHARDS,
} from './cedict-parse.ts';

describe('parseCedictLine', () => {
  it('parses a normal entry', () => {
    const e = parseCedictLine('漢字 汉字 [han4 zi4] /Chinese character/');
    expect(e).toEqual({
      simp: '汉字',
      trad: '漢字',
      py: 'hàn zì',
      pyNumbered: 'han4 zi4',
      defs: ['Chinese character'],
    });
  });

  it('keeps every definition in order', () => {
    const e = parseCedictLine('書 书 [shu1] /book/letter/to write/');
    expect(e?.defs).toEqual(['book', 'letter', 'to write']);
  });

  it('tone-marks pinyin inside cross-references', () => {
    const e = parseCedictLine('貓 猫 [mao1] /cat (CL:隻|只[zhi1])/');
    expect(e?.defs[0]).toBe('cat (CL:隻|只[zhī])');
  });

  it('skips comments and blank lines', () => {
    expect(parseCedictLine('# comment')).toBeNull();
    expect(parseCedictLine('')).toBeNull();
    expect(parseCedictLine('   ')).toBeNull();
  });

  it('skips lines that do not match the format', () => {
    expect(parseCedictLine('漢字 汉字 han4 zi4 /no brackets/')).toBeNull();
    expect(parseCedictLine('漢字 汉字 [han4 zi4] //')).toBeNull();
  });
});

describe('parseCedict', () => {
  it('parses a file and drops its header', () => {
    const file = [
      '#! version=1',
      '#! date=2026-10-16T08:13:11Z',
      '你好 你好 [ni3 hao3] /hello/hi/',
      '',
      '謝謝 谢谢 [xie4 xie5] /to thank/thanks/',
    ].join('\n');
    const entries = parseCedict(file);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.simp).toBe('你好');
    expect(entries[1]?.py).toBe('xiè xie');
  });
});

describe('shardFor', () => {
  it('is stable and in range', () => {
    for (const w of ['你好', '汉字', '一', 'a', '書']) {
      const s = shardFor(w);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(CEDICT_SHARDS);
      expect(shardFor(w)).toBe(s);
    }
  });

  it('puts words sharing a first character in the same shard', () => {
    expect(shardFor('汉字')).toBe(shardFor('汉语'));
  });
});

describe('pack/unpack', () => {
  it('round-trips an entry', () => {
    const entry = {
      simp: '书',
      trad: '書',
      py: 'shū',
      pyNumbered: 'shu1',
      defs: ['book', 'letter', 'to write'],
    };
    expect(unpackEntry(packEntry(entry))).toEqual({
      trad: '書',
      py: 'shū',
      defs: ['book', 'letter', 'to write'],
    });
  });
});

describe('primaryEntry', () => {
  it('prefers the entry whose traditional form matches the simplified query', () => {
    const entries = [
      { trad: '傢', py: 'jiā', defs: ['used in 傢伙'] },
      { trad: '家', py: 'jiā', defs: ['home/family'] },
    ];
    expect(primaryEntry('家', entries)?.defs).toEqual(['home/family']);
  });

  it('falls back to the first entry when none match exactly', () => {
    const entries = [
      { trad: '乾', py: 'gān', defs: ['dry'] },
      { trad: '幹', py: 'gàn', defs: ['to do'] },
    ];
    expect(primaryEntry('干', entries)).toBe(entries[0]);
  });

  it('returns undefined for no entries', () => {
    expect(primaryEntry('家', [])).toBeUndefined();
  });
});
