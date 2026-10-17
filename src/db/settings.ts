import type { Settings } from './types.ts';

export const SETTINGS_KEY = 'app';

export const DEFAULT_SETTINGS: Settings = {
  schema: 1,
  defaultLevel: 'newbie',
  pinyinMode: 'smart',
  fontSize: 22,
  script: 'simplified',
  theme: 'system',
  highlightAboveLevel: true,
  showStatusColors: false,

  graduateAfterStories: 3,
  graduateAtStabilityDays: 21,

  voiceURI: null,
  speechRate: 1,

  cardModes: ['hanzi-meaning'],
  newCardsPerDay: 10,

  onboarded: false,
  lastBackupAt: null,
  lastSyncAt: null,
  lastManifestAt: null,
};
