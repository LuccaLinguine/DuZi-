/**
 * Checks every file in content/stories/ and regenerates content/index.json.
 *
 *   npm run validate-stories
 *
 * Exits non-zero on any error, which is what stops `npm run deploy`. Warnings
 * are printed but do not block a deploy.
 *
 * The structural rules live in src/lib/story-schema.ts so the app enforces the
 * exact same contract when it imports a story.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { pinyin } from 'pinyin-pro';
import { validateStoryShape, asStory, type Story, type StoryManifest, type StoryManifestEntry } from '../src/lib/story-schema.ts';
import { LEVELS, type LevelId } from '../src/lib/levels.ts';
import { computeInLevel, type HskMap } from '../src/lib/hsk.ts';
import { joinMismatch } from '../src/lib/segment.ts';
import { countChineseChars, isWordToken } from '../src/lib/text.ts';
import { stripTones } from '../src/lib/pinyin-tones.ts';

const ROOT = resolve(import.meta.dirname, '..');
const STORY_DIR = resolve(ROOT, 'content/stories');
const INDEX_FILE = resolve(ROOT, 'content/index.json');
const HSK_FILE = resolve(ROOT, 'public/data/hsk/hsk3.json');

/** Share of in-level tokens below which a story is rejected / warned about. */
const FAIL_BELOW_PCT = 90;
const WARN_BELOW_PCT = 95;

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

interface Report {
  file: string;
  id: string;
  errors: string[];
  warnings: string[];
  story?: Story;
  entry?: StoryManifestEntry;
}

function loadHsk(): HskMap {
  if (!existsSync(HSK_FILE)) {
    console.error(red('Missing public/data/hsk/hsk3.json — run `npm run data:hsk` first.'));
    process.exit(1);
  }
  return JSON.parse(readFileSync(HSK_FILE, 'utf8'));
}

const hsk = loadHsk();

/* ------------------------------------------------------------------ */
/* Per-file checks                                                     */
/* ------------------------------------------------------------------ */

