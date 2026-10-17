/**
 * Loads CC-CEDICT shards on demand and caches them in memory for the session.
 * The word sheet is the only consumer; a story's own vocabulary touches at
 * most a couple dozen shards, so this never needs more than a simple Map.
 */
import { shardFor, unpackEntry, type CedictShard, type DictEntry } from './cedict-parse.ts';
import { dataUrl } from './paths.ts';

const shardCache = new Map<number, Promise<CedictShard>>();

async function loadShard(n: number): Promise<CedictShard> {
  let p = shardCache.get(n);
  if (!p) {
    p = fetch(dataUrl(`cedict/${n}.json`)).then((r) => {
      if (!r.ok) throw new Error(`cedict shard ${n}: ${r.status}`);
      return r.json() as Promise<CedictShard>;
    });
    shardCache.set(n, p);
  }
  return p;
}

/** Every CC-CEDICT entry for a headword — a word can have several readings. */
export async function lookupWord(w: string): Promise<DictEntry[]> {
  const shard = await loadShard(shardFor(w));
  const packed = shard[w];
  return packed ? packed.map(unpackEntry) : [];
}

/** Look up several words at once, deduping the shard fetches. */
export async function lookupWords(words: readonly string[]): Promise<Map<string, DictEntry[]>> {
  const shardNums = [...new Set(words.map(shardFor))];
  await Promise.all(shardNums.map(loadShard));
  const out = new Map<string, DictEntry[]>();
  for (const w of words) {
    const shard = await loadShard(shardFor(w));
    out.set(w, shard[w] ? shard[w].map(unpackEntry) : []);
  }
  return out;
}
