# 读字 (Dúzì)

A personal, installable graded Chinese reader. Stories are written on the Mac by
Claude Code, shipped with each deploy, and read on the phone — fully offline, with
no account, no backend and no AI calls at runtime.

- **App**: Vite + React + TypeScript, Tailwind, installable PWA (Workbox).
- **Storage**: everything lives in IndexedDB on the device (Dexie).
- **Bundled data**: CC-CEDICT and the HSK 2.0/3.0 word lists, precached by the
  service worker so lookups work on a plane.

---

## First-time setup

```sh
npm install
npm run data              # downloads + converts CC-CEDICT and the HSK lists (~9 MB)
npm run validate-stories  # checks content/stories/ and writes content/index.json
npm run dev               # http://localhost:5173 and your LAN address
```

`npm run data` only has to be rerun when you want fresher dictionary data; the
output lands in `public/data/` and is gitignored. CI regenerates it on every
deploy.

### Put it on GitHub Pages

1. Create a GitHub repo named **`duzi`** and push this directory to `main`.
   (A different name is fine — the workflow derives the base path from it, but
   update the `base` fallback in `vite.config.ts` to match.)
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push. The workflow in `.github/workflows/deploy.yml` installs, builds the
   dictionary data, runs the tests, validates the stories, builds, and deploys.
4. The app lands at `https://<your-user>.github.io/duzi/`.

A PWA needs HTTPS to install, which is why `http://<mac-ip>:5173` is only good
for quick UI checks — it will not register a service worker or work offline.

---

## Installing on your phone

**iPhone (Safari).** Open the Pages URL in **Safari** — not Chrome, which cannot
install PWAs on iOS. Tap **Share** → **Add to Home Screen** → **Add**. Launch it
from the home screen icon; it opens without Safari's chrome. Open it once while
online so the service worker can precache everything, then it works offline.

**Android (Chrome).** Open the Pages URL, tap **⋮** → **Install app** (or
**Add to Home screen**) → **Install**.

On first launch the app asks the browser for persistent storage so your words and
progress are not evicted. Safari grants this once the app is on the home screen.

---

## The weekly routine

```
phone:  Requests → queue what you want → Export profile
        AirDrop / iCloud the file to the Mac
mac:    drop it in content/profile/learner-profile.json
        /stories            (in Claude Code — writes and validates the batch)
        npm run deploy      (validates, builds, pushes; Pages does the rest)
phone:  open the app online once → "5 new stories" → read offline
```

`npm run deploy` refuses to publish if any story fails validation, and refuses if
you have uncommitted changes outside `content/`.

---

## Writing stories

`CONTENT.md` is the complete guide: the writing rules, the level table, the JSON
schema, the tokenising and pinyin conventions, and what the validator checks. The
`/stories` slash command reads it and does the work.

```sh
npm run validate-stories
```

Errors block a deploy: bad JSON, a missing field, an `id` that does not match its
filename, tokens that do not join back to the sentence, a word with no pinyin or
gloss, or under 90% of words within the level's HSK ceiling. Warnings (pinyin
that disagrees with pinyin-pro, length outside the level band, near-duplicate
titles, undeclared above-level words) are printed but do not block.

**Never change a story's `id` once it has shipped** — reading progress, ratings
and word history are keyed on it. Edit the file and keep the id; the app replaces
the content and keeps all progress.

---

## Layout

```
content/
  stories/        one JSON file per story, YYYYMMDD-level-slug.json
  series/         per-series title, level and running chapter summary
  profile/        learner-profile.json exported from the phone (gitignored)
  index.json      generated manifest the app syncs against
scripts/
  build-cedict.ts    CC-CEDICT  → public/data/cedict/*.json (64 shards)
  build-hsk.ts       HSK lists  → public/data/hsk/*.json
  build-content.ts   content/   → public/content/ (staged for the build)
  validate-stories.ts
  build-icons.ts     public/icons/*.svg → the manifest's PNGs
  deploy.ts
src/
  db/             Dexie schema and row types — the only code touching IndexedDB
  lib/            dictionary, HSK, segmentation, content sync, story schema
  screens/        one file per tab
  components/
```

The story schema and its validation live in `src/lib/story-schema.ts` and are
shared by the app and the validator, so a story that validates is a story the app
will accept.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on localhost and your LAN address (no offline) |
| `npm run build` | Validates stories, stages content, typechecks, builds |
| `npm test` | Unit tests (Vitest) |
| `npm run data` | Rebuilds the bundled dictionary and HSK data |
| `npm run validate-stories` | Checks `content/stories/`, regenerates the manifest |
| `npm run deploy` | Validate → build → commit content → push |

## Attribution

- **CC-CEDICT** — Chinese–English dictionary, CC BY-SA 4.0,
  [mdbg.net](https://www.mdbg.net/chinese/dictionary?page=cc-cedict).
- **HSK 2.0 / 3.0 word lists** — MIT,
  [drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary).

Both are credited on the app's About screen, as their licences require.

---

## Build phases

- [x] **1 — Scaffold, data, content pipeline.** Vite/React/TS/Tailwind/PWA, the
  CC-CEDICT and HSK build scripts, the Dexie schema, the tab shell, the story
  schema, `validate-stories`, `CONTENT.md`, `/stories`, and 3 sample stories.
- [ ] **2 — Reader + word memory.** Ruby pinyin, Smart pinyin mode, the word
  bottom sheet, translations, onboarding.
- [ ] **3 — Audio.** Sentence-by-sentence TTS with highlighting and a player bar.
- [ ] **4 — Library + content sync.** Story cards, filters, the Requests screen,
  profile export.
- [ ] **5 — Flashcards.** Saved words and FSRS reviews.
- [ ] **6 — Import text, stats, series, export/import** and the final polish pass.
