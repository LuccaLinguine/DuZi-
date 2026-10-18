/**
 * Flashcards (spec section 6): the saved-word list, and a review session
 * scheduled with FSRS. The scheduling maths is in lib/review.ts and the
 * persistence in db/cards.ts — this is the UI over both.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/index.ts';
import type { CardRow, Settings } from '../db/types.ts';
import { deleteCard, newCardsToday, reviewCard, setCardSuspended } from '../db/cards.ts';
import {
  buildQueue,
  countDue,
  formatInterval,
  intervalPreviews,
  pickCardMode,
  GRADES,
  GRADE_LABELS,
  State,
  type Grade,
} from '../lib/review.ts';
import { pickZhVoice, speak } from '../lib/tts.ts';
import { Screen, EmptyState } from '../components/Screen.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';

type Sort = 'added' | 'due' | 'alpha';

interface Props {
  settings: Settings;
}

export function Review({ settings }: Props) {
  const cards = useLiveQuery(() => db.cards.toArray(), []);
  const [session, setSession] = useState<CardRow[] | null>(null);
  const [newToday, setNewToday] = useState(0);

  useEffect(() => {
    void newCardsToday().then(setNewToday);
  }, [cards]);

  const due = cards ? countDue(cards, Date.now()) : 0;

  const startSession = useCallback(() => {
    if (!cards) return;
    setSession(buildQueue(cards, Date.now(), settings.newCardsPerDay, newToday));
  }, [cards, settings.newCardsPerDay, newToday]);

  if (session) {
    return (
      <ReviewSession
        queue={session}
        settings={settings}
        onDone={() => {
          setSession(null);
          void newCardsToday().then(setNewToday);
        }}
      />
    );
  }

  return <SavedWords cards={cards} due={due} onStart={startSession} />;
}

/* ------------------------------------------------------------------ */

