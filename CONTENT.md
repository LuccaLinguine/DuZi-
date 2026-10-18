# Writing stories for 读字 (Dúzì)

This is the complete guide for writing story content. If you are a Claude Code
session asked for new stories, everything you need is here — you do not need the
original build spec.

The short version: read the learner profile, write one JSON file per story into
`content/stories/`, run `npm run validate-stories`, and fix whatever it flags
until it is clean. Fixing the files is your job, not the learner's.

---

## 1. Before writing

1. Read `content/profile/learner-profile.json` if it exists. It carries the
   learner's current level, the words they are actively learning, what they have
   already read, their topic ratings, any pasted texts awaiting enrichment, and
   their queued requests.
2. If there is no profile, or its `requests` array is empty, write a default
   batch: **~10 stories at the learner's current level and ~5 at one level up**,
   across varied topics, weighted towards topics they rated well. If there is no
   profile at all, ask what to write rather than guessing.
3. For a series chapter, read `content/series/<series_id>.json` first so the
   chapter is consistent with what came before.

### `learner-profile.json`

```jsonc
{
  "exported_at": "2026-10-17T09:00:00.000Z",
  "level": "elementary",            // current reading level
  "learning": [                      // words to reuse, least-recently-seen first
    { "w": "忘记", "py": "wàng jì", "lookups": 4, "lastSeen": "2026-10-14" }
  ],
  "known_counts": { "1": 480, "2": 610, "3": 120 },   // known words per HSK band
  "read": [                          // avoid repeating these plots
    { "id": "20261016-elem-lost-cat", "title_zh": "丢了的猫", "topic": "Daily life", "rating": "up" }
  ],
  "topic_ratings": { "Food": 1.0, "Mystery": 0.5 },   // mean rating, -1…1
  "pasted_texts": [                  // §8 enrichment queue
    { "id": "paste-1760000000", "title": "微博新闻", "raw": "…" }
  ],
  "requests": [
    { "id": "req-1", "level": "elementary", "topic": "Food", "format": "story",
      "count": 3, "seriesId": null, "note": "" }
  ]
}
```

## 2. Writing rules

> Write engaging, natural stories in Simplified Chinese at the requested level.
> Use vocabulary within the given HSK ceiling. At most 3–5% of words may be above
> the level, and only when unavoidable; every such word must be listed in
> `new_words`. Prefer short sentences at low levels, repeat key vocabulary
> naturally, and give each story a real hook, conflict, or twist rather than a
> flat description. Vary characters, settings, and structure across a batch. Use
> full-width Chinese punctuation. Naturally reuse the learner's `learning` words
> from the profile (spread across the batch, prioritizing those least recently
> seen). Don't repeat topics or plots from stories already read.

In practice:

- **Give it a shape.** Something must change between the first sentence and the
  last. Even an 80-character Newbie story can have a small turn in it.
- **Repeat on purpose.** A key word used three or four times across a story is
  learned; used once, it is noise.
- **Vary the batch.** Different narrators, settings, lengths and endings. If two
  stories in a batch both open with someone waking up, rewrite one — the
  validator will flag near-identical openings anyway.
- **Dialogue format** uses `——` or quoted speech with speaker names, and
  short turns.
- **Article format** is third-person and informational, but still needs a point.
- **Names** of people and places are usually above level. Keep them few, short
  and declared in `new_words`.

## 3. Levels

| Level | `level` value | HSK ceiling | Length (Chinese characters) |
|---|---|---|---|
| Newbie | `newbie` | HSK 1 | 80–150 |
| Elementary | `elementary` | HSK 2 | 150–300 |
| Intermediate | `intermediate` | HSK 3 | 300–500 |
| Upper Intermediate | `upper` | HSK 4 | 500–800 |
| Advanced | `advanced` | HSK 5 | 800–1200 |
| Master | `master` | HSK 6+ | 1200–2000 |

"In level" is measured against **HSK 3.0** bands (`public/data/hsk/hsk3.json`),
counted per token occurrence. Band 7 in that data covers the combined levels 7–9.

## 4. File layout

