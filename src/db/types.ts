/** Row shapes for the IndexedDB tables. Everything the user owns lives here. */
import type { LevelId } from '../lib/levels.ts';
import type { Story, StoryFormat } from '../lib/story-schema.ts';
import type { Card, ReviewLog } from 'ts-fsrs';

/* ---------------- stories ---------------- */

/** A story as stored on the device: the authored JSON plus sync bookkeeping. */
export interface StoryRow {
  id: string;
  /** The full authored story, verbatim. */
  story: Story;
  level: LevelId;
  topic: string;
  format: StoryFormat;
  series_id: string | null;
  chapter: number | null;
  created_at: string;
  title_zh: string;
  title_en: string;
  chars: number;
  in_level_pct: number;
  /** Content hash from the manifest; a change triggers re-import. */
  hash: string;
  /** When this device imported it. */
  imported_at: number;
  /** Where it came from — bundled with a deploy, pasted, or hand-imported. */
  source: 'bundled' | 'imported' | 'pasted';
  /**
   * Set when a bundled story disappears from the manifest. The row (and all
   * progress against it) is kept; the library just hides it. Driven entirely
   * by content sync — never set this by hand, see `userRemoved` for that.
   */
  hidden?: boolean;
  /**
   * Set by swiping a card away in the Library (spec §7). Independent of
   * `hidden`: a bundled story stays in every future manifest, so if removal
   * also flipped `hidden`, the next sync would "restore" it right back.
   */
  userRemoved?: boolean;
}

/** Per-story reading progress; never deleted by a content sync. */
export interface ProgressRow {
  storyId: string;
  read: boolean;
  readAt: number | null;
  /** Index of the last sentence the reader was on. */
  lastSentence: number;
  scrollY: number;
  rating: 'up' | 'down' | null;
  openedAt: number | null;
  /** Words tapped during the current read, used when marking the story read. */
  tappedThisRead: string[];
}

/* ---------------- word memory (spec §5a) ---------------- */

export type WordStatus = 'new' | 'learning' | 'known' | 'ignored';

export interface WordRow {
  /** The word itself — primary key. */
  w: string;
  status: WordStatus;
  timesSeen: number;
  timesLookedUp: number;
  /** Consecutive stories seen in without a single lookup. */
  seenWithoutLookup: number;
  firstSeen: number;
  lastSeen: number;
  lastLookedUp: number | null;
  /** Flashcard id, when this word has been saved for review. */
  cardId: string | null;
}

/* ---------------- flashcards ---------------- */

export interface CardRow {
  /** Same string as the word — one card per saved word. */
  id: string;
  w: string;
  py: string;
  gloss: string;
  /** The sentence the word was saved from, as its example. */
  exampleZh: string;
  exampleEn: string;
  /** Story the example came from. */
  storyId: string | null;
  createdAt: number;
  /** ts-fsrs state. `due` is mirrored into an index for the due-count badge. */
  fsrs: Card;
  due: number;
  suspended?: boolean;
}

export interface ReviewLogRow {
  id?: number;
  cardId: string;
  at: number;
  log: ReviewLog;
}

/* ---------------- history & stats ---------------- */

/** One row per day, so streaks and the 30-day chart are a single index scan. */
/**
 * Review activity per local day, for the streak and the stats screen.
 * Characters/stories read are deliberately not duplicated here — `reads`
 * already has `at` and `chars` per finished story, so the daily reading
 * stats are aggregated from that table instead of a second counter that
 * nothing would keep in sync with it.
 */
export interface DayRow {
  /** YYYY-MM-DD in the device's local time. */
  date: string;
  reviews: number;
  wordsLearned: number;
}

/** A single finished read, for "stories read" and topic ratings. */
export interface ReadEventRow {
  id?: number;
  storyId: string;
  at: number;
  chars: number;
  topic: string;
  level: LevelId;
}

/* ---------------- requests (spec §4) ---------------- */

export interface RequestRow {
  id: string;
  level: LevelId;
  topic: string;
  format: StoryFormat;
  count: number;
  /** Series to continue, when this is a "next chapter" request. */
  seriesId: string | null;
  note: string;
  createdAt: number;
  status: 'queued' | 'done';
  doneAt: number | null;
  /** Story ids that satisfied this request. */
  fulfilledBy: string[];
}

/* ---------------- pasted text (spec §8) ---------------- */

export interface PastedTextRow {
  id: string;
  title: string;
  raw: string;
  createdAt: number;
  /** Queued to be turned into a full graded story on the next batch. */
  enrich: boolean;
  /** Set once a `/stories` run has replaced it with an authored version. */
  enrichedAt: number | null;
}

/* ---------------- series ---------------- */

export interface SeriesRow {
  id: string;
  title_zh: string;
  title_en: string;
  level: LevelId;
  summary_en: string;
  chapters: number;
}

/* ---------------- settings ---------------- */

export type PinyinMode = 'smart' | 'all' | 'above' | 'off';
export type ThemeMode = 'system' | 'light' | 'dark' | 'sepia';
export type Script = 'simplified' | 'traditional';
export type CardMode = 'hanzi-meaning' | 'meaning-hanzi' | 'audio-meaning';

export interface Settings {
  /** Bumped by migrations; not user-facing. */
  schema: number;
  defaultLevel: LevelId;
  pinyinMode: PinyinMode;
  fontSize: number;
  script: Script;
  theme: ThemeMode;
  /** Dotted underline on words above the story's level. */
  highlightAboveLevel: boolean;
  /** Faint per-status colour cue in the reader (§5a, off by default). */
  showStatusColors: boolean;
  /** Colour words by grammatical function in the reader, off by default. */
  showPosColors: boolean;
  /** Global "Show translation" toggle — every sentence's English inline. */
  showTranslations: boolean;

  /* word memory thresholds (§5a) */
  /** Stories seen without a lookup before a word graduates to `known`. */
  graduateAfterStories: number;
  /** FSRS stability in days at which a saved word graduates to `known`. */
  graduateAtStabilityDays: number;

  /* audio */
  voiceURI: string | null;
  speechRate: number;

  /* review */
  cardModes: CardMode[];
  newCardsPerDay: number;

  /* housekeeping */
  onboarded: boolean;
  lastBackupAt: number | null;
  lastSyncAt: number | null;
  /** Manifest hash set the app last imported, to skip no-op syncs. */
  lastManifestAt: string | null;
}
