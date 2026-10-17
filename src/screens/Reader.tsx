/**
 * The reader (spec section 5 and 5a). Renders a story with per-word ruby
 * pinyin driven by the word memory, a translation toggle, the word sheet, and
 * an end-of-story panel that is what actually drives words into `known`.
 */
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/index.ts';
import type { ProgressRow, Settings, WordStatus } from '../db/types.ts';
import type { SettingsPatch } from '../hooks/useSettings.ts';
import type { Sentence, Story, Token } from '../lib/story-schema.ts';
import { storyWords } from '../lib/content-sync.ts';
import { LEVELS, levelBadge } from '../lib/levels.ts';
import { isInLevelAt } from '../lib/hsk.ts';
import { isWordToken } from '../lib/text.ts';
import { useScriptConverter } from '../hooks/useScriptConverter.ts';
import { applyLookup, applyManualStatus, applyStoryRead, newWordRow, pinyinVisible } from '../lib/word-memory.ts';
import { computeWordCounts, formatWordCounts } from '../lib/word-counts.ts';
import { pickZhVoice } from '../lib/tts.ts';
import { useWordRows } from '../hooks/useWordRows.ts';
import { useHsk } from '../hooks/useHsk.ts';
import { useSentencePlayer } from '../hooks/useSentencePlayer.ts';
import { WordSheet, type WordSelection } from '../components/WordSheet.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { PlayerBar, SPEEDS } from '../components/PlayerBar.tsx';

interface Props {
  storyId: string;
  settings: Settings;
  onUpdateSettings: (patch: SettingsPatch) => void;
  onBack: () => void;
}

const PINYIN_CYCLE: Settings['pinyinMode'][] = ['smart', 'all', 'above', 'off'];
const PINYIN_LABEL: Record<Settings['pinyinMode'], string> = {
  smart: 'Smart',
  all: 'All',
  above: 'Above level',
  off: 'Off',
};

const SCROLL_SAVE_DEBOUNCE_MS = 500;

function defaultProgress(storyId: string): ProgressRow {
  return {
    storyId,
    read: false,
    readAt: null,
    lastSentence: 0,
    scrollY: 0,
    rating: null,
    openedAt: Date.now(),
    tappedThisRead: [],
  };
}

