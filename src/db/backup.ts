import { db } from './index.ts';
import { SETTINGS_KEY } from './settings.ts';
import { buildBackup, checkBackup, type BackupFile } from '../lib/backup.ts';

export async function gatherBackup(): Promise<BackupFile> {
  const [stories, progress, words, cards, reviewLog, days, reads, requests, texts, series, settings] =
    await Promise.all([
      db.stories.toArray(),
      db.progress.toArray(),
      db.words.toArray(),
      db.cards.toArray(),
      db.reviewLog.toArray(),
      db.days.toArray(),
      db.reads.toArray(),
      db.requests.toArray(),
      db.texts.toArray(),
      db.series.toArray(),
      db.getSettings(),
    ]);

  return buildBackup(
    { stories, progress, words, cards, reviewLog, days, reads, requests, texts, series, settings },
    Date.now(),
  );
}

export class BackupInvalid extends Error {
  constructor(readonly issues: string[]) {
    super(`Not a valid backup file: ${issues.join('; ')}`);
    this.name = 'BackupInvalid';
  }
}

/**
 * Replaces every table wholesale with the backup's contents — this is a
 * restore, not a merge, so a row deleted since the backup was taken must not
 * linger. The whole operation is one transaction: a restore that fails
 * partway must not leave the device in a state that's neither the old data
 * nor the new.
 */
export async function restoreBackup(data: unknown): Promise<void> {
  const check = checkBackup(data);
  if (!check.valid) throw new BackupInvalid(check.issues);
  const file = data as BackupFile;
  const t = file.tables;

  await db.transaction(
    'rw',
    [db.stories, db.progress, db.words, db.cards, db.reviewLog, db.days, db.reads, db.requests, db.texts, db.series, db.settings],
    async () => {
      await Promise.all([
        db.stories.clear(),
        db.progress.clear(),
        db.words.clear(),
        db.cards.clear(),
        db.reviewLog.clear(),
        db.days.clear(),
        db.reads.clear(),
        db.requests.clear(),
        db.texts.clear(),
        db.series.clear(),
      ]);
      await Promise.all([
        db.stories.bulkAdd(t.stories),
        db.progress.bulkAdd(t.progress),
        db.words.bulkAdd(t.words),
        db.cards.bulkAdd(t.cards),
        db.reviewLog.bulkAdd(t.reviewLog),
        db.days.bulkAdd(t.days),
        db.reads.bulkAdd(t.reads),
        db.requests.bulkAdd(t.requests),
        db.texts.bulkAdd(t.texts),
        db.series.bulkAdd(t.series),
      ]);
      await db.settings.put({ key: SETTINGS_KEY, value: t.settings });
    },
  );
}
