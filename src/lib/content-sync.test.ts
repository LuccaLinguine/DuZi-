import { describe, it, expect } from 'vitest';
import {
  planSync,
  isPlanEmpty,
  checkStory,
  storyWords,
  storyChars,
  newWordRows,
  toStoryRow,
  StoryRejected,
} from './content-sync.ts';
import type { Story, StoryManifest, StoryManifestEntry } from './story-schema.ts';
import type { StoryRow } from '../db/types.ts';

type ExistingRow = Pick<StoryRow, 'id' | 'hash' | 'source' | 'hidden'>;

function entry(id: string, hash: string): StoryManifestEntry {
  return {
    id,
    file: `stories/${id}.json`,
    title_zh: '题',
    title_en: 'Title',
    level: 'newbie',
    topic: 'Daily life',
    format: 'story',
    series_id: null,
    chapter: null,
    created_at: '2026-10-17',
    chars: 100,
    in_level_pct: 100,
    hash,
  };
}

function manifest(...entries: StoryManifestEntry[]): StoryManifest {
  return { generated_at: '2026-10-17T00:00:00.000Z', stories: entries };
}

function row(id: string, hash: string, extra: Partial<ExistingRow> = {}): ExistingRow {
  return { id, hash, source: 'bundled', ...extra };
}

describe('planSync', () => {
  it('imports stories the device does not have', () => {
    const plan = planSync(manifest(entry('a', 'h1'), entry('b', 'h2')), []);
    expect(plan.added.map((e) => e.id)).toEqual(['a', 'b']);
    expect(plan.updated).toEqual([]);
    expect(plan.removed).toEqual([]);
  });

  it('does nothing when the hashes match', () => {
    const plan = planSync(manifest(entry('a', 'h1')), [row('a', 'h1')]);
    expect(isPlanEmpty(plan)).toBe(true);
    expect(plan.unchanged).toBe(1);
  });

  it('re-imports a story whose hash changed', () => {
    const plan = planSync(manifest(entry('a', 'h2')), [row('a', 'h1')]);
    expect(plan.updated.map((e) => e.id)).toEqual(['a']);
    expect(plan.added).toEqual([]);
  });

  it('hides a bundled story that left the manifest, never deletes it', () => {
    const plan = planSync(manifest(entry('a', 'h1')), [row('a', 'h1'), row('gone', 'h9')]);
    expect(plan.removed).toEqual(['gone']);
  });

  it('leaves pasted and hand-imported stories alone', () => {
    const plan = planSync(manifest(), [
      row('paste-1', 'h1', { source: 'pasted' }),
      row('hand-1', 'h2', { source: 'imported' }),
    ]);
    expect(plan.removed).toEqual([]);
  });

  it('does not re-hide an already hidden story', () => {
    const plan = planSync(manifest(), [row('gone', 'h1', { hidden: true })]);
    expect(plan.removed).toEqual([]);
    expect(isPlanEmpty(plan)).toBe(true);
  });

  it('restores a hidden story that came back unchanged', () => {
    const plan = planSync(manifest(entry('a', 'h1')), [row('a', 'h1', { hidden: true })]);
    expect(plan.restored).toEqual(['a']);
    expect(isPlanEmpty(plan)).toBe(false);
  });

  it('handles added, updated and removed in one pass', () => {
    const plan = planSync(manifest(entry('keep', 'h1'), entry('change', 'h2new'), entry('new', 'h3')), [
      row('keep', 'h1'),
      row('change', 'h2old'),
      row('drop', 'h4'),
    ]);
    expect(plan.added.map((e) => e.id)).toEqual(['new']);
    expect(plan.updated.map((e) => e.id)).toEqual(['change']);
    expect(plan.removed).toEqual(['drop']);
    expect(plan.unchanged).toBe(1);
  });
});

/* ---------------- story validation on import ---------------- */

