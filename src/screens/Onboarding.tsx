/**
 * First-launch flow: pick a starting level, then offer to bulk-mark the HSK
 * bands below it as known so the reader doesn't drown a learner who already
 * knows the basics in pinyin (spec section 5a). The same picker is reachable
 * again from Settings ("I can redo this from Settings").
 */
import { useState } from 'react';
import { LEVEL_LIST, LEVELS, levelBadge, hskRangeLabel, type LevelId } from '../lib/levels.ts';
import { useHsk } from '../hooks/useHsk.ts';
import { markHskCeilingKnown } from '../db/bulk.ts';

interface Props {
  initialLevel: LevelId;
  onFinish: (level: LevelId) => void;
}

export function Onboarding({ initialLevel, onFinish }: Props) {
  const [step, setStep] = useState<'level' | 'known'>('level');
  const [level, setLevel] = useState<LevelId>(initialLevel);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState<number | null>(null);
  const hsk = useHsk();

  const offeredCeiling = LEVELS[level].hskCeiling - 1;

  if (step === 'level') {
    return (
      <Shell title="读字" subtitle="读字 Dúzì — a graded Chinese reader">
        <h1 className="text-[22px] font-semibold">What's your level?</h1>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          Stories, pinyin, and new-word tracking are tuned to this. You can change it later in
          Settings.
        </p>
        <div className="mt-6 space-y-2">
          {LEVEL_LIST.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLevel(l.id)}
              aria-pressed={level === l.id}
              className="tap flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left"
              style={{
                borderColor: level === l.id ? 'var(--accent)' : 'var(--border)',
                background: level === l.id ? 'var(--accent-soft)' : 'var(--surface)',
              }}
            >
              <span className="text-[15px] font-medium">{l.name}</span>
              <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                {levelBadge(l.id)}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStep('known')}
          className="tap mt-8 w-full rounded-lg text-[16px] font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Continue
        </button>
      </Shell>
    );
  }

  if (offeredCeiling < 1) {
    // Starting at Newbie: nothing below it to pre-mark.
    onFinish(level);
    return null;
  }

  return (
    <Shell title="读字" subtitle="Starting at this level">
      <h1 className="text-[22px] font-semibold">Mark the basics as known?</h1>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
        If you already know {hskRangeLabel(offeredCeiling)}, mark those words known now so Smart pinyin
        doesn't show it on words you don't need help with. You can redo this anytime from
        Settings.
      </p>

      {marked !== null ? (
        <p className="mt-6 text-[15px]" style={{ color: 'var(--ok)' }}>
          Marked {marked.toLocaleString()} words as known.
        </p>
      ) : (
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => onFinish(level)}
            className="tap flex-1 rounded-lg border text-[15px] font-medium"
            style={{ borderColor: 'var(--border)' }}
          >
            Skip
          </button>
          <button
            type="button"
            disabled={!hsk || marking}
            onClick={() => {
              if (!hsk) return;
              setMarking(true);
              void markHskCeilingKnown(hsk, offeredCeiling).then((count) => {
                setMarked(count);
                setMarking(false);
              });
            }}
            className="tap flex-1 rounded-lg text-[15px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {marking ? 'Marking…' : `Mark ${hskRangeLabel(offeredCeiling)} as known`}
          </button>
        </div>
      )}

      {marked !== null && (
        <button
          type="button"
          onClick={() => onFinish(level)}
          className="tap mt-6 w-full rounded-lg text-[16px] font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Done
        </button>
      )}
    </Shell>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="pt-safe px-6 pt-8">
        <p className="han-serif text-[26px]">{title}</p>
        <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
          {subtitle}
        </p>
      </div>
      <div className="flex-1 px-6 py-6">{children}</div>
    </div>
  );
}
