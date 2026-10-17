# Build spec: graded Chinese reader PWA (personal use)

You are building a personal, installable Progressive Web App for learning to read Mandarin Chinese through graded stories. It must work on both iPhone (Safari, "Add to Home Screen") and Android (Chrome, "Install app"), and work **100% offline**. There is no API key and no AI call anywhere in the app.

Stories are written in batches **by you (Claude Code) on my Mac**, saved as JSON files in this repo, and shipped to my phone with each deploy. You are both the developer of the app and its story writer: section 4 defines the content pipeline you'll use whenever I ask for new stories.

Work in the phases listed at the bottom. After each phase, stop, summarize what works, tell me how to test it, and wait for me before continuing. Ask me before adding any dependency not listed here.

Feel free to use any third-party brand names, logos, or copyrighted story content as its for personal use. The app name is **读字 (Dúzì)** unless I change it.

---

## 1. Tech stack

- **Vite + React + TypeScript**, mobile-first.
- **Tailwind CSS** for styling.
- **vite-plugin-pwa** (Workbox) for the service worker, manifest, and offline precaching of the app shell and all bundled data.
- **Dexie** (IndexedDB) for all user data: stories, saved words, review state, reading history, and settings.
- **pinyin-pro** for pinyin generation and fallback segmentation of pasted text.
- **opencc-js** for the simplified/traditional toggle.
- **ts-fsrs** for spaced-repetition scheduling.
- **Web Speech API** (`speechSynthesis`, zh-CN voice) for audio. No paid TTS in v1.
- No backend. No accounts. Everything lives on the device.

Call `navigator.storage.persist()` on first launch so the browser doesn't evict data.

## 2. Bundled data (preprocess at build time)

Write Node scripts in `/scripts` that download and convert data into compact JSON in `/public/data`, precached by the service worker:

1. **CC-CEDICT** (from mdbg.net, CC BY-SA 4.0). Parse into a map keyed by simplified headword with: traditional form, numbered pinyin converted to tone-marked pinyin, and definitions. Split into chunks or gzip it so first load stays reasonable. Show the attribution on the About screen.
2. **HSK word lists** (HSK 3.0 levels 1–9 and legacy HSK 2.0 levels 1–6). Find an openly licensed source on GitHub (for example `drkameleon/complete-hsk-vocabulary`), verify its license, and produce `word → level` maps.

## 3. Levels

Six reading levels, each mapped to a vocabulary ceiling:

| Level | Vocab ceiling | Story length (characters) |
|---|---|---|
| Newbie | HSK 1 | 80–150 |
| Elementary | HSK 2 | 150–300 |
| Intermediate | HSK 3 | 300–500 |
| Upper Intermediate | HSK 4 | 500–800 |
| Advanced | HSK 5 | 800–1200 |
| Master | HSK 6+ | 1200–2000 |

## 4. Story content pipeline (batch-written by Claude Code)

### How it works end to end
1. **On the phone**, I use the Requests screen (below) to queue what I want, then tap **Export profile**. This saves `learner-profile.json`, which I send to my Mac (AirDrop, iCloud Drive, etc.).
2. **On the Mac**, I drop the file into `content/profile/` and run the `/stories` command in Claude Code (or just ask for stories in plain words).
3. **You write the stories** as JSON files in `content/stories/`, following the writing rules and schema below, then run `npm run validate-stories` and fix anything it flags.
4. I run `npm run deploy` (or push), the app updates, and the new stories appear in my library the next time I open the app online. After that they're available offline.

### Repo files to create for the pipeline
- **`CONTENT.md`**: the full writing guide (the writing rules + schema below), so future Claude Code sessions follow it without needing this spec.
- **A Claude Code project slash command `/stories`** (in `.claude/commands/` or as a project skill, whichever the installed Claude Code version supports): reads `CONTENT.md` and the latest profile, writes the requested stories, validates them, and reports a summary (titles, levels, % in level, new words introduced). If no profile or requests exist, it asks me what to write.
- **`content/stories/`**: one JSON file per story, named `YYYYMMDD-level-slug.json`. Each story has a stable `id` (never changes once written, so reading progress survives redeploys).
- **`content/series/`**: a small JSON file per series with its title, level, and a running chapter-by-chapter summary, which you update after writing each chapter so later chapters stay consistent.
- **`content/profile/`**: where I drop `learner-profile.json` (gitignored).

### `learner-profile.json` (exported by the app)
Contains: my current level; my `learning` words (with lookup counts and last seen), so you can reuse them; a count of `known` words per HSK level; titles and topics of stories I've already read (to avoid repetition); my average rating per topic; pasted texts I've asked to have enriched (see section 8); and my queued requests.

