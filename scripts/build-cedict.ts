/**
 * Downloads CC-CEDICT from mdbg.net and writes it to public/data/cedict/ as
 * 64 compact JSON shards plus a small meta file.
 *
 * CC-CEDICT is CC BY-SA 4.0 — the attribution is shown on the About screen.
 *
 *   npm run data:cedict
 */
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import {
  parseCedict,
  packEntry,
  shardFor,
  CEDICT_SHARDS,
  type CedictShard,
} from '../src/lib/cedict-parse.ts';

const URL_GZ = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz';
const OUT = resolve(import.meta.dirname, '../public/data/cedict');
const CACHE = resolve(import.meta.dirname, '../.cache/cedict.txt.gz');

async function fetchSource(): Promise<string> {
  if (existsSync(CACHE)) {
    console.log('Using cached download (.cache/cedict.txt.gz)');
    return gunzipSync(readFileSync(CACHE)).toString('utf8');
  }
  console.log(`Downloading ${URL_GZ} …`);
  const res = await fetch(URL_GZ);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const gz = Buffer.from(await res.arrayBuffer());
  mkdirSync(resolve(import.meta.dirname, '../.cache'), { recursive: true });
  writeFileSync(CACHE, gz);
  return gunzipSync(gz).toString('utf8');
}

const text = await fetchSource();
const entries = parseCedict(text);
console.log(`Parsed ${entries.length.toLocaleString()} entries`);

if (entries.length < 100_000) {
  throw new Error(`Only ${entries.length} entries parsed — the source format probably changed.`);
}

const shards: CedictShard[] = Array.from({ length: CEDICT_SHARDS }, () => ({}));
for (const e of entries) {
  const shard = shards[shardFor(e.simp)]!;
  (shard[e.simp] ??= []).push(packEntry(e));
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let bytes = 0;
let biggest = 0;
for (let i = 0; i < CEDICT_SHARDS; i++) {
  const json = JSON.stringify(shards[i]);
  writeFileSync(resolve(OUT, `${i}.json`), json);
  bytes += json.length;
  biggest = Math.max(biggest, json.length);
}

// Version line from the file header, so About can show how fresh the data is.
const version = /#! date=(\S+)/.exec(text)?.[1] ?? new Date().toISOString().slice(0, 10);

writeFileSync(
  resolve(OUT, 'meta.json'),
  JSON.stringify(
    {
      source: 'CC-CEDICT (mdbg.net)',
      license: 'CC BY-SA 4.0',
      url: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict',
      version,
      entries: entries.length,
      headwords: shards.reduce((n, s) => n + Object.keys(s).length, 0),
      shards: CEDICT_SHARDS,
    },
    null,
    2,
  ),
);

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
console.log(`Wrote ${CEDICT_SHARDS} shards to public/data/cedict/`);
console.log(`  total ${mb(bytes)}, largest shard ${kb(biggest)}, version ${version}`);
