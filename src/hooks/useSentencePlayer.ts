/**
 * Sentence-by-sentence playback for the reader's sticky player bar (spec
 * section 5, "Audio"). Advances automatically as each sentence finishes;
 * pausing stops the current sentence outright rather than trying to resume
 * mid-utterance, since `speechSynthesis.pause()`/`resume()` is unreliable on
 * iOS Safari — restarting the current sentence from its beginning is the
 * robust behaviour across engines.
 *
 * The sequencing math (what's next, what's previous, when to stop) lives in
 * lib/sentence-player.ts and is unit tested there; this hook is the thin
 * glue around React state and the Web Speech API.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { speak, stopSpeaking } from '../lib/tts.ts';
import { autoAdvance, nextSentence, prevSentence } from '../lib/sentence-player.ts';

export interface SentencePlayer {
  /** Index of the sentence currently speaking or last spoken; null before first play. */
  currentIndex: number | null;
  playing: boolean;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  jumpTo: (index: number) => void;
}

export function useSentencePlayer(
  sentences: readonly string[],
  voice: SpeechSynthesisVoice | null,
  rate: number,
): SentencePlayer {
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  // The onend handler is registered once per utterance and must see values
  // current at the time it fires, not at the time it was created — refs
  // avoid re-issuing the whole utterance chain on every render.
  const sentencesRef = useRef(sentences);
  sentencesRef.current = sentences;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const speakIndex = useCallback((index: number) => {
    const text = sentencesRef.current[index];
    if (text === undefined) {
      setPlaying(false);
      return;
    }
    setCurrentIndex(index);
    setPlaying(true);
    speak(text, voiceRef.current, rateRef.current, {
      onEnd: () => {
        // A pause or a jump in the meantime also lands here via cancel(),
        // which fires onerror — this onEnd is only reachable from a sentence
        // that actually finished speaking, so playingRef is still reliable.
        if (!playingRef.current) return;
        const next = autoAdvance(index, sentencesRef.current.length);
        if (next !== null) speakIndex(next);
        else setPlaying(false);
      },
      onError: () => setPlaying(false),
    });
  }, []);

  const play = useCallback(() => {
    speakIndex(currentIndex ?? 0);
  }, [currentIndex, speakIndex]);

  const pause = useCallback(() => {
    stopSpeaking();
    setPlaying(false);
  }, []);

  const jumpTo = useCallback(
    (index: number) => {
      speakIndex(index);
    },
    [speakIndex],
  );

  const next = useCallback(() => {
    const n = nextSentence(currentIndex, sentencesRef.current.length);
    if (n !== null) speakIndex(n);
  }, [currentIndex, speakIndex]);

  const prev = useCallback(() => {
    const p = prevSentence(currentIndex);
    if (p !== null) speakIndex(p);
  }, [currentIndex, speakIndex]);

  // Stop speaking when the sentence list changes (a different story) or the
  // reader unmounts (navigating back) — never leave audio running behind.
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [sentences]);

  return { currentIndex, playing, play, pause, next, prev, jumpTo };
}
