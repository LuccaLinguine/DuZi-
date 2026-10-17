/**
 * Simplified → Traditional conversion for display only. Every lookup key in
 * the app (word memory, HSK maps, CC-CEDICT, story tokens) stays simplified;
 * this only touches what gets rendered.
 *
 * opencc-js's conversion tables are large (the Simplified→Traditional-only
 * `cn2t` entry alone is ~1.1 MB before gzip) and most readers never touch the
 * Traditional toggle, so the converter is loaded with a dynamic import the
 * first time it is actually needed rather than bundled into the app shell.
 */

export type ScriptConverter = (s: string) => string;

let cached: Promise<ScriptConverter> | null = null;

export function loadTraditionalConverter(): Promise<ScriptConverter> {
  if (!cached) {
    cached = import('opencc-js/cn2t').then(({ Converter }) =>
      // Plain Traditional — no Taiwan/Hong Kong phrasing substitution.
      Converter({ from: 'cn', to: 't' }),
    );
  }
  return cached;
}
