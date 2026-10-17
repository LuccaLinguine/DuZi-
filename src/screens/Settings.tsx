/**
 * Phase 1 carries the parts of spec §10 that already have something to show:
 * theme, script, font size, and the About screen with data attribution.
 * Thresholds, voices, card modes and backup land with their features.
 */
import { useState } from 'react';
import type { Settings as SettingsShape, ThemeMode, Script } from '../db/types.ts';
import { Screen, Section, Row } from '../components/Screen.tsx';
import { About } from './About.tsx';

interface Props {
  settings: SettingsShape;
  onChange: (patch: Partial<SettingsShape>) => void;
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

export function Settings({ settings, onChange, storageInfo }: Props) {
  const [showAbout, setShowAbout] = useState(false);

  if (showAbout) return <About onBack={() => setShowAbout(false)} />;

  return (
    <Screen title="Settings">
      <Section title="Reading">
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
      </Section>

      <Section title="Storage">
        <Row label="On this device" value={storageInfo} />
      </Section>

      <Section title="About">
        <Row label="Data sources and licences" value="›" onClick={() => setShowAbout(true)} />
      </Section>

      <p className="px-5 py-6 text-[12px]" style={{ color: 'var(--ink-3)' }}>
        读字 Dúzì · phase 1. Flashcards, stats, backup and the word-memory thresholds arrive with
        their features.
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
