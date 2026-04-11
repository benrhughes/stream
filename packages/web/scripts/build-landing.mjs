// Generates packages/web/public/about/ from the landing template before
// Vite runs. Vite's public dir is copied verbatim into dist, so dropping
// files into public/about/ is all we need to make nginx serve them at
// /about/. Version is substituted from packages/web/package.json so the
// footer cannot drift out of sync with releases.
//
// Run via `npm run prebuild` in packages/web (wired up in package.json).

import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here     = dirname(fileURLToPath(import.meta.url));
const pkgRoot  = resolve(here, '..');
const landing  = resolve(pkgRoot, 'landing');
const outDir   = resolve(pkgRoot, 'public', 'about');

const pkg      = JSON.parse(await readFile(resolve(pkgRoot, 'package.json'), 'utf8'));
const template = await readFile(resolve(landing, 'index.html'), 'utf8');

if (!pkg.version) {
  throw new Error('packages/web/package.json has no "version" field');
}
if (!template.includes('__STREAM_VERSION__')) {
  throw new Error('landing/index.html has no __STREAM_VERSION__ placeholder');
}

await mkdir(outDir, { recursive: true });
await writeFile(
  resolve(outDir, 'index.html'),
  template.replaceAll('__STREAM_VERSION__', pkg.version),
);
await copyFile(resolve(landing, 'og-image.png'), resolve(outDir, 'og-image.png'));

console.log(`[build-landing] wrote public/about/ at v${pkg.version}`);
