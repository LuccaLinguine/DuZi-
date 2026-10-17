/**
 * Web Speech API wrapper shared by the word sheet's single-word speaker
 * button and the reader's sentence-by-sentence player (spec section 5,
 * "Audio").
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

export interface SpeakHandlers {
  /** Fires when the utterance finishes normally — the cue to advance. */
  onEnd?: () => void;
  /** Fires on failure, and also when `speak()` cancels a prior utterance. */
  onError?: () => void;
}

/**
 * Speak one string. Must be invoked directly from a click/tap handler (not
 * after an intervening `await`) the first time in a session, or iOS Safari
 * will refuse to produce audio.
 *
 * Always cancels whatever was speaking first, so callers never need to do
 * their own bookkeeping to avoid overlapping utterances — the sentence
 * player relies on this to jump mid-playback.
 */
export function speak(
  text: string,
  voice: SpeechSynthesisVoice | null,
  rate = 1,
  handlers?: SpeakHandlers,
): void {
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? 'zh-CN';
  utter.rate = rate;
  if (handlers?.onEnd) utter.onend = handlers.onEnd;
  if (handlers?.onError) utter.onerror = handlers.onError;
  speechSynthesis.speak(utter);
}

/** Stop whatever is currently speaking, firing its `onerror`, not `onend`. */
export function stopSpeaking(): void {
  speechSynthesis.cancel();
}
