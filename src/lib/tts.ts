/**
 * A single-word "speak this" for the word sheet. The sentence-by-sentence
 * player with highlighting and speed control is phase 3 — this is just
 * enough Web Speech API to let the word sheet's speaker button work.
 *
 * iOS quirks handled here: voices load asynchronously (sometimes after
 * `getVoices()` first returns empty), and `speak()` must be called
 * synchronously inside a user-gesture handler or Safari silently drops it.
 */

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!voicesPromise) {
    voicesPromise = new Promise((resolve) => {
      const existing = speechSynthesis.getVoices();
      if (existing.length > 0) {
        resolve(existing);
        return;
      }
      const onChange = () => {
        speechSynthesis.removeEventListener('voiceschanged', onChange);
        resolve(speechSynthesis.getVoices());
      };
      speechSynthesis.addEventListener('voiceschanged', onChange);
      // Some engines never fire the event; don't hang forever.
      setTimeout(() => resolve(speechSynthesis.getVoices()), 1000);
    });
  }
  return voicesPromise;
}

/** Best zh-CN voice available, preferring a local (non-network) one. */
export async function pickZhVoice(preferredURI?: string | null): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices();
  if (preferredURI) {
    const match = voices.find((v) => v.voiceURI === preferredURI);
    if (match) return match;
  }
  const zh = voices.filter((v) => v.lang.toLowerCase().startsWith('zh'));
  const cn = zh.filter((v) => /CN|cmn-Hans|zh-Hans/i.test(v.lang) || /Mandarin|Chinese/i.test(v.name));
  const pool = cn.length > 0 ? cn : zh;
  return pool.find((v) => v.localService) ?? pool[0] ?? null;
}

export async function listZhVoices(): Promise<SpeechSynthesisVoice[]> {
  const voices = await loadVoices();
  return voices.filter((v) => v.lang.toLowerCase().startsWith('zh'));
}

/**
 * Speak one short string. Must be invoked directly from a click/tap handler
 * (not after an intervening `await`) the first time in a session, or iOS
 * Safari will refuse to produce audio.
 */
export function speak(text: string, voice: SpeechSynthesisVoice | null, rate = 1): void {
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? 'zh-CN';
  utter.rate = rate;
  speechSynthesis.speak(utter);
}
