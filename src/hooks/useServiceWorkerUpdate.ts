/**
 * Bridges vite-plugin-pwa's update lifecycle into React via its official
 * React integration. `registerType: 'prompt'` (vite.config.ts) means a new
 * deploy downloads in the background but the waiting service worker never
 * activates on its own — without a prompt the user can act on, a device can
 * be stuck serving an old cached manifest indefinitely, even with the page
 * open and online, since nothing ever tells the new worker to take over.
 *
 * Also checks for an update every hour while the tab stays open: the
 * browser only checks on its own at initial load/navigation, so a tab left
 * open for a long session would otherwise never notice a new deploy at all.
 */
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function useServiceWorkerUpdate(): { needsRefresh: boolean; applyUpdate: () => void } {
  const {
    needRefresh: [needsRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => void registration.update(), UPDATE_CHECK_INTERVAL_MS);
    },
    onOfflineReady() {
      console.info('[duzi] ready to work offline.');
    },
  });

  return { needsRefresh, applyUpdate: () => void updateServiceWorker(true) };
}
