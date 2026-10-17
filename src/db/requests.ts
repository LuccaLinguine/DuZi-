import { db } from './index.ts';
import type { LevelId } from '../lib/levels.ts';
import type { StoryFormat } from '../lib/story-schema.ts';
import type { RequestRow } from './types.ts';

export interface NewRequestInput {
  level: LevelId;
  topic: string;
  format: StoryFormat;
  count: number;
  seriesId?: string | null;
  note?: string;
}

export function newRequestRow(input: NewRequestInput, now: number): RequestRow {
  return {
    id: `req-${now}-${Math.random().toString(36).slice(2, 8)}`,
    level: input.level,
    topic: input.topic.trim(),
    format: input.format,
    count: Math.max(1, Math.round(input.count)),
    seriesId: input.seriesId ?? null,
    note: input.note?.trim() ?? '',
    createdAt: now,
    status: 'queued',
    doneAt: null,
    fulfilledBy: [],
  };
}

export async function addRequest(input: NewRequestInput): Promise<RequestRow> {
  const row = newRequestRow(input, Date.now());
  await db.requests.add(row);
  return row;
}

/** Edit a queued request in place — keeps its id, createdAt and progress. */
export async function updateRequest(id: string, input: NewRequestInput): Promise<void> {
  await db.requests.update(id, {
    level: input.level,
    topic: input.topic.trim(),
    format: input.format,
    count: Math.max(1, Math.round(input.count)),
    seriesId: input.seriesId ?? null,
    note: input.note?.trim() ?? '',
  });
}

export async function deleteRequest(id: string): Promise<void> {
  await db.requests.delete(id);
}
