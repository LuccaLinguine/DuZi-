/**
 * Does a newly-synced story satisfy a queued request? (spec section 4,
 * "Requests are marked done automatically once matching stories arrive.")
 *
 * A series-continuation request matches on `series_id` alone — that's
 * authoritative. An ordinary request matches on level, format and topic;
 * topic comparison is case/whitespace-insensitive since a batch's topic
 * string and a request's quick-pick chip won't always agree on capitalisation.
 */
import type { LevelId } from './levels.ts';
import type { StoryFormat } from './story-schema.ts';
import type { RequestRow } from '../db/types.ts';

export interface StoryMatchInfo {
  id: string;
  level: LevelId;
  topic: string;
  format: StoryFormat;
  series_id: string | null;
}

function normTopic(s: string): string {
  return s.trim().toLowerCase();
}

export function requestMatchesStory(request: RequestRow, story: StoryMatchInfo): boolean {
  if (story.level !== request.level) return false;
  if (request.seriesId) return story.series_id === request.seriesId;
  return story.format === request.format && normTopic(story.topic) === normTopic(request.topic);
}

/**
 * Folds a batch of newly-synced stories into the queue: each queued request
 * collects any matching story ids it doesn't already have, and flips to
 * `done` once it has as many as it asked for. Rows with nothing new are
 * returned by the same reference, so a caller can tell what changed with a
 * cheap identity check rather than a deep diff.
 */
export function applyRequestFulfillment(
  requests: readonly RequestRow[],
  newStories: readonly StoryMatchInfo[],
  now: number,
): RequestRow[] {
  return requests.map((req) => {
    if (req.status === 'done') return req;

    const newlyFulfilled = newStories.filter(
      (s) => !req.fulfilledBy.includes(s.id) && requestMatchesStory(req, s),
    );
    if (newlyFulfilled.length === 0) return req;

    const fulfilledBy = [...req.fulfilledBy, ...newlyFulfilled.map((s) => s.id)];
    const done = fulfilledBy.length >= req.count;
    return {
      ...req,
      fulfilledBy,
      status: done ? 'done' : req.status,
      doneAt: done ? now : req.doneAt,
    };
  });
}
