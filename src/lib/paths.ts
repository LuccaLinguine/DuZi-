/**
 * URLs for the bundled data and content. Vite rewrites `import.meta.env.BASE_URL`
 * to the deploy's base path, which is `/duzi/` on GitHub Pages — so nothing may
 * hard-code a leading slash.
 */
const BASE = import.meta.env.BASE_URL;

export function dataUrl(path: string): string {
  return `${BASE}data/${path}`;
}

export function contentUrl(path: string): string {
  return `${BASE}content/${path}`;
}

export const MANIFEST_URL = contentUrl('index.json');
