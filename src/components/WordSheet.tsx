/**
 * The word bottom sheet (spec section 5, "Tapping a word"). Not a modal — the
 * text stays visible above it. Tapping a different word while it is open
 * swaps the content in place; the parent keeps `selection` as its own state
 * and this component is just a view over it.
 */
import { useMemo } from 'react';
import type { WordStatus } from '../db/types.ts';
import { useDictEntries } from '../hooks/useDictionary.ts';
import { useHsk } from '../hooks/useHsk.ts';
import { hskLevelOf } from '../lib/hsk.ts';
import { primaryEntry } from '../lib/cedict-parse.ts';
import { splitChars } from '../lib/text.ts';
import { speak } from '../lib/tts.ts';

export interface WordSelection {
  word: string;
  /** In-context reading and gloss from the token tapped, when known. */
  contextPy?: string;
  contextGloss?: string;
}

const STATUSES: { id: WordStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'learning', label: 'Learning' },
  { id: 'known', label: 'Known' },
  { id: 'ignored', label: 'Ignore' },
];

interface Props {
  selection: WordSelection | null;
  status: WordStatus | undefined;
  voice: SpeechSynthesisVoice | null;
  speechRate: number;
  onClose: () => void;
  onNavigate: (word: string) => void;
  onStatusChange: (status: WordStatus) => void;
}

export function WordSheet({ selection, status, voice, speechRate, onClose, onNavigate, onStatusChange }: Props) {
  const chars = useMemo(() => (selection ? splitChars(selection.word) : []), [selection]);
  const isMultiChar = chars.length > 1;
  const lookupTargets = useMemo(
    () => (selection ? [selection.word, ...(isMultiChar ? chars : [])] : []),
    [selection, chars, isMultiChar],
  );
  const dict = useDictEntries(lookupTargets);
  const hsk = useHsk();

  if (!selection) return null;

  const rawEntries = dict?.get(selection.word) ?? [];
  const primary = primaryEntry(selection.word, rawEntries);
  const entries = primary ? [primary, ...rawEntries.filter((e) => e !== primary)] : rawEntries;
  const hskLevel = hsk ? hskLevelOf(selection.word, hsk) : undefined;
  const primaryPy = selection.contextPy || entries[0]?.py || '';

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="presentation" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.25)' }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="pb-safe relative max-h-[75vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-t"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Drag handle, also closes on tap for a quick dismiss. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex w-full justify-center py-2"
        >
          <span className="h-1 w-10 rounded-full" style={{ background: 'var(--border)' }} />
        </button>

        <div className="px-5 pb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="han text-[32px] leading-none font-medium">{selection.word}</span>
                {primaryPy && (
                  <span className="text-[17px]" style={{ color: 'var(--ink-2)' }}>
                    {primaryPy}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {hskLevel !== undefined && (
                <span
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  HSK {hskLevel >= 7 ? '6+' : hskLevel}
                </span>
              )}
              <button
                type="button"
                onClick={() => speak(selection.word, voice, speechRate)}
                aria-label={`Speak ${selection.word}`}
                className="tap flex items-center justify-center rounded-full border"
                style={{ borderColor: 'var(--border)' }}
              >
                <SpeakerIcon />
              </button>
            </div>
          </div>

          {selection.contextGloss && (
            <p className="mt-2 text-[15px]" style={{ color: 'var(--ink)' }}>
              {selection.contextGloss}
              <span className="ml-1.5 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                in this story
              </span>
            </p>
          )}

          <div className="mt-4">
            {dict === undefined ? (
              <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                Looking up…
              </p>
            ) : entries.length === 0 ? (
              <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                Not in CC-CEDICT.
              </p>
            ) : (
              <ul className="space-y-2">
                {entries.map((e, i) => (
                  <li key={i} className="text-[14px] leading-snug">
                    <span style={{ color: 'var(--ink-2)' }}>{e.py}</span>
                    {e.trad !== selection.word && (
                      <span className="han ml-2" style={{ color: 'var(--ink-3)' }}>
                        {e.trad}
                      </span>
                    )}
                    <div style={{ color: 'var(--ink)' }}>{e.defs.join('; ')}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isMultiChar && (
            <div className="mt-4">
              <h3 className="mb-2 text-[12px] font-semibold tracking-wide uppercase" style={{ color: 'var(--ink-3)' }}>
                Characters
              </h3>
              <div className="flex flex-wrap gap-2">
                {chars.map((c, i) => {
                  const entry = primaryEntry(c, dict?.get(c) ?? []);
                  return (
                    <button
                      key={`${c}-${i}`}
                      type="button"
                      onClick={() => onNavigate(c)}
                      className="tap rounded-lg border px-2.5 py-1.5 text-left"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div className="han text-[18px] leading-tight">{c}</div>
                      <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                        {entry ? `${entry.py} · ${entry.defs[0] ?? ''}` : '…'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5">
            <h3 className="mb-2 text-[12px] font-semibold tracking-wide uppercase" style={{ color: 'var(--ink-3)' }}>
              Status
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {STATUSES.map((s) => {
                const active = status === s.id || (status === undefined && s.id === 'new');
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onStatusChange(s.id)}
                    aria-pressed={active}
                    className="tap rounded-lg border text-[13px] font-medium"
                    style={{
                      borderColor: active ? 'var(--accent)' : 'var(--border)',
                      background: active ? 'var(--accent-soft)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--ink-2)',
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 9v6h4l5 4V5L9 9H5Z" />
      <path d="M17 9a4 4 0 0 1 0 6M19.5 7a7.5 7.5 0 0 1 0 10" />
    </svg>
  );
}
