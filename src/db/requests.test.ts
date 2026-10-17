import { describe, it, expect } from 'vitest';
import { newRequestRow } from './requests.ts';

describe('newRequestRow', () => {
  it('fills in sensible defaults and starts queued', () => {
    const row = newRequestRow({ level: 'elementary', topic: 'Food', format: 'story', count: 3 }, 1000);
    expect(row).toMatchObject({
      level: 'elementary',
      topic: 'Food',
      format: 'story',
      count: 3,
      seriesId: null,
      note: '',
      createdAt: 1000,
      status: 'queued',
      doneAt: null,
      fulfilledBy: [],
    });
    expect(row.id).toMatch(/^req-1000-/);
  });

  it('trims topic and note', () => {
    const row = newRequestRow({ level: 'newbie', topic: '  Travel  ', format: 'story', count: 1, note: '  more dialogue please  ' }, 1000);
    expect(row.topic).toBe('Travel');
    expect(row.note).toBe('more dialogue please');
  });

  it('clamps count to at least 1 and rounds it', () => {
    expect(newRequestRow({ level: 'newbie', topic: 'x', format: 'story', count: 0 }, 1000).count).toBe(1);
    expect(newRequestRow({ level: 'newbie', topic: 'x', format: 'story', count: -5 }, 1000).count).toBe(1);
    expect(newRequestRow({ level: 'newbie', topic: 'x', format: 'story', count: 3.7 }, 1000).count).toBe(4);
  });

  it('carries a seriesId through when given', () => {
    const row = newRequestRow({ level: 'newbie', topic: 'x', format: 'story', count: 1, seriesId: 'mystery-wang' }, 1000);
    expect(row.seriesId).toBe('mystery-wang');
  });
});
