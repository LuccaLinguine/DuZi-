/**
 * Paste-your-own-text (spec section 8): paste Chinese text, read it
 * immediately with local segmentation, optionally queue it for a full
 * authored pass on the next `/stories` batch.
 */
import { useState } from 'react';
import { importPastedText } from '../db/texts.ts';
import { useHsk } from '../hooks/useHsk.ts';
import { LEVEL_LIST, type LevelId } from '../lib/levels.ts';
import { Screen, Section } from '../components/Screen.tsx';

interface Props {
  defaultLevel: LevelId;
  onCancel: () => void;
  onImported: (storyId: string) => void;
}

export function ImportText({ defaultLevel, onCancel, onImported }: Props) {
  const [title, setTitle] = useState('');
  const [raw, setRaw] = useState('');
  const [level, setLevel] = useState<LevelId>(defaultLevel);
  const [enrich, setEnrich] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hsk = useHsk();

  const canImport = raw.trim().length > 0 && !importing;

  const handleImport = async () => {
    if (!hsk) {
      setError('Still loading the dictionary — try again in a moment.');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const id = await importPastedText({ title: title.trim(), raw, level, enrich, hsk });
      onImported(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong importing that text.');
      setImporting(false);
    }
  };

  return (
    <Screen
      title="Import text"
      actions={
        <button type="button" onClick={onCancel} className="tap -mr-2 px-2 text-[15px]" style={{ color: 'var(--accent)' }}>
          Cancel
        </button>
      }
    >
      <Section title="Title (optional)">
        <div className="px-4 py-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 微博新闻, a WeChat message…"
            className="w-full rounded-lg border px-3 py-2 text-[15px]"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          />
        </div>
      </Section>

      <Section title="Text">
        <div className="px-4 py-3">
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="粘贴中文文本…"
            rows={10}
            className="han w-full resize-y rounded-lg border p-3 text-[17px] leading-relaxed"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          />
        </div>
      </Section>

      <Section title="Level">
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {LEVEL_LIST.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLevel(l.id)}
              aria-pressed={level === l.id}
              className="tap rounded-lg border px-3 text-[14px]"
              style={{
                borderColor: level === l.id ? 'var(--accent)' : 'var(--border)',
                background: level === l.id ? 'var(--accent-soft)' : 'transparent',
                color: level === l.id ? 'var(--accent)' : 'var(--ink-2)',
              }}
            >
              {l.name}
            </button>
          ))}
        </div>
      </Section>

      <Section>
        <button
          type="button"
          role="switch"
          aria-checked={enrich}
          onClick={() => setEnrich((v) => !v)}
          className="tap flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span>
            <span className="block text-[15px]">Enrich on next batch</span>
            <span className="block text-[12px]" style={{ color: 'var(--ink-3)' }}>
              Adds this text to your profile so /stories can replace it with proper pinyin,
              translations and comprehension questions — same id, progress kept.
            </span>
          </span>
          <span
            className="relative ml-3 h-7 w-12 shrink-0 rounded-full transition-colors"
            style={{ background: enrich ? 'var(--accent)' : 'var(--border)' }}
          >
            <span
              className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
              style={{ transform: enrich ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </span>
        </button>
      </Section>

      {error && (
        <p className="px-5 py-2 text-[13px]" style={{ color: 'var(--accent)' }}>
          {error}
        </p>
      )}

      <div className="px-4 py-3">
        <button
          type="button"
          disabled={!canImport}
          onClick={() => void handleImport()}
          className="tap w-full rounded-lg text-[16px] font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {importing ? 'Segmenting…' : 'Import and read'}
        </button>
      </div>
      <div className="h-8" />
    </Screen>
  );
}