export function Reader({ storyId, settings, onUpdateSettings, onBack }: Props) {
  const storyRow = useLiveQuery(() => db.stories.get(storyId), [storyId]);
  const story = storyRow?.story;

  const words = useMemo(() => (story ? storyWords(story) : []), [story]);
  const wordRows = useWordRows(words);
  const hsk = useHsk();
  const ceiling = story ? LEVELS[story.level].hskCeiling : 0;
  const convert = useScriptConverter(settings.script);
  // Speak the authored (simplified) text regardless of display script — the
  // Traditional toggle is cosmetic and TTS engines pronounce both identically,
  // but keeping to one canonical source avoids depending on a given voice's
  // Traditional-character support.
  const sentenceTexts = useMemo(() => story?.sentences.map((s) => s.zh) ?? [], [story]);

  const [progress, setProgress] = useState<ProgressRow | null>(null);
  const [selection, setSelection] = useState<WordSelection | null>(null);
  const [revealedSentences, setRevealedSentences] = useState<Set<number>>(new Set());
  const [confirmMarkRead, setConfirmMarkRead] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const player = useSentencePlayer(sentenceTexts, voice, settings.speechRate);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentenceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const restoredScroll = useRef(false);
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    void db.progress.get(storyId).then((row) => {
      if (live) setProgress(row ?? defaultProgress(storyId));
    });
    return () => {
      live = false;
    };
  }, [storyId]);

  useEffect(() => {
    void pickZhVoice(settings.voiceURI).then(setVoice);
  }, [settings.voiceURI]);

  // Jump to the saved scroll position once, after the story has rendered.
  useEffect(() => {
    if (restoredScroll.current || !progress || !story) return;
    if (progress.scrollY > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = progress.scrollY;
    }
    restoredScroll.current = true;
  }, [progress, story]);

  // Keep the speaking sentence in view as playback advances.
  useEffect(() => {
    if (player.currentIndex === null) return;
    sentenceRefs.current[player.currentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [player.currentIndex]);

  const persistProgress = useCallback((next: ProgressRow) => {
    setProgress(next);
    void db.progress.put(next);
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const top = el.scrollTop;
      let lastSentence = 0;
      sentenceRefs.current.forEach((node, i) => {
        if (node && node.offsetTop <= top + 80) lastSentence = i;
      });
      setProgress((p) => {
        if (!p) return p;
        const next = { ...p, scrollY: top, lastSentence };
        void db.progress.put(next);
        return next;
      });
    }, SCROLL_SAVE_DEBOUNCE_MS);
  }, []);

  const openWord = useCallback(
    (word: string, context?: { py: string; gloss: string }) => {
      setSelection({ word, contextPy: context?.py, contextGloss: context?.gloss });
      const now = Date.now();
      void db.words.get(word).then((existing) => {
        const row = existing ?? newWordRow(word, now);
        void db.words.put(applyLookup(row, now));
      });
      setProgress((p) => {
        if (!p || p.tappedThisRead.includes(word)) return p;
        const next = { ...p, tappedThisRead: [...p.tappedThisRead, word] };
        void db.progress.put(next);
        return next;
      });
    },
    [],
  );

  const navigateWordSheet = useCallback((word: string) => {
    setSelection({ word });
  }, []);

  const setWordStatus = useCallback((word: string, status: WordStatus) => {
    const now = Date.now();
    void db.words.get(word).then((existing) => {
      const row = existing ?? newWordRow(word, now);
      void db.words.put(applyManualStatus(row, status, now));
    });
  }, []);

  const toggleTranslation = useCallback((i: number) => {
    setRevealedSentences((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const toggleAnswer = useCallback((i: number) => {
    setRevealedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const doMarkAsRead = useCallback(
    (markUntappedKnown: boolean) => {
      if (!progress || !story) return;
      const now = Date.now();
      const tapped = new Set(progress.tappedThisRead);

      void (async () => {
        const rows = await db.words.bulkGet(words);
        const updates = words.map((w, i) => {
          const row = rows[i] ?? newWordRow(w, now);
          const wasTapped = tapped.has(w);
          if (markUntappedKnown && !wasTapped) {
            return { ...applyManualStatus(row, 'known', now), timesSeen: row.timesSeen + 1, seenWithoutLookup: 0 };
          }
          return applyStoryRead(row, wasTapped, now, settings.graduateAfterStories);
        });
        await db.words.bulkPut(updates);
        await db.reads.add({ storyId: story.id, at: now, chars: storyRow?.chars ?? 0, topic: story.topic, level: story.level });
      })();

      persistProgress({ ...progress, read: true, readAt: now, tappedThisRead: [] });
      setConfirmMarkRead(false);
    },
    [progress, story, words, settings.graduateAfterStories, storyRow, persistProgress],
  );

  const setRating = useCallback(
    (rating: 'up' | 'down') => {
      if (!progress) return;
      persistProgress({ ...progress, rating: progress.rating === rating ? null : rating });
    },
    [progress, persistProgress],
  );

  const cyclePinyinMode = useCallback(() => {
    onUpdateSettings((prev) => {
      const i = PINYIN_CYCLE.indexOf(prev.pinyinMode);
      return { pinyinMode: PINYIN_CYCLE[(i + 1) % PINYIN_CYCLE.length] };
    });
  }, [onUpdateSettings]);

  if (storyRow === undefined) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: 'var(--ink-3)' }}>
        Loading…
      </div>
    );
  }

  if (storyRow === null || !story) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p style={{ color: 'var(--ink-2)' }}>This story is no longer available.</p>
        <button type="button" onClick={onBack} className="tap rounded-lg px-4" style={{ background: 'var(--accent)', color: '#fff' }}>
          Back to Library
        </button>
      </div>
    );
  }

  const counts = computeWordCounts(words, wordRows ?? new Map());
  const countsLabel = formatWordCounts(counts);
  const selectedStatus = selection ? wordRows?.get(selection.word)?.status : undefined;
  const tappedCount = progress?.tappedThisRead.length ?? 0;
  const untappedCount = words.length - tappedCount;

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--paper)' }}>
      <header
        className="pt-safe shrink-0 border-b px-3"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center gap-2 py-2">
          <button type="button" onClick={onBack} aria-label="Back to Library" className="tap flex items-center justify-center rounded-full px-1">
            <BackIcon />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="han truncate text-[17px] font-semibold leading-tight">{story.title_zh}</h1>
            <p className="truncate text-[12px]" style={{ color: 'var(--ink-3)' }}>
              {levelBadge(story.level)} · {storyRow.chars} chars{countsLabel && ` · ${countsLabel}`}
            </p>
          </div>
          <button
            type="button"
            onClick={cyclePinyinMode}
            className="tap rounded-lg border px-2 text-[12px] font-medium"
            style={{ borderColor: 'var(--border)' }}
          >
            拼音 {PINYIN_LABEL[settings.pinyinMode]}
          </button>
          <button
            type="button"
            onClick={() => onUpdateSettings((prev) => ({ showTranslations: !prev.showTranslations }))}
            aria-pressed={settings.showTranslations}
            className="tap rounded-lg border px-2 text-[12px] font-medium"
            style={{
              borderColor: settings.showTranslations ? 'var(--accent)' : 'var(--border)',
              color: settings.showTranslations ? 'var(--accent)' : 'var(--ink)',
            }}
          >
            译
          </button>
        </div>
      </header>

      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
        <div className="mx-auto max-w-xl">
          {story.sentences.map((sentence, i) => (
            <SentenceView
              key={i}
              ref={(el) => {
                sentenceRefs.current[i] = el;
              }}
              sentence={sentence}
              index={i}
              fontSize={settings.fontSize}
              convert={convert}
              pinyinMode={settings.pinyinMode}
              highlightAboveLevel={settings.highlightAboveLevel}
              showStatusColors={settings.showStatusColors}
              ceiling={ceiling}
              hsk={hsk}
              wordRows={wordRows}
              translationVisible={settings.showTranslations || revealedSentences.has(i)}
              onTapWord={openWord}
              onToggleTranslation={() => toggleTranslation(i)}
              isSpeaking={player.currentIndex === i}
              onTapSentence={player.playing ? () => player.jumpTo(i) : undefined}
            />
          ))}

          <EndOfStory
            story={story}
            progress={progress}
            revealedAnswers={revealedAnswers}
            onToggleAnswer={toggleAnswer}
            onMarkAsRead={() => setConfirmMarkRead(true)}
            onSetRating={setRating}
            untappedCount={untappedCount}
          />
        </div>
      </div>

      <PlayerBar
        playing={player.playing}
        rate={settings.speechRate}
        canPrev={(player.currentIndex ?? 0) > 0}
        canNext={player.currentIndex === null || player.currentIndex < sentenceTexts.length - 1}
        onPlayPause={() => (player.playing ? player.pause() : player.play())}
        onPrev={player.prev}
        onNext={player.next}
        onCycleRate={() =>
          onUpdateSettings((prev) => {
            const i = SPEEDS.indexOf(prev.speechRate as (typeof SPEEDS)[number]);
            return { speechRate: SPEEDS[(i === -1 ? 0 : i + 1) % SPEEDS.length]! };
          })
        }
      />

      <WordSheet
        selection={selection}
        status={selectedStatus}
        voice={voice}
        speechRate={settings.speechRate}
        onClose={() => setSelection(null)}
        onNavigate={navigateWordSheet}
        onStatusChange={(status) => selection && setWordStatus(selection.word, status)}
      />

      {confirmMarkRead && (
        <ConfirmDialog
          title="Mark words as known?"
          body={
            untappedCount > 0
              ? `${untappedCount} word${untappedCount === 1 ? '' : 's'} in this story went untapped. Mark them all as known, or let the usual 3-story streak handle it?`
              : 'Every word in this story was tapped at least once, so there is nothing to bulk-mark.'
          }
          confirmLabel={untappedCount > 0 ? 'Mark all as known' : 'OK'}
          cancelLabel={untappedCount > 0 ? 'Just mark as read' : undefined}
          onConfirm={() => doMarkAsRead(untappedCount > 0)}
          onCancel={() => doMarkAsRead(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const SentenceView = forwardRef<
  HTMLDivElement,
  {
    sentence: Sentence;
    index: number;
    fontSize: number;
    convert: (s: string) => string;
    pinyinMode: Settings['pinyinMode'];
    highlightAboveLevel: boolean;
    showStatusColors: boolean;
    ceiling: number;
    hsk: ReturnType<typeof useHsk>;
    wordRows: ReturnType<typeof useWordRows>;
    translationVisible: boolean;
    onTapWord: (word: string, context: { py: string; gloss: string }) => void;
    onToggleTranslation: () => void;
    /** True while this is the sentence the player is speaking — karaoke-style highlight. */
    isSpeaking: boolean;
    /** Set only while playing; tapping the sentence then jumps playback here. */
    onTapSentence: (() => void) | undefined;
  }
>(function SentenceView(
  {
    sentence,
    fontSize,
    convert,
    pinyinMode,
    highlightAboveLevel,
    showStatusColors,
    ceiling,
    hsk,
    wordRows,
    translationVisible,
    onTapWord,
    onToggleTranslation,
    isSpeaking,
    onTapSentence,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      onClick={onTapSentence}
      className="mb-5 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
      style={{ background: isSpeaking ? 'var(--accent-soft)' : 'transparent' }}
    >
      <p className="han flex flex-wrap items-end" style={{ fontSize, lineHeight: 2.1 }}>
        {sentence.tokens.map((t, j) => (
          <TokenView
            key={j}
            token={t}
            convert={convert}
            pinyinMode={pinyinMode}
            highlightAboveLevel={highlightAboveLevel}
            showStatusColors={showStatusColors}
            ceiling={ceiling}
            hsk={hsk}
            wordRows={wordRows}
            onTap={onTapWord}
          />
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTranslation();
          }}
          aria-label="Toggle translation"
          className="tap ml-1 inline-flex items-center justify-center self-center text-[13px]"
          style={{ color: 'var(--ink-3)' }}
        >
          <TranslateIcon />
        </button>
      </p>
      {translationVisible && (
        <p className="mt-1 text-[14px] leading-snug" style={{ color: 'var(--ink-2)' }}>
          {sentence.en}
        </p>
      )}
    </div>
  );
});

function TokenView({
  token,
  convert,
  pinyinMode,
  highlightAboveLevel,
  showStatusColors,
  ceiling,
  hsk,
  wordRows,
  onTap,
}: {
  token: Token;
  convert: (s: string) => string;
  pinyinMode: Settings['pinyinMode'];
  highlightAboveLevel: boolean;
  showStatusColors: boolean;
  ceiling: number;
  hsk: ReturnType<typeof useHsk>;
  wordRows: ReturnType<typeof useWordRows>;
  onTap: (word: string, context: { py: string; gloss: string }) => void;
}) {
  const displayText = convert(token.w);

  if (!isWordToken(token.w)) {
    return <span>{displayText}</span>;
  }

  const status = wordRows?.get(token.w)?.status;
  const aboveLevel = hsk ? !isInLevelAt(token.w, ceiling, hsk) : false;
  const showPy = pinyinVisible(pinyinMode, status, aboveLevel);

  let decoration: { textDecoration: string; textDecorationColor?: string; textUnderlineOffset?: string } = {
    textDecoration: 'none',
  };
  if (showStatusColors && status === 'learning') {
    decoration = { textDecoration: 'underline', textDecorationColor: 'var(--accent)', textUnderlineOffset: '4px' };
  } else if (highlightAboveLevel && aboveLevel) {
    decoration = { textDecoration: 'underline dotted', textDecorationColor: 'var(--ink-3)', textUnderlineOffset: '4px' };
  }

  return (
    <ruby
      onClick={(e) => {
        e.stopPropagation();
        onTap(token.w, { py: token.py, gloss: token.gloss });
      }}
      className="tap mx-0.5 inline-flex cursor-pointer flex-col items-center px-0.5 text-center active:opacity-60"
      style={decoration}
    >
      {displayText}
      <rt className="select-none text-[0.45em] font-normal" style={{ color: 'var(--ink-2)', visibility: showPy ? 'visible' : 'hidden' }}>
        {token.py || ' '}
      </rt>
    </ruby>
  );
}

function EndOfStory({
  story,
  progress,
  revealedAnswers,
  onToggleAnswer,
  onMarkAsRead,
  onSetRating,
  untappedCount,
}: {
  story: Story;
  progress: ProgressRow | null;
  revealedAnswers: Set<number>;
  onToggleAnswer: (i: number) => void;
  onMarkAsRead: () => void;
  onSetRating: (r: 'up' | 'down') => void;
  untappedCount: number;
}) {
  return (
    <div className="mt-6 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
      {story.grammar_points.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-[13px] font-semibold tracking-wide uppercase" style={{ color: 'var(--ink-3)' }}>
            Grammar
          </h2>
          <ul className="space-y-3">
            {story.grammar_points.map((g, i) => (
              <li key={i} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <p className="han text-[15px] font-medium">{g.pattern}</p>
                <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-2)' }}>
                  {g.explanation_en}
                </p>
                <p className="han mt-2 text-[14px]">{g.example_zh}</p>
                <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  {g.example_en}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {story.questions.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-[13px] font-semibold tracking-wide uppercase" style={{ color: 'var(--ink-3)' }}>
            Questions
          </h2>
          <ul className="space-y-2">
            {story.questions.map((q, i) => {
              const revealed = revealedAnswers.has(i);
              return (
                <li key={i} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  <p className="han text-[15px]">{q.q_zh}</p>
                  <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    {q.q_en}
                  </p>
                  <button
                    type="button"
                    onClick={() => onToggleAnswer(i)}
                    className="tap mt-2 text-[13px] font-medium"
                    style={{ color: 'var(--accent)' }}
                  >
                    {revealed ? q.answer_en : 'Show answer'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSetRating('up')}
            aria-pressed={progress?.rating === 'up'}
            className="tap rounded-full border px-3 text-[18px]"
            style={{ borderColor: progress?.rating === 'up' ? 'var(--accent)' : 'var(--border)' }}
          >
            👍
          </button>
          <button
            type="button"
            onClick={() => onSetRating('down')}
            aria-pressed={progress?.rating === 'down'}
            className="tap rounded-full border px-3 text-[18px]"
            style={{ borderColor: progress?.rating === 'down' ? 'var(--accent)' : 'var(--border)' }}
          >
            👎
          </button>
        </div>
        <button
          type="button"
          onClick={onMarkAsRead}
          className="tap rounded-lg px-4 text-[15px] font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {progress?.read ? 'Mark as read again' : 'Mark as read'}
        </button>
      </section>
      {progress?.read && (
        <p className="mt-2 text-right text-[12px]" style={{ color: 'var(--ink-3)' }}>
          Read{untappedCount === 0 ? '' : ` · ${untappedCount} word${untappedCount === 1 ? '' : 's'} not tapped this time`}
        </p>
      )}
      <div className="h-10" />
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

function TranslateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </svg>
  );
}
