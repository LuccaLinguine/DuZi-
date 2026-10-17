import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so the app build doesn't pull in the PWA
// and Tailwind plugins just to run unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
