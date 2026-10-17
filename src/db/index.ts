/**
 * The one Dexie database. Nothing above this layer touches IndexedDB directly.
 *
 * Schema changes go in a new `.version()` block — never edit an existing one,
 * or an installed app will fail to open.
 */
import Dexie, { type EntityTable } from 'dexie';
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
} from './types.ts';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from './settings.ts';

/** Settings are a single row in a kv table, so they can be read in one get. */
interface SettingsRow {
  key: string;
  value: Settings;
}

export class DuziDB extends Dexie {
  stories!: EntityTable<StoryRow, 'id'>;
  progress!: EntityTable<ProgressRow, 'storyId'>;
  words!: EntityTable<WordRow, 'w'>;
  cards!: EntityTable<CardRow, 'id'>;
  reviewLog!: EntityTable<ReviewLogRow, 'id'>;
  days!: EntityTable<DayRow, 'date'>;
  reads!: EntityTable<ReadEventRow, 'id'>;
  requests!: EntityTable<RequestRow, 'id'>;
  texts!: EntityTable<PastedTextRow, 'id'>;
  series!: EntityTable<SeriesRow, 'id'>;
  settings!: EntityTable<SettingsRow, 'key'>;

  constructor(name = 'duzi') {
    super(name);
    this.version(1).stores({
      stories: 'id, level, topic, series_id, created_at, hidden, source',
      progress: 'storyId, read, readAt',
      words: 'w, status, lastSeen, lastLookedUp, cardId',
      cards: 'id, w, due, createdAt, suspended',
      reviewLog: '++id, cardId, at',
      days: 'date',
      reads: '++id, storyId, at, topic, level',
      requests: 'id, status, createdAt, level',
      texts: 'id, createdAt, enrich',
      series: 'id, level',
      settings: 'key',
    });
  }

  async getSettings(): Promise<Settings> {
    const row = await this.settings.get(SETTINGS_KEY);
    // Merge over the defaults so a new setting added in a later release has a
    // value on devices that stored the older shape.
    return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
  }

  async putSettings(patch: Partial<Settings>): Promise<Settings> {
    // Read-modify-write, wrapped in a transaction so two concurrent callers
    // (e.g. a user's settings change racing the content sync's background
    // `lastSyncAt` write) serialize instead of one silently clobbering the
    // other's change — IndexedDB queues readwrite transactions on the same
    // store rather than interleaving them.
    return this.transaction('rw', this.settings, async () => {
      const next = { ...(await this.getSettings()), ...patch };
      await this.settings.put({ key: SETTINGS_KEY, value: next });
      return next;
    });
  }
}

export const db = new DuziDB();

/**
 * Ask the browser not to evict our data. Safari grants this once the app is
 * installed to the home screen; Chrome grants it based on engagement. Either
 * way it is safe to call on every launch.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export type { Settings };