One JSON file per story in `content/stories/`, named `YYYYMMDD-level-slug.json`,
where `level` is a short level tag (`newbie`, `elem`, `inter`, `upper`, `adv`,
`master`) and `slug` is a few kebab-case English words.

**The `id` must equal the filename without `.json`** — the validator enforces it.
Once a story has shipped, never change its `id`: the learner's reading progress,
ratings and word history are keyed on it. To correct a story, edit the file and
keep the id; the app replaces the content and keeps all progress.

## 5. Schema

```jsonc
{
  "id": string,                    // stable unique id; == filename stem
  "series_id": string | null,
  "chapter": number | null,        // required when series_id is set
  "topic": string,
  "format": "story" | "dialogue" | "article",
  "created_at": string,            // ISO date
  "ai_generated": boolean,         // always true for a /stories batch — see below
  "title_zh": string,
  "title_en": string,
  "summary_en": string,            // 1–2 sentences
  "level": string,                 // one of the `level` values above
  "sentences": [
    {
      "zh": string,                // the full sentence
      "en": string,                // natural English translation
      "tokens": [                  // word-segmented, in order,
                                   // concatenating EXACTLY to zh
        { "w": string,             // the word, or a run of punctuation
          "py": string,            // tone-marked pinyin IN CONTEXT; "" for punctuation
          "gloss": string,         // short English meaning IN THIS CONTEXT; "" for punctuation
          "pos": string }          // grammatical function, see "Part of speech" below; "" for punctuation
      ]
    }
  ],
  "new_words": [ { "w": string, "py": string, "gloss": string } ],
  "grammar_points": [              // 1–3 points actually used in the story
    { "pattern": string, "explanation_en": string,
      "example_zh": string, "example_en": string }
  ],
  "questions": [                   // 2–3 comprehension questions
    { "q_zh": string, "q_en": string, "answer_en": string }
  ]
}
```

`ai_generated` is always `true` — every story in this pipeline is written by Claude
Code, and the field exists so the app can show that plainly (a small badge on the
library card and in the reader) rather than leave it implicit. Set it `true` on
every story you write; the validator rejects a missing or non-boolean value.

### Tokenising

This is where most mistakes happen, so be exact:

- **The `w` fields must concatenate to `zh` character for character** —
  including every comma, quote and full stop. The reader renders from tokens, so
  anything you leave out of the tokens is invisible in the app.
- Punctuation gets its own token with `py: ""` and `gloss: ""`. A run like `，“`
  may share one token.
- Segment at **word** level, not character level: 朋友 is one token, not two.
  Separable verbs split where they split in the sentence (睡觉 is one token;
  睡了一会儿觉 is 睡 / 了 / 一会儿 / 觉).
- Numbers plus measure words split naturally: 三 / 个 / 人.

### Pinyin

- Tone marks, not numbers: `nǐ hǎo`, never `ni3 hao3`.
- Space between syllables within a word: `péng you`, `tú shū guǎn`.
- **Give the reading in context.** Handle sandhi and polyphones:
  - 不 is `bù` but `bú` before a fourth tone (不是 → `bú shì`).
  - 一 is `yī` alone, `yí` before a fourth tone (一个 → `yí gè`),
    `yì` before first/second/third (一天 → `yì tiān`).
  - Neutral tones are unmarked: 了 `le`, 的 `de`, 们 `men`, 子 `zi`.
  - Common polyphones: 得 `de`/`děi`/`dé`, 还 `hái`/`huán`, 长 `cháng`/`zhǎng`,
    行 `xíng`/`háng`, 乐 `lè`/`yuè`, 为 `wèi`/`wéi`, 地 `de`/`dì`, 觉 `jué`/`jiào`.
- The validator cross-checks every reading against pinyin-pro and **warns** when
  they disagree. A warning is not automatically wrong — third-tone sandhi and
  context readings legitimately differ — but read each one and confirm.

### Part of speech

Every real word's `pos` is one of exactly these eight values, picked for the
grammatical role it plays **in this sentence** (the same word can take a
different tag in a different sentence — 爱 is `verb` in 我爱你 but `noun` in
一生的爱):

