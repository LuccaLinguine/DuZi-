import { describe, it, expect } from 'vitest';
import { buildBackup, checkBackup, BACKUP_VERSION, type BackupTables } from './backup.ts';
import { DEFAULT_SETTINGS } from '../db/settings.ts';

const EMPTY_TABLES: BackupTables = {
  stories: [], progress: [], words: [], cards: [], reviewLog: [], days: [],
  reads: [], requests: [], texts: [], series: [], settings: DEFAULT_SETTINGS,
};

describe('buildBackup', () => {
  it('stamps the app id, version and export time', () => {
    // A fixed UTC instant, not a local-midnight Date — exportedAt is
    // toISOString() (always UTC), so a local-time input would make this
    // test's expectation timezone-dependent.
    const instant = Date.UTC(2026, 9, 18, 12, 0, 0);
    const file = buildBackup(EMPTY_TABLES, instant);
    expect(file.app).toBe('duzi');
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.exportedAt).toBe('2026-10-18T12:00:00.000Z');
    expect(file.tables).toBe(EMPTY_TABLES);
  });
});

describe('checkBackup', () => {
  it('accepts a well-formed backup', () => {
    const file = buildBackup(EMPTY_TABLES, Date.now());
    expect(checkBackup(file)).toEqual({ valid: true, issues: [] });
  });

  it('rejects a plain non-object', () => {
    expect(checkBackup(null).valid).toBe(false);
    expect(checkBackup('hello').valid).toBe(false);
    expect(checkBackup(42).valid).toBe(false);
  });

  it('rejects a file from a different app', () => {
    const result = checkBackup({ app: 'other-app', version: 1, tables: {} });
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatch(/not a 读字 backup/);
  });

  it('rejects a missing version', () => {
    const result = checkBackup({ app: 'duzi', tables: {} });
    expect(result.valid).toBe(false);
  });

  it('rejects missing tables entirely', () => {
    const result = checkBackup({ app: 'duzi', version: 1 });
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('missing "tables"');
  });

  it('reports each missing table by name', () => {
    const result = checkBackup({ app: 'duzi', version: 1, tables: { stories: [] } });
    expect(result.issues).toContain('tables.words is missing');
    expect(result.issues).toContain('tables.settings is missing');
  });

  it('rejects a table that is not an array', () => {
    const file = buildBackup(EMPTY_TABLES, Date.now());
    const bad = { ...file, tables: { ...file.tables, stories: 'not an array' } };
    const result = checkBackup(bad);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('tables.stories should be an array');
  });

  it('does not require settings to be an array', () => {
    const file = buildBackup(EMPTY_TABLES, Date.now());
    expect(checkBackup(file).issues).not.toContain('tables.settings should be an array');
  });
});
