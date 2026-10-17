import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, requestPersistence } from './db/index.ts';
import { TabBar, type Tab } from './components/TabBar.tsx';
import { Toast } from './components/Toast.tsx';
import { Library } from './screens/Library.tsx';
import { Reader } from './screens/Reader.tsx';
import { Onboarding } from './screens/Onboarding.tsx';
import { Placeholder } from './screens/Placeholder.tsx';
import { Requests } from './screens/Requests.tsx';
import { Settings } from './screens/Settings.tsx';
import { useSettings } from './hooks/useSettings.ts';
import { useContentSync, syncMessage } from './hooks/useContentSync.ts';

export function App() {
  const { settings, update, ready } = useSettings();
  const [tab, setTab] = useState<Tab>('library');
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState('—');

  // Only sync once settings have loaded, so the sync can record lastSyncAt
  // against the real stored row rather than the defaults.
  const { result, error } = useContentSync(ready);

  const dueCount = useLiveQuery(
    () => db.cards.where('due').belowOrEqual(Date.now()).count(),
    [],
    0,
  );

  useEffect(() => {
    void (async () => {
      const persisted = await requestPersistence();
      if (!navigator.storage?.estimate) {
        setStorageInfo(persisted ? 'Persistent' : '—');
        return;
      }
      const { usage } = await navigator.storage.estimate();
      const mb = usage == null ? '—' : `${(usage / 1024 / 1024).toFixed(1)} MB`;
      setStorageInfo(persisted ? `${mb} · persistent` : mb);
    })();
  }, []);

  useEffect(() => {
    const message = syncMessage(result);
    if (message) setToast(message);
  }, [result]);

  useEffect(() => {
    if (result?.rejected.length) {
      for (const r of result.rejected) {
        console.warn(`[duzi] story ${r.id} was rejected:`, r.issues);
      }
    }
    if (error) console.warn('[duzi] content sync skipped:', error);
  }, [result, error]);

  const clearToast = useCallback(() => setToast(null), []);

  if (!ready) {
    return <div className="flex h-full items-center justify-center" style={{ background: 'var(--bg)' }} />;
  }

  if (!settings.onboarded) {
    return (
      <Onboarding
        initialLevel={settings.defaultLevel}
        onFinish={(level) => update({ defaultLevel: level, onboarded: true })}
      />
    );
  }

  if (openStoryId) {
    return (
      <Reader
        storyId={openStoryId}
        settings={settings}
        onUpdateSettings={update}
        onBack={() => setOpenStoryId(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <main className="flex min-h-0 flex-1 flex-col">
        {tab === 'library' && <Library onGoTo={setTab} onOpenStory={setOpenStoryId} />}
        {tab === 'requests' && <Requests defaultLevel={settings.defaultLevel} />}
        {tab === 'review' && (
          <Placeholder
            title="Review"
            icon="记"
            phase="Phase 5"
            body="Words you save while reading become flashcards here, scheduled with FSRS."
          />
        )}
        {tab === 'stats' && (
          <Placeholder
            title="Stats"
            icon="数"
            phase="Phase 6"
            body="Characters read, words known, and your daily streak."
          />
        )}
        {tab === 'settings' && (
          <Settings settings={settings} onChange={update} storageInfo={storageInfo} />
        )}
      </main>
      <TabBar active={tab} onChange={setTab} dueCount={dueCount} />
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  );
}
