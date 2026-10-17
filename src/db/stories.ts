import { db } from './index.ts';

/** Swipe-to-delete (spec §7). Independent of the sync-driven `hidden` flag. */
export async function removeStory(id: string): Promise<void> {
  await db.stories.update(id, { userRemoved: true });
}

export async function restoreStory(id: string): Promise<void> {
  await db.stories.update(id, { userRemoved: false });
}
