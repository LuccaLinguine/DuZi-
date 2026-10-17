/**
 * Stages content/ into public/content/ so Vite ships it and the service worker
 * precaches it. Runs automatically before `npm run dev` and `npm run build`.
 *
 * public/content/ is generated — it is gitignored and wiped on every run.
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'content');
const OUT = resolve(ROOT, 'public/content');

if (!existsSync(resolve(SRC, 'index.json'))) {
  console.error('No content/index.json — run `npm run validate-stories` first.');
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(resolve(OUT, 'stories'), { recursive: true });

cpSync(resolve(SRC, 'index.json'), resolve(OUT, 'index.json'));
cpSync(resolve(SRC, 'stories'), resolve(OUT, 'stories'), { recursive: true });
if (existsSync(resolve(SRC, 'series'))) {
  cpSync(resolve(SRC, 'series'), resolve(OUT, 'series'), { recursive: true });
}

const manifest = JSON.parse(readFileSync(resolve(OUT, 'index.json'), 'utf8'));
const bytes = readdirSync(resolve(OUT, 'stories')).reduce(
  (n, f) => n + statSync(resolve(OUT, 'stories', f)).size,
  0,
);
console.log(
  `Staged ${manifest.stories.length} stories into public/content/ (${(bytes / 1024).toFixed(0)} KB)`,
);
