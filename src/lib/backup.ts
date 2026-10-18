/**
 * Full-device backup (spec section 10: "Export all data / Import all data").
 * Everything the app owns lives only on this device — there's no sync — so
 * this is the one way to move it, or recover from a lost/replaced phone.
 *
 * The shape check here is deliberately light (not the full per-row schema
 * validation story-schema.ts does for authored content): a backup is this
 * app's own output, not third-party content, so the bar is "is this
 * structurally a backup file", not "is every row perfectly formed".
 */
import type {
  CardRow,
  DayRow,
  PastedTextRow,
  ProgressRow,
  ReadEventRow,
  RequestRow,
  ReviewLogRow,
  SeriesRow,
  Settings,
  StoryRow,
  WordRow,
} from '../db/types.ts';

export const BACKUP_VERSION = 1;

export interface BackupTables {
  stories: StoryRow[];
  progress: ProgressRow[];
  words: WordRow[];
  cards: CardRow[];
  reviewLog: ReviewLogRow[];
  days: DayRow[];
  reads: ReadEventRow[];
  requests: RequestRow[];
  texts: PastedTextRow[];
  series: SeriesRow[];
  settings: Settings;
}

export interface BackupFile {
  app: 'duzi';
  version: number;
  exportedAt: string;
  tables: BackupTables;
}

export function buildBackup(tables: BackupTables, now: number): BackupFile {
  return { app: 'duzi', version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), tables };
}

const TABLE_KEYS: (keyof BackupTables)[] = [
  'stories', 'progress', 'words', 'cards', 'reviewLog', 'days', 'reads', 'requests', 'texts', 'series', 'settings',
];

export interface BackupCheck {
  valid: boolean;
  issues: string[];
}

/** Structural check before a restore is attempted — garbage in must not corrupt the database. */
export function checkBackup(data: unknown): BackupCheck {
  const issues: string[] = [];
  if (typeof data !== 'object' || data === null) {
    return { valid: false, issues: ['not a JSON object'] };
  }
  const d = data as Record<string, unknown>;
  if (d.app !== 'duzi') issues.push('not a 读字 backup file (missing "app": "duzi")');
  if (typeof d.version !== 'number') issues.push('missing or invalid "version"');
  if (typeof d.tables !== 'object' || d.tables === null) {
    issues.push('missing "tables"');
    return { valid: false, issues };
  }
  const tables = d.tables as Record<string, unknown>;
  for (const key of TABLE_KEYS) {
    if (!(key in tables)) issues.push(`tables.${key} is missing`);
  }
  for (const key of TABLE_KEYS) {
    if (key === 'settings') continue;
    if (key in tables && !Array.isArray(tables[key])) issues.push(`tables.${key} should be an array`);
  }
  return { valid: issues.length === 0, issues };
}