| `pos` | Covers | Examples |
|---|---|---|
| `noun` | things, people, places, proper nouns | 猫, 老师, 北京, 麦当劳 |
| `verb` | actions, including 是/有 | 吃, 去, 是, 有, 觉得 |
| `adj` | qualities / stative verbs | 好, 大, 高兴, 累 |
| `adv` | modifies a verb or adjective | 很, 也, 都, 不, 没, 已经 |
| `pron` | pronouns | 我, 你, 他, 这, 那, 谁 |
| `quant` | numerals and measure words | 一, 二, 个, 本, 次 |
| `part` | grammatical particles | 了, 的, 吗, 呢, 着, 过, 得 |
| `conn` | prepositions and conjunctions | 在, 给, 从, 和, 但是, 因为 |

Interjections (啊, 哈哈) and anything that genuinely doesn't fit — tag with
whichever of the eight reads closest; don't invent a ninth value, the reader's
colour palette and validator only know these eight. This drives the reader's
optional "colour by grammatical function" mode (Settings, off by default) —
get it right and a learner can see sentence structure at a glance, so when
in doubt, tag for the word's actual job in this sentence, not its dictionary
headword category.

### Glosses

The in-context meaning, 1–4 words. 打 is "to hit" in general, but "to make (a
call)" in 打电话 — write the one the sentence means. These are what the learner
sees first in the word sheet, above the dictionary entries.

### Grammar points

1–3 patterns that the story actually uses, explained for someone at that level.
Give the pattern in a schematic form (`把 + object + verb + result`), one or two
sentences of plain English, and a fresh example — not a sentence copied from the
story.

### Questions

2–3 comprehension questions in Chinese, at or below the story's level, each with
an English translation and a short English answer. Ask about what happened, not
about vocabulary.

## 6. Series

A series lives in `content/series/<series_id>.json`:

```jsonc
{
  "id": "mystery-wang",
  "title_zh": "王小姐的秘密",
  "title_en": "Ms. Wang's Secret",
  "level": "intermediate",
  "summary_en": "An office worker finds a stranger's notebook.",
  "characters": [ { "name_zh": "王小雨", "py": "Wáng Xiǎoyǔ", "note": "28, accountant" } ],
  "chapters": [
    { "chapter": 1, "story_id": "20261017-inter-the-notebook",
      "summary_en": "Xiaoyu finds a notebook on the bus and reads the first page." }
  ]
}
```

**After writing each chapter, append its summary to this file.** Later sessions
rely on it to keep names, facts and plot straight.

## 7. Enriching pasted text (§8)

A profile's `pasted_texts` are rough imports the learner read with local
segmentation only. To enrich one:

- Keep **the same `id`** and the original Chinese **unchanged**, so the app
  replaces the rough version in place and keeps the learner's progress.
- Add careful segmentation, in-context pinyin and glosses, sentence
  translations, grammar points and questions.
- Set `level` to the level the text actually sits at, and `topic` to something
  sensible. `format` is usually `article`.

## 8. Validate

```
npm run validate-stories
```

**Errors block a deploy.** They are:

- invalid JSON, or a field missing or of the wrong type
- an `id` that is duplicated or does not match its filename
- tokens that do not join exactly to `zh`
- a real word with an empty `py`, `gloss` or `pos`, or a `pos` that isn't one
  of the eight values above
- below 90% of words within the level's HSK ceiling

**Warnings are worth reading but do not block:**

- below 95% in level
- pinyin disagreeing with pinyin-pro
- above-level words missing from `new_words`, or `new_words` the story never uses
- a length outside the level's range
- half-width punctuation in Chinese text
- a title or opening that is near-identical to another story
- a series with no `content/series/` file, or non-contiguous chapters

Fix the files and rerun until clean. The validator regenerates
`content/index.json`, which is the manifest the app syncs against — it will not
regenerate it while any error stands.

## 9. Report back

When the batch is clean, tell the learner:

- each story's title (Chinese and English), level, character count and % in level
- which of their `learning` words you worked in, and where
- the genuinely new words you introduced
- which queued requests the batch satisfies
- anything you deliberately did differently from what they asked, and why

Then they run `npm run deploy`.
