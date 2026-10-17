import { describe, it, expect } from 'vitest';
import { requestMatchesStory, applyRequestFulfillment, type StoryMatchInfo } from './request-match.ts';
import type { RequestRow } from '../db/types.ts';

function request(overrides: Partial<RequestRow> = {}): RequestRow {
  return {
    id: 'req-1',
    level: 'elementary',
    topic: 'Food',
    format: 'story',
    count: 2,
    seriesId: null,
    note: '',
    createdAt: 0,
    status: 'queued',
    doneAt: null,
    fulfilledBy: [],
    ...overrides,
  };
}

function story(overrides: Partial<StoryMatchInfo> = {}): StoryMatchInfo {
  return {
    id: 's1',
    level: 'elementary',
    topic: 'Food',
    format: 'story',
    series_id: null,
    ...overrides,
  };
}

describe('requestMatchesStory', () => {
  it('matches on level, format and topic', () => {
    expect(requestMatchesStory(request(), story())).toBe(true);
  });

  it('rejects a different level', () => {
    expect(requestMatchesStory(request(), story({ level: 'advanced' }))).toBe(false);
  });

  it('rejects a different format', () => {
    expect(requestMatchesStory(request({ format: 'dialogue' }), story({ format: 'story' }))).toBe(false);
  });

  it('is case- and whitespace-insensitive on topic', () => {
    expect(requestMatchesStory(request({ topic: ' food ' }), story({ topic: 'FOOD' }))).toBe(true);
  });

  it('rejects an unrelated topic', () => {
    expect(requestMatchesStory(request({ topic: 'Food' }), story({ topic: 'Travel' }))).toBe(false);
  });

  it('matches a series-continuation request on series_id alone, ignoring topic/format', () => {
    const req = request({ seriesId: 'mystery-wang', topic: 'anything', format: 'article' });
    expect(requestMatchesStory(req, story({ series_id: 'mystery-wang', topic: 'nope', format: 'story' }))).toBe(
      true,
    );
  });

  it('rejects a series request against a different series', () => {
    const req = request({ seriesId: 'mystery-wang' });
    expect(requestMatchesStory(req, story({ series_id: 'other-series' }))).toBe(false);
  });

  it('rejects a series request against a non-series story', () => {
    const req = request({ seriesId: 'mystery-wang' });
    expect(requestMatchesStory(req, story({ series_id: null }))).toBe(false);
  });
});

describe('applyRequestFulfillment', () => {
  it('leaves non-matching requests untouched, by reference', () => {
    const requests = [request({ topic: 'Travel' })];
    const result = applyRequestFulfillment(requests, [story({ topic: 'Food' })], 100);
    expect(result[0]).toBe(requests[0]);
  });

  it('collects a matching story without finishing the count', () => {
    const requests = [request({ count: 2 })];
    const result = applyRequestFulfillment(requests, [story({ id: 'a' })], 100);
    expect(result[0]!.fulfilledBy).toEqual(['a']);
    expect(result[0]!.status).toBe('queued');
    expect(result[0]!.doneAt).toBeNull();
  });

  it('marks done once the count is reached', () => {
    const requests = [request({ count: 2, fulfilledBy: ['a'] })];
    const result = applyRequestFulfillment(requests, [story({ id: 'b' })], 100);
    expect(result[0]!.fulfilledBy).toEqual(['a', 'b']);
    expect(result[0]!.status).toBe('done');
    expect(result[0]!.doneAt).toBe(100);
  });

  it('never double-counts a story id already recorded', () => {
    const requests = [request({ count: 2, fulfilledBy: ['a'] })];
    const result = applyRequestFulfillment(requests, [story({ id: 'a' })], 100);
    expect(result[0]).toBe(requests[0]); // nothing new — same reference
  });

  it('does not touch an already-done request', () => {
    const requests = [request({ status: 'done', fulfilledBy: ['a', 'b'], doneAt: 50 })];
    const result = applyRequestFulfillment(requests, [story({ id: 'c' })], 100);
    expect(result[0]).toBe(requests[0]);
  });

  it('can satisfy several requests from one batch of stories', () => {
    const requests = [request({ id: 'r1', topic: 'Food', count: 1 }), request({ id: 'r2', topic: 'Travel', count: 1 })];
    const result = applyRequestFulfillment(
      requests,
      [story({ id: 'a', topic: 'Food' }), story({ id: 'b', topic: 'Travel' })],
      100,
    );
    expect(result[0]!.status).toBe('done');
    expect(result[1]!.status).toBe('done');
  });
});
