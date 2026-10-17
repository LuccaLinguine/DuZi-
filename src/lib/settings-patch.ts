/**
 * The merge rule behind `useSettings`'s `update()` — pulled out as a pure
 * function so the "two updates fired before a re-render" correctness
 * property is unit tested without mounting a component.
 */
import type { Settings } from '../db/types.ts';

export type SettingsPatch = Partial<Settings> | ((prev: Settings) => Partial<Settings>);

export interface ResolvedUpdate {
  /** Just the fields that changed — what gets written to IndexedDB. */
  resolved: Partial<Settings>;
  /** The full settings object after merging — what React state becomes. */
  next: Settings;
}

export function resolveSettingsPatch(prev: Settings, patch: SettingsPatch): ResolvedUpdate {
  const resolved = typeof patch === 'function' ? patch(prev) : patch;
  return { resolved, next: { ...prev, ...resolved } };
}
