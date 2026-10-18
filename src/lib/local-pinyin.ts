/**
 * Local pinyin for pasted text (spec section 8) — pinyin-pro reads a whole
 * string and handles tone sandhi/polyphones from context, same as the
 * validator's cross-check. Lazy-loaded: it's only needed on the Import Text
 * screen, not the app's main path, so it shouldn't cost everyone else's
 * first load.
 */
let pinyinFn: typeof import('pinyin-pro').pinyin | null = null;

async function load() {
  if (!pinyinFn) {
    pinyinFn = (await import('pinyin-pro')).pinyin;
  }
  return pinyinFn;
}

/**
 * Tone-marked pinyin for every token in a sentence, in one pass. Reading the
 * whole sentence (rather than each token alone) is what gives pinyin-pro the
 * context to resolve polyphones and 不/一 sandhi correctly — same reasoning
 * as the validator's pinyin cross-check.
 */
export async function pinyinForTokens(tokens: readonly string[], sentenceZh: string): Promise<string[]> {
  const pinyin = await load();
  const all = pinyin(sentenceZh, { type: 'all', toneType: 'symbol' });
  const out: string[] = [];
  let offset = 0;
  for (const t of tokens) {
    const span = all.slice(offset, offset + t.length);
    offset += t.length;
    out.push(span.map((c) => c.pinyin).filter(Boolean).join(' '));
  }
  return out;
}
