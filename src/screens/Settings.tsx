/**
 * Spec section 10. Flashcard modes, backup and export/import land with their
 * features in later phases; everything else that has something to show now
 * lives here.
 */
import { useEffect, useState } from 'react';
import type { Settings as SettingsShape, ThemeMode, Script, PinyinMode, CardMode } from '../db/types.ts';
import type { SettingsPatch } from '../hooks/useSettings.ts';
import { LEVEL_LIST } from '../lib/levels.ts';
import { listZhVoices } from '../lib/tts.ts';
import { posColor, POS_LABELS, POS_ORDER } from '../lib/pos-colors.ts';
import { useResolvedTheme } from '../hooks/useResolvedTheme.ts';
import { Screen, Section, Row } from '../components/Screen.tsx';
import { About } from './About.tsx';
import { MarkKnown } from './MarkKnown.tsx';

interface Props {
  settings: SettingsShape;
  onChange: (patch: SettingsPatch) => void;
  storageInfo: string;
}

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'sepia', label: 'Sepia' },
];

const SCRIPTS: { id: Script; label: string }[] = [
  { id: 'simplified', label: '简体' },
  { id: 'traditional', label: '繁體' },
];

const CARD_MODES: { id: CardMode; label: string }[] = [
  { id: 'hanzi-meaning', label: '汉字 → meaning' },
  { id: 'meaning-hanzi', label: 'Meaning → 汉字' },
  { id: 'audio-meaning', label: 'Audio → meaning' },
];

const PINYIN_MODES: { id: PinyinMode; label: string }[] = [
  { id: 'smart', label: 'Smart' },
  { id: 'all', label: 'All' },
  { id: 'above', label: 'Above level' },
  { id: 'off', label: 'Off' },
];

type SubScreen = 'about' | 'mark-known' | null;