const GOOD: Story = {
  id: 'x',
  series_id: null,
  chapter: null,
  topic: 'Daily life',
  format: 'story',
  created_at: '2026-10-17',
  ai_generated: true,
  title_zh: '题',
  title_en: 'Title',
  summary_en: 'A summary.',
  level: 'newbie',
  sentences: [
    {
      zh: '你好，朋友。',
      en: 'Hello, friend.',
      tokens: [
        { w: '你好', py: 'nǐ hǎo', gloss: 'hello', pos: 'verb' },
        { w: '，', py: '', gloss: '', pos: '' },
        { w: '朋友', py: 'péng you', gloss: 'friend', pos: 'noun' },
        { w: '。', py: '', gloss: '', pos: '' },
      ],
    },
    {
      zh: '朋友很好。',
      en: 'My friend is good.',
      tokens: [
        { w: '朋友', py: 'péng you', gloss: 'friend', pos: 'noun' },
        { w: '很', py: 'hěn', gloss: 'very', pos: 'adv' },
        { w: '好', py: 'hǎo', gloss: 'good', pos: 'adj' },
        { w: '。', py: '', gloss: '', pos: '' },
      ],
    },
  ],
  new_words: [],
  grammar_points: [
    { pattern: 'A 很 B', explanation_en: 'x', example_zh: '他很好。', example_en: 'He is well.' },
  ],
  questions: [
    { q_zh: '谁很好？', q_en: 'Who is well?', answer_en: 'The friend.' },
    { q_zh: '他说什么？', q_en: 'What does he say?', answer_en: 'Hello.' },
  ],
};

describe('checkStory', () => {
  it('accepts a well-formed story', () => {
    expect(checkStory(structuredClone(GOOD)).id).toBe('x');
  });

  it('rejects a story whose tokens do not join to zh', () => {
    const bad = structuredClone(GOOD);
    bad.sentences[0]!.tokens.splice(1, 1);
    expect(() => checkStory(bad)).toThrow(StoryRejected);
    expect(() => checkStory(bad)).toThrow(/tokens do not join/);
  });

  it('rejects a missing field and names it', () => {
    const bad = structuredClone(GOOD) as Partial<Story>;
    delete bad.title_zh;
    try {
      checkStory(bad);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(StoryRejected);
      expect((err as StoryRejected).issues[0]).toMatch(/title_zh/);
    }
  });

  it('rejects an unknown level', () => {
    const bad = structuredClone(GOOD);
    (bad as { level: string }).level = 'expert';
    expect(() => checkStory(bad)).toThrow(/level/);
  });

  it('rejects anything that is not an object', () => {
    expect(() => checkStory(null)).toThrow(StoryRejected);
    expect(() => checkStory([])).toThrow(StoryRejected);
  });
});

/* ---------------- derived values ---------------- */

describe('storyWords', () => {
  it('lists distinct words in first-appearance order, skipping punctuation', () => {
    expect(storyWords(GOOD)).toEqual(['你好', '朋友', '很', '好']);
  });
});

describe('storyChars', () => {
  it('counts Han characters only', () => {
    // 你好朋友 (4) + 朋友很好 (4); the two full stops and the comma do not count.
    expect(storyChars(GOOD)).toBe(8);
  });
});

describe('newWordRows', () => {
  it('creates every word as new with zeroed counters', () => {
    const rows = newWordRows(['你好', '朋友'], 1_000);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      w: '你好',
      status: 'new',
      timesSeen: 0,
      timesLookedUp: 0,
      seenWithoutLookup: 0,
      firstSeen: 1_000,
      lastSeen: 1_000,
      lastLookedUp: null,
      cardId: null,
    });
  });
});

describe('toStoryRow', () => {
  it('copies the manifest figures and marks the source', () => {
    const r = toStoryRow(GOOD, { hash: 'h1', chars: 9, in_level_pct: 100 });
    expect(r.id).toBe('x');
    expect(r.hash).toBe('h1');
    expect(r.source).toBe('bundled');
    expect(r.hidden).toBe(false);
    expect(r.story).toBe(GOOD);
  });
});
