/** Attribution for the bundled data, as CC-CEDICT's licence requires. */
import { useEffect, useState } from 'react';
import { Screen, Section, Row } from '../components/Screen.tsx';
import { dataUrl } from '../lib/paths.ts';

interface Meta {
  source: string;
  license: string;
  url: string;
  version?: string;
  entries?: number;
  headwords?: number;
  note?: string;
}

export function About({ onBack }: { onBack: () => void }) {
  const [cedict, setCedict] = useState<Meta | null>(null);
  const [hsk, setHsk] = useState<Meta | null>(null);

  useEffect(() => {
    // Both files are precached, so this resolves offline too.
    void fetch(dataUrl('cedict/meta.json')).then((r) => (r.ok ? r.json() : null)).then(setCedict).catch(() => {});
    void fetch(dataUrl('hsk/meta.json')).then((r) => (r.ok ? r.json() : null)).then(setHsk).catch(() => {});
  }, []);

  return (
    <Screen
      title="About"
      actions={
        <button
          type="button"
          onClick={onBack}
          className="tap -mr-2 px-2 text-[15px]"
          style={{ color: 'var(--accent)' }}
        >
          Done
        </button>
      }
    >
      <div className="px-5 pt-5">
        <p className="han-serif text-3xl">读字</p>
        <p className="mt-1 text-[14px]" style={{ color: 'var(--ink-2)' }}>
          Dúzì — a personal graded Chinese reader. Everything lives on this device: no account, no
          server, no API calls.
        </p>
      </div>

      <Section title="Dictionary">
        <Row label="CC-CEDICT" value={cedict?.version ?? '—'} />
        <Row label="Licence" value={cedict?.license ?? 'CC BY-SA 4.0'} />
        <Row label="Entries" value={cedict ? cedict.entries?.toLocaleString() : '—'} />
        <div className="px-4 py-3 text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          Chinese–English dictionary data from the CC-CEDICT project, used under the Creative
          Commons Attribution-ShareAlike 4.0 licence.{' '}
          <a
            href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent)' }}
          >
            mdbg.net
          </a>
        </div>
      </Section>

      <Section title="Word lists">
        <Row label="HSK 2.0 and 3.0" value={hsk?.license ?? 'MIT'} />
        <div className="px-4 py-3 text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          HSK vocabulary from{' '}
          <a
            href="https://github.com/drkameleon/complete-hsk-vocabulary"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent)' }}
          >
            complete-hsk-vocabulary
          </a>
          , MIT licensed. {hsk?.note}
        </div>
      </Section>

      <Section title="Built with">
        <Row label="pinyin-pro" value="MIT" />
        <Row label="opencc-js" value="Apache-2.0" />
        <Row label="ts-fsrs" value="MIT" />
        <Row label="Dexie" value="Apache-2.0" />
      </Section>

      <div className="h-6" />
    </Screen>
  );
}