export function Settings({ settings, onChange, storageInfo }: Props) {
  const [sub, setSub] = useState<SubScreen>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    void listZhVoices().then(setVoices);
  }, []);

  if (sub === 'about') return <About onBack={() => setSub(null)} />;
  if (sub === 'mark-known') {
    return <MarkKnown defaultLevel={settings.defaultLevel} onBack={() => setSub(null)} />;
  }

  return (
    <Screen title="Settings">
      <Section title="Level">
        <Row label="Default level">
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {LEVEL_LIST.map((l) => (
              <Choice
                key={l.id}
                label={l.name}
                selected={settings.defaultLevel === l.id}
                onSelect={() => onChange({ defaultLevel: l.id })}
              />
            ))}
          </div>
        </Row>
        <Row label="Mark words as known" value="›" onClick={() => setSub('mark-known')} />
      </Section>

      <Section title="Reading">
        <Row label="Pinyin">
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {PINYIN_MODES.map((m) => (
              <Choice
                key={m.id}
                label={m.label}
                selected={settings.pinyinMode === m.id}
                onSelect={() => onChange({ pinyinMode: m.id })}
              />
            ))}
          </div>
        </Row>
        <Row label="Theme">
          <div className="flex gap-2 px-4 pb-3">
            {THEMES.map((t) => (
              <Choice
                key={t.id}
                label={t.label}
                selected={settings.theme === t.id}
                onSelect={() => onChange({ theme: t.id })}
              />
            ))}
          </div>
        </Row>
        <Row label="Script">
          <div className="flex gap-2 px-4 pb-3">
            {SCRIPTS.map((s) => (
              <Choice
                key={s.id}
                label={s.label}
                selected={settings.script === s.id}
                onSelect={() => onChange({ script: s.id })}
              />
            ))}
          </div>
        </Row>
        <Row label="Font size" value={`${settings.fontSize}px`}>
          <div className="px-4 pb-3">
            <input
              type="range"
              min={16}
              max={40}
              step={1}
              value={settings.fontSize}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
              className="w-full"
              style={{ accentColor: 'var(--accent)' }}
              aria-label="Font size"
            />
            <p className="han mt-2 text-center" style={{ fontSize: settings.fontSize }}>
              读一个好故事
            </p>
          </div>
        </Row>
        <Row label="Highlight above-level words">
          <div className="px-4 pb-3">
            <Toggle
              checked={settings.highlightAboveLevel}
              onToggle={() => onChange((prev) => ({ highlightAboveLevel: !prev.highlightAboveLevel }))}
            />
          </div>
        </Row>
        <Row label="Colour cue for learning words">
          <div className="px-4 pb-3">
            <Toggle
              checked={settings.showStatusColors}
              onToggle={() => onChange((prev) => ({ showStatusColors: !prev.showStatusColors }))}
            />
          </div>
        </Row>
        <Row label="Colour by grammatical function">
          <div className="px-4 pb-3">
            <Toggle
              checked={settings.showPosColors}
              onToggle={() => onChange((prev) => ({ showPosColors: !prev.showPosColors }))}
            />
          </div>
          {settings.showPosColors && <PosLegend />}
        </Row>
      </Section>

      <Section title="Audio">
        <Row label="Voice" value={voices.length === 0 ? 'none found' : undefined}>
          {voices.length > 0 && (
            <div className="px-4 pb-3">
              <select
                value={settings.voiceURI ?? ''}
                onChange={(e) => onChange({ voiceURI: e.target.value || null })}
                className="w-full rounded-lg border px-3 py-2 text-[14px]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <option value="">Best available</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}
        </Row>
      </Section>

      <Section title="Word memory">
        <Row label="Graduate to known after" value={`${settings.graduateAfterStories} stories`}>
          <div className="flex items-center gap-3 px-4 pb-3">
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={settings.graduateAfterStories}
              onChange={(e) => onChange({ graduateAfterStories: Number(e.target.value) })}
              className="w-full"
              style={{ accentColor: 'var(--accent)' }}
              aria-label="Stories seen without a lookup before a word graduates to known"
            />
          </div>
        </Row>
        <Row label="Graduate a saved word at" value={`${settings.graduateAtStabilityDays} days stable`}>
          <div className="flex items-center gap-3 px-4 pb-3">
            <input
              type="range"
              min={7}
              max={90}
              step={1}
              value={settings.graduateAtStabilityDays}
              onChange={(e) => onChange({ graduateAtStabilityDays: Number(e.target.value) })}
              className="w-full"
              style={{ accentColor: 'var(--accent)' }}
              aria-label="Flashcard stability in days before a word graduates to known"
            />
          </div>
        </Row>
      </Section>

      <Section title="Flashcards">
        <Row label="Card types">
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {CARD_MODES.map((m) => {
              const on = settings.cardModes.includes(m.id);
              return (
                <Choice
                  key={m.id}
                  label={m.label}
                  selected={on}
                  onSelect={() =>
                    onChange((prev) => {
                      const next = prev.cardModes.includes(m.id)
                        ? prev.cardModes.filter((x) => x !== m.id)
                        : [...prev.cardModes, m.id];
                      // Never leave zero types enabled — a session with no card
                      // front to show would just be a blank screen.
                      return { cardModes: next.length > 0 ? next : prev.cardModes };
                    })
                  }
                />
              );
            })}
          </div>
        </Row>
        <Row label="New cards per day" value={String(settings.newCardsPerDay)}>
          <div className="flex items-center gap-3 px-4 pb-3">
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={settings.newCardsPerDay}
              onChange={(e) => onChange({ newCardsPerDay: Number(e.target.value) })}
              className="w-full"
              style={{ accentColor: 'var(--accent)' }}
              aria-label="How many brand-new flashcards to introduce per day"
            />
          </div>
        </Row>
      </Section>

      <Section title="Storage">
        <Row label="On this device" value={storageInfo} />
      </Section>

      <Section title="About">
        <Row label="Data sources and licences" value="›" onClick={() => setSub('about')} />
      </Section>

      <p className="px-5 py-6 text-[12px]" style={{ color: 'var(--ink-3)' }}>
        读字 Dúzì · phase 2. Flashcards, stats, backup and series arrive with their features.
      </p>
    </Screen>
  );
}

function Choice({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="tap rounded-lg border px-3 text-[14px]"
      style={{
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        background: selected ? 'var(--accent-soft)' : 'transparent',
        color: selected ? 'var(--accent)' : 'var(--ink-2)',
      }}
    >
      {label}
    </button>
  );
}

function Toggle({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="tap relative h-7 w-12 rounded-full transition-colors"
      style={{ background: checked ? 'var(--accent)' : 'var(--border)' }}
    >
      <span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

function PosLegend() {
  const resolvedTheme = useResolvedTheme();
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-4 pb-3">
      {POS_ORDER.map((pos) => (
        <span key={pos} className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ink-2)' }}>
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: posColor(pos, resolvedTheme) }}
            aria-hidden="true"
          />
          {POS_LABELS[pos]}
        </span>
      ))}
    </div>
  );
}
