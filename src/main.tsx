import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.tsx';
import './index.css';

/**
 * `registerType: 'prompt'` means a new deploy waits rather than reloading
 * mid-read. Nothing is on screen for it yet, so for now it activates on the
 * next cold launch; the update prompt lands with the Settings screen.
 */
registerSW({
  onNeedRefresh() {
    console.info('[duzi] a new version is ready; it will load on the next launch.');
  },
  onOfflineReady() {
    console.info('[duzi] ready to work offline.');
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
