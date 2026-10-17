/**
 * Builds word → HSK level maps from drkameleon/complete-hsk-vocabulary (MIT).
 *
 * The source tags each word with the bands it appears in: `n1`–`n7` for HSK 3.0
 * (where `n7` is the combined 7–9 band) and `o1`–`o6` for legacy HSK 2.0. A word
 * can sit in several bands; we keep the lowest, which is the level at which a
 * learner first meets it.
 *
 *   npm run data:hsk
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC =
  'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.min.json';
const OUT = resolve(import.meta.dirname, '../public/data/hsk');
const CACHE = resolve(import.meta.dirname, '../.cache/hsk.json');

interface SourceEntry {
  /** Simplified headword. */
  s: string;
  /** Level tags, e.g. ["n2", "o3"]. */
  l: string[];
}

async function fetchSource(): Promise<SourceEntry[]> {
  if (existsSync(CACHE)) {
    console.log('Using cached download (.cache/hsk.json)');
    return JSON.parse(readFileSync(CACHE, 'utf8'));
  }
  console.log(`Downloading ${SRC} …`);
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  mkdirSync(resolve(import.meta.dirname, '../.cache'), { recursive: true });
  writeFileSync(CACHE, text);
  return JSON.parse(text);
}

const source = await fetchSource();
console.log(`Read ${source.length.toLocaleString()} HSK entries`);

const hsk3: Record<string, number> = {};
const hsk2: Record<string, number> = {};

for (const entry of source) {
  if (typeof entry.s !== 'string' || !Array.isArray(entry.l)) continue;
  for (const tag of entry.l) {
    const m = /^([no])([1-9])$/.exec(tag);
    if (!m) continue; // the source also carries a "t*" variant we don't use
    const level = Number(m[2]);
    const map = m[1] === 'n' ? hsk3 : hsk2;
    const prev = map[entry.s];
    if (prev === undefined || level < prev) map[entry.s] = level;
  }
}

function sizes(map: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const level of Object.values(map)) {
    const key = String(level);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

const hsk3Sizes = sizes(hsk3);
const hsk2Sizes = sizes(hsk2);

if (Object.keys(hsk3).length < 10_000) {
  throw new Error(`Only ${Object.keys(hsk3).length} HSK 3.0 words — source format probably changed.`);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'hsk3.json'), JSON.stringify(hsk3));
writeFileSync(resolve(OUT, 'hsk2.json'), JSON.stringify(hsk2));
writeFileSync(
  resolve(OUT, 'meta.json'),
  JSON.stringify(
    {
      source: 'complete-hsk-vocabulary (drkameleon)',
      license: 'MIT',
      url: 'https://github.com/drkameleon/complete-hsk-vocabulary',
      note: 'HSK 3.0 band 7 covers the combined levels 7–9.',
      sizes: { hsk3: hsk3Sizes, hsk2: hsk2Sizes },
    },
    null,
    2,
  ),
);

const kb = (p: string) => `${(readFileSync(resolve(OUT, p)).length / 1024).toFixed(0)} KB`;
console.log(`HSK 3.0: ${Object.keys(hsk3).length.toLocaleString()} words (${kb('hsk3.json')})`);
console.log(`  per band: ${Object.entries(hsk3Sizes).map(([k, v]) => `${k}:${v}`).join('  ')}`);
console.log(`HSK 2.0: ${Object.keys(hsk2).length.toLocaleString()} words (${kb('hsk2.json')})`);
console.log(`  per band: ${Object.entries(hsk2Sizes).map(([k, v]) => `${k}:${v}`).join('  ')}`);