### Requests screen (replaces an in-app Generate screen)
- Add a request: level, topic (free-text plus quick-pick chips: Daily life, Food, Travel, Work, Romance, Mystery, Funny, History, Culture, Folk tale, News-style), format (Story, Dialogue, Article), how many, and an optional "continue series" pick.
- A list of queued requests, editable and deletable, and an **Export profile** button. Requests are marked done automatically once matching stories arrive.
- After reading a story, a quick 👍/👎 so you learn which topics I like.
- If the queue is empty when I run `/stories`, write a sensible default batch: ~10 stories at my level and ~5 one level up, varied topics, weighted toward topics I rated well.

### Writing rules (put these in `CONTENT.md`)

> Write engaging, natural stories in Simplified Chinese at the requested level. Use vocabulary within the given HSK ceiling. At most 3–5% of words may be above the level, and only when unavoidable; every such word must be listed in `new_words`. Prefer short sentences at low levels, repeat key vocabulary naturally, and give each story a real hook, conflict, or twist rather than a flat description. Vary characters, settings, and structure across a batch. Use full-width Chinese punctuation. Naturally reuse the learner's `learning` words from the profile (spread across the batch, prioritizing those least recently seen). Don't repeat topics or plots from stories already read.
>
> Each story is one JSON file matching this schema exactly:
> ```
> {
>   "id": string,                          // stable unique id, e.g. "20261016-elem-lost-cat"
>   "series_id": string | null,
>   "chapter": number | null,
>   "topic": string,
>   "format": "story" | "dialogue" | "article",
>   "created_at": string,                  // ISO date
>   "title_zh": string,
>   "title_en": string,
>   "summary_en": string,                 // 1–2 sentences
>   "level": string,
>   "sentences": [
>     {
>       "zh": string,                     // the full sentence
>       "en": string,                     // natural English translation
>       "tokens": [                       // word-segmented, in order, concatenating exactly to zh
>         { "w": string,                  // the word, or punctuation
>           "py": string,                 // tone-marked pinyin for this word IN CONTEXT (handle 不/一 sandhi and polyphones); "" for punctuation
>           "gloss": string }             // short English meaning IN THIS CONTEXT; "" for punctuation
>       ]
>     }
>   ],
>   "new_words": [ { "w": string, "py": string, "gloss": string } ],
>   "grammar_points": [ { "pattern": string, "explanation_en": string, "example_zh": string, "example_en": string } ],   // 1–3 points used in the story
>   "questions": [ { "q_zh": string, "q_en": string, "answer_en": string } ]  // 2–3 comprehension questions
> }
> ```

For each story, use the level's HSK ceiling and target length from section 3. For series chapters, read the series file in `content/series/` first and update its summary afterwards.

