import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const font = dirname(require.resolve('@fontsource-variable/inter/package.json'));
await mkdir('public/fonts', { recursive: true });
await copyFile(join(font, 'files/inter-latin-wght-normal.woff2'), 'public/fonts/inter-latin-wght-normal.woff2');
await copyFile(join(font, 'LICENSE'), 'public/fonts/Inter-LICENSE.txt');

// The app links the same engine sheet as the static pages, before its aliases.
await mkdir('public/docs', { recursive: true });
await copyFile(require.resolve('dopedocs/styles.css'), 'public/docs/dopedocs.css');
