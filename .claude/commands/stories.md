---
description: Write a batch of graded Chinese stories for 读字, validate them, and report back
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(npm run validate-stories), Bash(npm run data:*), Bash(ls:*), Bash(cat:*)
---

Write a new batch of stories for this repo's graded Chinese reader.

$ARGUMENTS

## Steps

1. **Read `CONTENT.md`** in full. It is the complete writing guide and schema —
   follow it exactly; do not work from memory.

2. **Read the learner profile** at `content/profile/learner-profile.json`.
   - If it exists, use its `requests`, `learning` words, `read` list,
     `topic_ratings` and `pasted_texts`.
   - If `requests` is empty, write the default batch described in CONTENT.md §1
     (~10 at the learner's level, ~5 one level up, varied topics).
   - If the file does not exist **and** the user gave no instructions above, ask
     what to write instead of guessing.

3. **Check what already exists** so you don't repeat yourself: list
   `content/stories/`, read `content/index.json`, and read any relevant
   `content/series/*.json` for chapters you are continuing.

4. **Write the stories**, one JSON file per story in `content/stories/`, named
   `YYYYMMDD-level-slug.json` with `id` equal to the filename stem. Use today's
   date. Work through the batch story by story — do not batch-generate
   structurally identical files.

5. **Update `content/series/*.json`** for every series chapter you wrote,
   appending the chapter summary.

6. **Run `npm run validate-stories`** and fix every error, then look at every
   warning and either fix it or be able to say why it is fine. Rerun until clean.
   Fixing the files is your job — never hand the user a failing batch.

7. **Report**, per CONTENT.md §9: a table of titles (zh / en), level, character
   count and % in level; the `learning` words you reused and where; the new words
   introduced; which queued requests this batch satisfies; and anything you did
   differently from what was asked.

Finish by reminding the user to run `npm run deploy`.

## Rules

- Never change the `id` of an existing story — progress is keyed on it.
- Never delete or rewrite an existing story unless explicitly asked, or unless
  you are enriching a pasted text (same id, original Chinese preserved).
- Do not touch `src/`, build config, or anything outside `content/` for this task.