### `npm run validate-stories` (a Node script in `/scripts`; run it after every batch)
- Every file parses and matches the schema; ids are unique and match filenames.
- Each sentence's tokens join exactly to `zh`.
- Every non-punctuation token has non-empty `py` and `gloss`; flag pinyin that disagrees with pinyin-pro for review (don't auto-fail, since context readings can legitimately differ).
- Compute % of tokens within the level's HSK ceiling. Fail below 90%, warn below 95%. Write the figure into a generated `content/index.json` manifest along with id, title, level, topic, series, chapter, and character count.
- Story length within the level's range (warn only).
- Warn on near-duplicate titles or openings versus existing stories.
- Print a summary table. If anything fails, fix the story files (that's your job, not mine) and rerun until clean.

### How stories reach the app
- The build copies `content/stories/` and `content/index.json` into the deployed site, and the service worker precaches them so everything works offline.
- On launch, the app compares `index.json` with what's in IndexedDB, imports new stories (and updated versions of existing ids), and keeps all my reading progress. It never deletes my progress if a story file disappears; it just hides that story.
- Show a small "5 new stories" toast after an update, and mark matching requests as done.
- Also allow importing story JSON files manually (Settings → Import stories) as a no-deploy fallback, e.g. stories AirDropped straight to the phone.

## 5. Reader screen (most important UI; make it polished)

### Text display
- Chinese text in large, comfortable type, with each token rendered as a tappable unit. Pinyin is shown above each word using `<ruby>`, aligned per word.
- **Pinyin modes** (toggle in the top bar, persisted): **Smart (default)**, All, Only words above my level, and Off. Smart mode is driven by the word memory in section 5a: it shows pinyin only on words I haven't learned yet, and hides it once the memory says I know them.
- **Font size** slider. **Simplified/Traditional** toggle via opencc-js.
- Optional subtle highlight of words above level (dotted underline).
- **Light/dark/sepia** themes, following the system by default.

### 5a. Word memory (drives Smart pinyin; build it carefully)

Keep a `words` table in Dexie with one row per word I've ever encountered, tracking my relationship to that word across every story, so the app learns what I know over time.

**Fields:** word, status, times seen, times looked up, times seen without a lookup in a row, first seen, last seen, last looked up, and a link to the flashcard if saved.

**Statuses and what Smart mode shows:**

| Status | Meaning | Pinyin in Smart mode |
|---|---|---|
| `new` | Never seen before | Shown |
| `learning` | Seen, looked up, or saved, but not yet solid | Shown |
| `known` | I know it | Hidden |
| `ignored` | Names, places, or words I don't care about | Hidden |

**How words move between statuses automatically:**
- When a story is imported into the app, any word in it with no row yet is created as `new`.
- Looking a word up (tapping it) moves it to `learning`, increments its lookup count, and resets its "seen without lookup" streak to 0. If the word was `known`, tapping it demotes it back to `learning`, because I evidently forgot it.
- When I mark a story as read, every word in it that I did **not** tap during that read gets its seen-without-lookup streak incremented. When that streak reaches the threshold (default **3** stories, adjustable in Settings), the word graduates to `known`.
- Flashcard reviews also feed in: when a saved word's FSRS stability passes a threshold (default **21 days**, adjustable), it graduates to `known`; if I press "Again" on a `known` word's card, it drops back to `learning`.
- Words at or below a chosen HSK level can be bulk-marked `known` on first setup (onboarding asks "What's your level?" and offers to mark e.g. all HSK 1–2 words as known so I'm not drowning in pinyin), and I can redo this from Settings.
- Manual override is always available: the word sheet has a status control (New / Learning / Known / Ignore), and the end-of-story screen offers "Mark all untapped words as known".
- Don't count punctuation, numbers, or Latin text as words.

**In the reader:**
- In Smart mode, pinyin appears above `new` and `learning` words and is hidden for `known` and `ignored` ones. This happens live: if I tap a known word, its pinyin reappears immediately, and if I mark a word known, its pinyin disappears everywhere on the page at once.
- Tapping any word, whatever its status, still opens the word sheet with pinyin, meaning, and audio, just like before.
- An optional subtle color cue per status (toggle in Settings, off by default), e.g. a faint underline under `learning` words.
- A small counter at the top of each story: "12 new · 5 learning", and the same counts on the library card, so I can see how hard a story will be before opening it.

**In story writing:**
- My `learning` words go into `learner-profile.json` (section 4), and you reuse them naturally across each batch, so new stories reinforce what I'm learning.
- New/learning counts are computed on the phone when stories arrive, since my word memory may have changed since the batch was written.

**In stats:**
- Show totals of known / learning words and a chart of known words over time.

The whole word memory must be included in Export/Import.

### Tapping a word
Open a bottom sheet (not a modal that hides the text) showing:
- The word, its pinyin, and a speaker button to speak just that word.
- The in-context gloss from the story first, then all CC-CEDICT entries.
- Its HSK level badge.
- Per-character breakdown for multi-character words (each character's pinyin and meaning, tappable).
- A **Save** button to add it to flashcards, storing the sentence it came from as the example.
- A **Mark as known** button.
- Swiping or tapping elsewhere closes it; tapping another word swaps the content without closing.

### Sentences and translation
- Long-press a sentence (or tap a small icon at its end) to show its English translation inline beneath it.
- A global "Show translation" toggle shows every sentence's English beneath it.

### Audio
- A sticky player bar at the bottom with play/pause, previous/next sentence, and speed (0.6×, 0.8×, 1×, 1.2×).
- Speak sentence by sentence with `speechSynthesis`, highlighting the current sentence (karaoke-style) and auto-scrolling to keep it in view.
- Tapping a sentence while playing jumps playback there.
- Pick the best available zh-CN voice and let me choose another in Settings. Handle iOS quirks: voices load asynchronously, and speech must start from a user gesture.

### End of story
- Grammar points section, then comprehension questions with tap-to-reveal answers.
- **Mark as read** button. It also offers to mark all unsaved words in the story as known (with a confirm).
- 👍/👎 rating, plus "Request next chapter" and "Request more like this" buttons that add a request to the queue (section 4).

### Progress
- Remember scroll position and the last-read sentence per story.

## 6. Flashcards / review

- **Saved words list**: search, filter by level, sort by date added or due date, and delete.
- **Review session** with ts-fsrs:
  - Front: the word in hanzi (pinyin hidden), with its example sentence (target word highlighted, pinyin hidden).
  - Tap to reveal: pinyin, meaning, example translation, and auto-play audio.
  - Grade with Again / Hard / Good / Easy buttons that show next-interval previews.
  - Card modes in Settings: Hanzi→meaning (default), Meaning→hanzi, and Audio→meaning.
- A badge on the tab bar showing cards due today.

## 7. Library (home screen)

- Grid/list of my stories as cards with: a cover (a generated gradient + the story's first character in large calligraphic-style type; no image API), Chinese title, English title, level badge, character count, "% in level", and a read/unread state.
- Filters: level, read/unread, topic, and series. Search by title.
- Series are grouped, showing chapter order.
- Swipe to delete, with undo.
- An empty-state that sends me to the Requests screen and explains how to get stories onto the phone.

## 8. Paste-your-own-text mode

- An "Import text" screen: paste any Chinese text and give it a title.
- It's readable immediately: segment locally (pinyin-pro + CC-CEDICT longest match), with pinyin from pinyin-pro and dictionary lookups on tap, in the same reader. No sentence translations at this stage.
- A checkbox "Enrich on next batch" adds the text to `learner-profile.json`. When I next run `/stories`, you convert it into full story JSON (careful segmentation, in-context pinyin and glosses, sentence translations, grammar points), keeping the original text unchanged and the same id, so the enriched version replaces the rough one without losing my progress.

## 9. Stats

- Words saved, words known, stories read, characters read (total and this week), and current daily streak.
- A simple bar chart of characters read per day for the last 30 days (plain SVG; no chart library).
- Estimated vocabulary by HSK level (known/saved words ÷ list size per level).

## 10. Settings

- Default level, and the word-memory thresholds (section 5a).
- Pinyin mode, font size, script, theme, voice, and default speed.
- Flashcard card modes and new cards per day.
- **Export profile** (for story requests; also on the Requests screen), **Import stories** (manual JSON files), and **Export all data / Import all data** for full backups. Make backup prominent, since there's no sync, and show when I last backed up.
- About screen with CC-CEDICT and HSK list attribution.

## 11. Navigation and feel

- Bottom tab bar: Library, Requests, Review, Stats, Settings.
- Respect safe-area insets (notch and home indicator); test in standalone display mode.
- Fast and native-feeling: no layout shift when the word sheet opens, 44px minimum tap targets, and smooth scrolling.
- Use a good Chinese font stack (system PingFang SC / Noto Sans SC). Don't bundle huge font files.
- Manifest: name, short name, theme color, a 512px and 192px icon (generate a simple 读 icon), `display: standalone`, and portrait orientation.

## 12. Deployment

A PWA's service worker needs HTTPS, so testing over `http://<mac-ip>` won't install properly. Set up:
- `npm run dev -- --host` for quick UI checks on my phone over Wi-Fi (no offline).
- A GitHub Pages or Cloudflare Pages deploy (whichever is simpler; write the GitHub Action or config) for the real install. Use a correct `base` path.
- `npm run deploy`: runs `validate-stories`, builds, and publishes, refusing to deploy if validation fails.
- A README with exact steps to install on iPhone (Share → Add to Home Screen) and Android (⋮ → Install app), and the weekly routine: export profile → AirDrop to Mac → `/stories` → `npm run deploy` → open the app.

## 13. Quality bar

- TypeScript strict mode. Keep the data layer (`src/db`), content sync (`src/lib/content-sync.ts`), and text processing (`src/lib/segment.ts`, `src/lib/hsk.ts`) separate from UI. Share the story schema and validation code between the app and `/scripts`.
- Unit tests (Vitest) for: CC-CEDICT parsing, tone-mark conversion, longest-match segmentation, token/sentence join validation, HSK level percentage, word-memory status transitions, and content sync (new, updated, and removed stories).
- Write 3 real sample stories (Newbie, Elementary, Intermediate) into `content/stories/` during phase 1 so the reader has real content from the start.
- Handle errors gracefully everywhere: malformed story files, a failed content sync, storage full, and missing TTS voices.

---

## Build phases (stop after each)

1. **Scaffold + data + content pipeline**: Vite/React/TS/Tailwind/PWA setup, data scripts for CC-CEDICT and HSK, Dexie schema, tab navigation shell, the story schema, `validate-stories`, `CONTENT.md`, the `/stories` command, and 3 sample stories. Deploy to Pages and confirm it installs on my phone and opens offline.
2. **Reader + word memory**: render the sample stories with ruby pinyin, the word memory (section 5a) with Smart pinyin mode and the other modes, the word bottom sheet with dictionary lookup and status control, translations, and font/theme/script settings. Include onboarding's "mark HSK levels as known" step. Add unit tests for the status transitions.
3. **Audio**: sentence-by-sentence TTS with highlighting, the player bar, and speed control.
4. **Library + content sync**: syncing stories from `index.json` into IndexedDB, the Library screen with covers and filters, the Requests screen, and profile export. Then run a real `/stories` batch end to end with me.
5. **Flashcards**: saving words, the saved-word list, FSRS reviews, and the due badge.
6. **Import text, stats, series, export/import**, and final polish pass on iPhone and Android.