function checkFile(file: string): Report {
  const path = resolve(STORY_DIR, file);
  const report: Report = { file, id: '', errors: [], warnings: [] };

  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    report.errors.push(`not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    return report;
  }

  const shapeIssues = validateStoryShape(data);
  if (shapeIssues.length > 0) {
    for (const i of shapeIssues) report.errors.push(`${i.path || '(root)'}: ${i.message}`);
    return report; // the checks below assume a well-formed story
  }

  const story = asStory(data);
  report.story = story;
  report.id = story.id;

  // --- id matches the filename -------------------------------------
  const stem = basename(file, '.json');
  if (story.id !== stem) {
    report.errors.push(`id "${story.id}" does not match the filename "${stem}.json"`);
  }
  if (!/^\d{8}-[a-z0-9]+-[a-z0-9-]+$/.test(stem)) {
    report.warnings.push(`filename should look like YYYYMMDD-level-slug.json, got "${stem}.json"`);
  }

  // --- tokens join back to the sentence ----------------------------
  for (const [i, s] of story.sentences.entries()) {
    const mismatch = joinMismatch(s.tokens, s.zh);
    if (mismatch) {
      report.errors.push(
        `sentences[${i}]: tokens join to "${mismatch.joined}" but zh is "${s.zh}" ` +
          `(first difference at character ${mismatch.at + 1})`,
      );
    }
  }

  // --- every real word has pinyin and a gloss ----------------------
  for (const [i, s] of story.sentences.entries()) {
    for (const [j, t] of s.tokens.entries()) {
      if (!isWordToken(t.w)) {
        if (t.py !== '' || t.gloss !== '') {
          report.warnings.push(`sentences[${i}].tokens[${j}] ("${t.w}"): punctuation should have empty py and gloss`);
        }
        continue;
      }
      if (t.py.trim() === '') report.errors.push(`sentences[${i}].tokens[${j}] ("${t.w}"): missing pinyin`);
      if (t.gloss.trim() === '') report.errors.push(`sentences[${i}].tokens[${j}] ("${t.w}"): missing gloss`);
    }
  }

  // --- pinyin cross-check against pinyin-pro (warning only) ---------
  // pinyin-pro reads the whole sentence, so 了 comes back as the particle "le"
  // rather than the citation "liǎo". Genuine context readings (不/一 sandhi,
  // polyphones) can still differ, so a disagreement is flagged for review
  // rather than failed.
  const flagged = new Map<string, { got: string; expected: string }>();
  for (const s of story.sentences) {
    // Offsets only line up when the tokens actually join, and a broken join is
    // already a hard error — skip rather than emit a cascade of false readings.
    if (joinMismatch(s.tokens, s.zh)) continue;
    const perChar = pinyin(s.zh, { type: 'all', toneType: 'symbol' });
    let offset = 0;
    for (const t of s.tokens) {
      const span = perChar.slice(offset, offset + t.w.length);
      offset += t.w.length;
      if (!isWordToken(t.w) || t.py.trim() === '' || flagged.has(t.w)) continue;
      const expected = span
        .map((c) => c.pinyin)
        .filter((x) => x !== '')
        .join(' ');
      if (expected && normalisePinyin(expected) !== normalisePinyin(t.py)) {
        flagged.set(t.w, { got: t.py, expected });
      }
    }
  }
  for (const [w, { got, expected }] of flagged) {
    report.warnings.push(
      `pinyin for "${w}" is "${got}", pinyin-pro says "${expected}" — check the context reading`,
    );
  }

  // --- HSK coverage -------------------------------------------------
  const tokens = story.sentences.flatMap((s) => s.tokens.map((t) => t.w));
  const stats = computeInLevel(tokens, story.level, hsk);
  const pct = stats.pct;

  if (pct < FAIL_BELOW_PCT) {
    report.errors.push(
      `only ${pct}% of words are within ${LEVELS[story.level].name} (HSK ${LEVELS[story.level].hskCeiling}); ` +
        `needs ${FAIL_BELOW_PCT}%. Worst offenders: ${stats.aboveLevel.slice(0, 8).map((a) => `${a.w}×${a.count}`).join(', ')}`,
    );
  } else if (pct < WARN_BELOW_PCT) {
    report.warnings.push(
      `${pct}% of words are within level (target ${WARN_BELOW_PCT}%): ` +
        stats.aboveLevel.slice(0, 8).map((a) => `${a.w}×${a.count}`).join(', '),
    );
  }

  // --- above-level words must be declared in new_words --------------
  const declared = new Set(story.new_words.map((w) => w.w));
  const undeclared = stats.aboveLevel.filter((a) => !declared.has(a.w)).map((a) => a.w);
  if (undeclared.length > 0) {
    report.warnings.push(
      `${undeclared.length} above-level word(s) missing from new_words: ${undeclared.slice(0, 10).join('、')}` +
        (undeclared.length > 10 ? ` …` : ''),
    );
  }
  const unusedNewWords = story.new_words.filter((nw) => !tokens.includes(nw.w)).map((nw) => nw.w);
  if (unusedNewWords.length > 0) {
    report.warnings.push(`new_words lists words the story never uses: ${unusedNewWords.join('、')}`);
  }

  // --- length --------------------------------------------------------
  const chars = story.sentences.reduce((n, s) => n + countChineseChars(s.zh), 0);
  const { minChars, maxChars, name } = LEVELS[story.level];
  if (chars < minChars || chars > maxChars) {
    report.warnings.push(`${chars} characters is outside the ${name} range (${minChars}–${maxChars})`);
  }

  // --- full-width punctuation ----------------------------------------
  const halfWidth = new Set<string>();
  for (const s of story.sentences) {
    for (const ch of s.zh) {
      if (',.?!:;'.includes(ch)) halfWidth.add(ch);
    }
  }
  if (halfWidth.size > 0) {
    report.warnings.push(`half-width punctuation in the Chinese text: ${[...halfWidth].join(' ')} — use ，。？！：；`);
  }

  report.entry = {
    id: story.id,
    file: `stories/${file}`,
    title_zh: story.title_zh,
    title_en: story.title_en,
    level: story.level,
    topic: story.topic,
    format: story.format,
    series_id: story.series_id,
    chapter: story.chapter,
    created_at: story.created_at,
    chars,
    in_level_pct: pct,
    hash: createHash('sha256').update(JSON.stringify(story)).digest('hex').slice(0, 16),
  };

  return report;
}

/**
 * Readings that are both standard; a disagreement between them is not worth a
 * warning. Compared after tone marks are stripped.
 */
const EQUIVALENT_READINGS: [string, string][] = [
  ['shei', 'shui'], // 谁
  ['na', 'nei'], // 那 / 哪 colloquial
];

function normalisePinyin(p: string): string {
  let out = stripTones(p).toLowerCase().replace(/\s+/g, '');
  // Erhua: pinyin-pro writes 一点儿 as "…dian er", the app writes "…diǎnr".
  out = out.replace(/er/g, 'r');
  for (const [a, b] of EQUIVALENT_READINGS) {
    out = out.replaceAll(stripTones(a).replace(/er/g, 'r'), stripTones(b).replace(/er/g, 'r'));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Cross-file checks                                                   */
/* ------------------------------------------------------------------ */

/** Character-bigram overlap, as a cheap near-duplicate detector. */
function similarity(a: string, b: string): number {
  const grams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size === 0 || gb.size === 0) return a === b ? 1 : 0;
  let shared = 0;
  for (const g of ga) if (gb.has(g)) shared++;
  return shared / Math.min(ga.size, gb.size);
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function crossCheck(reports: Report[]): void {
  const byId = new Map<string, string[]>();
  for (const r of reports) {
    if (r.story) pushTo(byId, r.story.id, r.file);
  }
  for (const [id, files] of byId) {
    if (files.length > 1) {
      for (const r of reports) {
        if (r.story?.id === id) r.errors.push(`duplicate id "${id}" — also in ${files.filter((f) => f !== r.file).join(', ')}`);
      }
    }
  }

  const withStory = reports.filter((r) => r.story);
  for (let i = 0; i < withStory.length; i++) {
    for (let j = i + 1; j < withStory.length; j++) {
      const a = withStory[i]!;
      const b = withStory[j]!;
      const sa = a.story!;
      const sb = b.story!;

      if (similarity(sa.title_zh, sb.title_zh) > 0.6) {
        a.warnings.push(`title "${sa.title_zh}" is very close to "${sb.title_zh}" (${b.file})`);
      }
      const openA = sa.sentences[0]?.zh ?? '';
      const openB = sb.sentences[0]?.zh ?? '';
      if (openA && similarity(openA, openB) > 0.6) {
        a.warnings.push(`opens almost the same as ${b.file}: "${openB}"`);
      }
    }
  }

  // Series chapters should be contiguous and have a series file.
  const seriesDir = resolve(ROOT, 'content/series');
  const bySeries = new Map<string, number[]>();
  for (const r of withStory) {
    const s = r.story!;
    if (!s.series_id) continue;
    pushTo(bySeries, s.series_id, s.chapter ?? 0);
  }
  for (const [seriesId, chapters] of bySeries) {
    if (!existsSync(resolve(seriesDir, `${seriesId}.json`))) {
      for (const r of withStory) {
        if (r.story?.series_id === seriesId) {
          r.warnings.push(`no content/series/${seriesId}.json — later chapters will drift`);
          break;
        }
      }
    }
    const sorted = [...chapters].sort((x, y) => x - y);
    const expected = sorted.map((_, i) => i + 1);
    if (sorted.join(',') !== expected.join(',')) {
      console.log(yellow(`  warn  series "${seriesId}" has chapters ${sorted.join(', ')} — expected 1…${sorted.length}`));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

if (!existsSync(STORY_DIR)) {
  console.error(red(`No ${STORY_DIR} directory.`));
  process.exit(1);
}

const files = readdirSync(STORY_DIR).filter((f) => f.endsWith('.json')).sort();

if (files.length === 0) {
  console.log(yellow('No stories in content/stories/ yet. Writing an empty manifest.'));
  writeFileSync(
    INDEX_FILE,
    `${JSON.stringify({ generated_at: new Date().toISOString(), stories: [] } satisfies StoryManifest, null, 2)}\n`,
  );
  process.exit(0);
}

const reports = files.map(checkFile);
crossCheck(reports);

/* ---- summary table ---- */

const rows = reports
  .filter((r) => r.entry)
  .map((r) => ({
    id: r.entry!.id,
    title: `${r.entry!.title_zh} / ${r.entry!.title_en}`,
    level: LEVELS[r.entry!.level as LevelId].name,
    chars: r.entry!.chars,
    pct: r.entry!.in_level_pct,
    state: r.errors.length > 0 ? red('FAIL') : r.warnings.length > 0 ? yellow('warn') : green('ok'),
  }));

if (rows.length > 0) {
  const w = {
    id: Math.max(2, ...rows.map((r) => r.id.length)),
    title: Math.max(5, ...rows.map((r) => [...r.title].length)),
    level: Math.max(5, ...rows.map((r) => r.level.length)),
  };
  const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - [...s].length));
  console.log();
  console.log(dim(`${pad('id', w.id)}  ${pad('title', w.title)}  ${pad('level', w.level)}  chars  in-lvl  state`));
  for (const r of rows) {
    console.log(
      `${pad(r.id, w.id)}  ${pad(r.title, w.title)}  ${pad(r.level, w.level)}  ` +
        `${String(r.chars).padStart(5)}  ${`${r.pct}%`.padStart(6)}  ${r.state}`,
    );
  }
}

/* ---- issues ---- */

let errorCount = 0;
let warningCount = 0;
for (const r of reports) {
  if (r.errors.length === 0 && r.warnings.length === 0) continue;
  console.log();
  console.log(`${r.file}`);
  for (const e of r.errors) {
    console.log(red(`  error  ${e}`));
    errorCount++;
  }
  for (const wn of r.warnings) {
    console.log(yellow(`  warn   ${wn}`));
    warningCount++;
  }
}

/* ---- manifest ---- */

const entries = reports.filter((r) => r.entry && r.errors.length === 0).map((r) => r.entry!);
const manifest: StoryManifest = {
  generated_at: new Date().toISOString(),
  stories: entries.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
};

if (errorCount === 0) {
  writeFileSync(INDEX_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log();
console.log(
  `${files.length} story file(s): ` +
    `${green(`${files.length - reports.filter((r) => r.errors.length > 0).length} ok`)}, ` +
    `${errorCount > 0 ? red(`${errorCount} error(s)`) : '0 errors'}, ` +
    `${warningCount > 0 ? yellow(`${warningCount} warning(s)`) : '0 warnings'}`,
);

if (errorCount > 0) {
  console.log(red('\ncontent/index.json was NOT regenerated. Fix the errors above and rerun.'));
  process.exit(1);
}

console.log(green(`Wrote content/index.json with ${manifest.stories.length} stories.`));
