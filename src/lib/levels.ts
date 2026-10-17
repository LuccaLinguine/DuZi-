/**
 * The six reading levels and what each one means in terms of vocabulary
 * ceiling and story length. Shared between the app and the content scripts.
 */

export const LEVEL_IDS = [
  'newbie',
  'elementary',
  'intermediate',
  'upper',
  'advanced',
  'master',
] as const;

export type LevelId = (typeof LEVEL_IDS)[number];

export interface Level {
  id: LevelId;
  name: string;
  /** Highest HSK 3.0 band whose words count as "in level". */
  hskCeiling: number;
  /** Target story length in Chinese characters. */
  minChars: number;
  maxChars: number;
}

export const LEVELS: Record<LevelId, Level> = {
  newbie: { id: 'newbie', name: 'Newbie', hskCeiling: 1, minChars: 80, maxChars: 150 },
  elementary: { id: 'elementary', name: 'Elementary', hskCeiling: 2, minChars: 150, maxChars: 300 },
  intermediate: { id: 'intermediate', name: 'Intermediate', hskCeiling: 3, minChars: 300, maxChars: 500 },
  upper: { id: 'upper', name: 'Upper Intermediate', hskCeiling: 4, minChars: 500, maxChars: 800 },
  advanced: { id: 'advanced', name: 'Advanced', hskCeiling: 5, minChars: 800, maxChars: 1200 },
  master: { id: 'master', name: 'Master', hskCeiling: 9, minChars: 1200, maxChars: 2000 },
};

export const LEVEL_LIST: Level[] = LEVEL_IDS.map((id) => LEVELS[id]);

export function isLevelId(v: unknown): v is LevelId {
  return typeof v === 'string' && (LEVEL_IDS as readonly string[]).includes(v);
}

export function levelOf(id: LevelId): Level {
  return LEVELS[id];
}

/** The next level up, or the same level if already at the top. */
export function nextLevel(id: LevelId): LevelId {
  const i = LEVEL_IDS.indexOf(id);
  return LEVEL_IDS[Math.min(i + 1, LEVEL_IDS.length - 1)]!;
}

/** Short badge text for the library cards, e.g. "HSK 3". */
export function levelBadge(id: LevelId): string {
  const { hskCeiling } = LEVELS[id];
  return hskCeiling >= 9 ? 'HSK 6+' : `HSK ${hskCeiling}`;
}
