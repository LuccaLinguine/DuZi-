import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, requestPersistence } from './db/index.ts';
import { TabBar, type Tab } from './components/TabBar.tsx';
import { Toast } from './components/Toast.tsx';
import { Library } from './screens/Library.tsx';
import { Reader } from './screens/Reader.tsx';
import { Onboarding } from './screens/Onboarding.tsx';
import { Placeholder } from './screens/Placeholder.tsx';
import { Requests } from './screens/Requests.tsx';
import { Review } from './screens/Review.tsx';
import { Settings } from './screens/Settings.tsx';
import { useSettings } from './hooks/useSettings.ts';
import { useContentSync, syncMessage } from './hooks/useContentSync.ts';
import { countDue } from './lib/review.ts';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate.ts';

export function App() {
  const { settings, update, ready } = useSettings();
  const [tab, setTab] = useState<Tab>('library');
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState('—');
  const { needsRefresh, applyUpdate } = useServiceWorkerUpdate();

  // Only sync once settings have loaded, so the sync can record lastSyncAt
  // against the real stored row rather than the defaults.
  const { result, error } = useContentSync(ready);

  // Re-evaluated on a timer as well as on data change, so a card becoming due
  // while the app sits open eventually shows up in the badge.
  const [dueTick, setDueTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDueTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Deliberately scans the whole (personal-scale) cards table rather than a
  // `where('due').belowOrEqual(now)` range query: Dexie's liveQuery tracks the
  // key range a query touched, so a card saved with a due time *after* that
  // bound falls outside the tracked range and never invalidates it — the badge
  // would simply never appear. Filtering in JS keeps every write observable.
  const dueCount = useLiveQuery(
    async () => countDue(await db.cards.toArray(), Date.now()),
    [dueTick],
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

  // A new deploy means this tab is running stale code against a stale
  // cached manifest — new stories, fixes, everything — until the user acts
  // on this. It has to reach them no matter which screen is up, so it's
  // layered on top of every branch below rather than living inside one.
  const updatePrompt = needsRefresh ? (
    <Toast
      message="A new version is ready."
      action={{ label: 'Reload', onClick: applyUpdate }}
      onDone={() => {}}
      position="high"
    />
  ) : null;

  const wrap = (node: ReactNode) => (
    <>
      {node}
      {updatePrompt}
    </>
  );

  if (!ready) {
    return wrap(<div className="flex h-full items-center justify-center" style={{ background: 'var(--bg)' }} />);
  }

  if (!settings.onboarded) {
    return wrap(
      <Onboarding
        initialLevel={settings.defaultLevel}
        onFinish={(level) => update({ defaultLevel: level, onboarded: true })}
      />,
    );
  }

  if (openStoryId) {
    return wrap(
      <Reader
        storyId={openStoryId}
        settings={settings}
        onUpdateSettings={update}
        onBack={() => setOpenStoryId(null)}
      />,
    );
  }

  return wrap(
    <div className="flex h-full flex-col">
      <main className="flex min-h-0 flex-1 flex-col">
        {tab === 'library' && <Library onGoTo={setTab} onOpenStory={setOpenStoryId} />}
        {tab === 'requests' && <Requests defaultLevel={settings.defaultLevel} />}
        {tab === 'review' && <Review settings={settings} />}
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
    </div>,
  );
}