function SavedWords({
  cards,
  due,
  onStart,
}: {
  cards: CardRow[] | undefined;
  due: number;
  onStart: () => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('added');
  const [toDelete, setToDelete] = useState<CardRow | null>(null);

  const filtered = useMemo(() => {
    if (!cards) return [];
    const q = search.trim().toLowerCase();
    const matched = q
      ? cards.filter((c) => c.w.includes(search.trim()) || c.gloss.toLowerCase().includes(q) || c.py.toLowerCase().includes(q))
      : cards;
    const sorted = [...matched];
    if (sort === 'added') sorted.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === 'due') sorted.sort((a, b) => a.due - b.due);
    else sorted.sort((a, b) => a.w.localeCompare(b.w, 'zh'));
    return sorted;
  }, [cards, search, sort]);

  if (cards === undefined) {
    return (
      <Screen title="Review">
        <p className="px-4 py-6 text-[14px]" style={{ color: 'var(--ink-3)' }}>
          Loading…
        </p>
      </Screen>
    );
  }

  if (cards.length === 0) {
    return (
      <Screen title="Review">
        <EmptyState
          icon="记"
          title="No saved words yet"
          body="Tap any word while reading and choose “Save to flashcards”. Saved words get scheduled here with FSRS, so you see each one just before you'd forget it."
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Review"
      subtitle={`${cards.length} saved · ${due} due`}
      actions={
        due > 0 ? (
          <button
            type="button"
            onClick={onStart}
            className="tap rounded-lg px-3 text-[15px] font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Review {due}
          </button>
        ) : undefined
      }
    >
      {due === 0 && (
        <p className="px-4 pt-4 text-[14px]" style={{ color: 'var(--ok)' }}>
          Nothing due right now — come back later.
        </p>
      )}

      <div className="px-4 pt-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search words"
          className="w-full rounded-lg border px-3 py-2 text-[15px]"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        />
        <div className="mt-2 flex gap-2">
          {(['added', 'due', 'alpha'] as Sort[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              aria-pressed={sort === s}
              className="tap rounded-lg border px-2.5 text-[13px]"
              style={{
                borderColor: sort === s ? 'var(--accent)' : 'var(--border)',
                background: sort === s ? 'var(--accent-soft)' : 'transparent',
                color: sort === s ? 'var(--accent)' : 'var(--ink-2)',
              }}
            >
              {s === 'added' ? 'Recent' : s === 'due' ? 'Due' : 'A–Z'}
            </button>
          ))}
        </div>
      </div>

      <ul className="px-4 py-3">
        {filtered.map((c) => (
          <li
            key={c.id}
            className="mb-2 rounded-xl border p-3"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <p className="han text-[18px] font-medium">
              {c.w} <span className="text-[14px] font-normal" style={{ color: 'var(--ink-2)' }}>{c.py}</span>
            </p>
            <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
              {c.gloss}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                {c.suspended
                  ? 'Suspended'
                  : c.fsrs.state === State.New
                    ? 'New'
                    : c.due <= Date.now()
                      ? 'Due now'
                      : `Due in ${formatInterval(c.due - Date.now())}`}
              </span>
              <span className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={() => void setCardSuspended(c.id, !c.suspended)}
                  className="py-1 text-[12px]"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {c.suspended ? 'Resume' : 'Suspend'}
                </button>
                <button
                  type="button"
                  onClick={() => setToDelete(c)}
                  className="py-1 text-[12px]"
                  style={{ color: 'var(--ink-3)' }}
                >
                  Delete
                </button>
              </span>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-8 text-center text-[14px]" style={{ color: 'var(--ink-3)' }}>
            No words match “{search}”.
          </li>
        )}
      </ul>

      {toDelete && (
        <ConfirmDialog
          title="Delete this flashcard?"
          body={`${toDelete.w} will stop coming up for review. The word itself stays in your word memory.`}
          confirmLabel="Delete"
          onConfirm={() => {
            void deleteCard(toDelete.id);
            setToDelete(null);
          }}
          onCancel={() => setToDelete(null)}
        />
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function ReviewSession({
  queue,
  settings,
  onDone,
}: {
  queue: CardRow[];
  settings: Settings;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [done, setDone] = useState(0);

  useEffect(() => {
    void pickZhVoice(settings.voiceURI).then(setVoice);
  }, [settings.voiceURI]);

  const card = queue[index];
  const mode = useMemo(() => pickCardMode(settings.cardModes, index), [settings.cardModes, index]);
  const previews = useMemo(() => (card ? intervalPreviews(card, Date.now()) : null), [card]);

  // Audio-first cards are useless without hearing the word, so speak on reveal
  // rather than making the learner hunt for the speaker button.
  useEffect(() => {
    if (revealed && card) speak(card.w, voice, settings.speechRate);
  }, [revealed, card, voice, settings.speechRate]);

  const grade = useCallback(
    (g: Grade) => {
      if (!card) return;
      void reviewCard(card, g);
      setDone((d) => d + 1);
      setRevealed(false);
      setIndex((i) => i + 1);
    },
    [card],
  );

  if (!card) {
    return (
      <Screen title="Review">
        <EmptyState
          icon="成"
          title={done === 0 ? 'Nothing to review' : `${done} card${done === 1 ? '' : 's'} reviewed`}
          body={done === 0 ? 'Come back when something is due.' : 'Nice work — that is everything due right now.'}
          action={
            <button
              type="button"
              onClick={onDone}
              className="tap rounded-lg px-4 text-[15px] font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Done
            </button>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={`${index + 1} / ${queue.length}`}
      actions={
        <button type="button" onClick={onDone} className="tap -mr-2 px-2 text-[15px]" style={{ color: 'var(--accent)' }}>
          End
        </button>
      }
    >
      <div className="flex min-h-full flex-col justify-between px-5 pt-6 pb-16">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {/* Front: what the learner is being asked to recall from. */}
          {mode === 'hanzi-meaning' && <p className="han text-[44px] leading-tight font-medium">{card.w}</p>}
          {mode === 'meaning-hanzi' && <p className="text-[24px] leading-snug font-medium">{card.gloss}</p>}
          {mode === 'audio-meaning' && (
            <button
              type="button"
              onClick={() => speak(card.w, voice, settings.speechRate)}
              className="tap flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              aria-label="Play the word"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 9v6h4l5 4V5L9 9H5Z" />
                <path d="M17 9a4 4 0 0 1 0 6M19.5 7a7.5 7.5 0 0 1 0 10" />
              </svg>
            </button>
          )}

          {/* The example sentence, with the target word masked until reveal so
              it prompts recall instead of giving the answer away. */}
          {card.exampleZh && (
            <p className="han mt-6 text-[17px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              {revealed || mode !== 'hanzi-meaning'
                ? card.exampleZh
                : card.exampleZh.replaceAll(card.w, '＿'.repeat([...card.w].length))}
            </p>
          )}

          {revealed && (
            <div className="mt-6">
              {mode !== 'hanzi-meaning' && <p className="han text-[36px] leading-tight font-medium">{card.w}</p>}
              <p className="mt-1 text-[18px]" style={{ color: 'var(--ink-2)' }}>
                {card.py}
              </p>
              {mode !== 'meaning-hanzi' && (
                <p className="mt-1 text-[16px]" style={{ color: 'var(--ink)' }}>
                  {card.gloss}
                </p>
              )}
              {card.exampleEn && (
                <p className="mt-3 text-[14px]" style={{ color: 'var(--ink-3)' }}>
                  {card.exampleEn}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-8">
          {revealed ? (
            <div className="grid grid-cols-4 gap-2">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => grade(g)}
                  className="tap flex flex-col items-center rounded-lg border py-2"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span className="text-[14px] font-medium">{GRADE_LABELS[g]}</span>
                  <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    {previews?.[g]}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="tap w-full rounded-lg text-[16px] font-semibold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Show answer
            </button>
          )}
        </div>
      </div>
    </Screen>
  );
}
