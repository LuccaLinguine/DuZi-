/** Settings' "redo" counterpart to onboarding's bulk "mark known" step. */
import { useState } from 'react';
import { LEVEL_LIST, LEVELS, hskRangeLabel, type LevelId } from '../lib/levels.ts';
import { useHsk } from '../hooks/useHsk.ts';
import { markHskCeilingKnown } from '../db/bulk.ts';
import { Screen, Section, Row } from '../components/Screen.tsx';

export function MarkKnown({ defaultLevel, onBack }: { defaultLevel: LevelId; onBack: () => void }) {
  const [level, setLevel] = useState<LevelId>(defaultLevel);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState<number | null>(null);
  const hsk = useHsk();
  const ceiling = LEVELS[level].hskCeiling;

  return (
    <Screen
      title="Mark words as known"
      actions={
        <button type="button" onClick={onBack} className="tap -mr-2 px-2 text-[15px]" style={{ color: 'var(--accent)' }}>
          Done
        </button>
      }
    >
      <p className="px-5 pt-5 text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
        Mark every HSK word at or below a level as known, so Smart pinyin stops showing it on
        words you already have. Existing progress on those words is overwritten with "known".
      </p>

      <Section title="Up to and including">
        {LEVEL_LIST.map((l) => (
          <Row key={l.id} label={l.name} onClick={() => setLevel(l.id)} value={level === l.id ? '✓' : undefined} />
        ))}
      </Section>

      <div className="px-4">
        <button
          type="button"
          disabled={!hsk || marking}
          onClick={() => {
            if (!hsk) return;
            setMarking(true);
            void markHskCeilingKnown(hsk, ceiling).then((count) => {
              setMarked(count);
              setMarking(false);
            });
          }}
          className="tap w-full rounded-lg text-[15px] font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {marking ? 'Marking…' : `Mark ${hskRangeLabel(ceiling)} as known`}
        </button>
        {marked !== null && (
          <p className="mt-3 text-center text-[14px]" style={{ color: 'var(--ok)' }}>
            Marked {marked.toLocaleString()} words as known.
          </p>
        )}
      </div>
      <div className="h-8" />
    </Screen>
  );
}
