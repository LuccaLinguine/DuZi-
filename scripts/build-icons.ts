/**
 * Rasterises public/icons/*.svg into the PNG sizes the web app manifest needs.
 *
 * The PNGs are committed, so a normal `npm run build` never needs this. Rerun it
 * only after editing the SVGs. Uses headless Chrome because it is the one SVG
 * rasteriser that is always present on this Mac; any other (rsvg-convert,
 * magick) would do the same job.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ICONS = resolve(import.meta.dirname, '../public/icons');

const jobs: { svg: string; out: string; size: number }[] = [
  { svg: 'icon.svg', out: 'icon-192.png', size: 192 },
  { svg: 'icon.svg', out: 'icon-512.png', size: 512 },
  { svg: 'icon-maskable.svg', out: 'icon-512-maskable.png', size: 512 },
];

if (!existsSync(CHROME)) {
  console.error(`No rasteriser found at ${CHROME}.`);
  console.error('Install rsvg-convert/ImageMagick, or render the SVGs by hand.');
  process.exit(1);
}

for (const { svg, out, size } of jobs) {
  const work = mkdtempSync(join(tmpdir(), 'duzi-icon-'));
  // A page sized exactly to the icon, with the SVG filling it and no margin.
  writeFileSync(
    join(work, 'page.html'),
    `<style>html,body{margin:0;padding:0}img{display:block;width:${size}px;height:${size}px}</style>` +
      `<img src="file://${join(ICONS, svg)}">`,
  );
  execFileSync(
    CHROME,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      `--screenshot=${join(work, 'out.png')}`,
      `--window-size=${size},${size}`,
      `file://${join(work, 'page.html')}`,
    ],
    { stdio: 'ignore' },
  );
  renameSync(join(work, 'out.png'), join(ICONS, out));
  console.log(`${out}  ${size}×${size}`);
}
