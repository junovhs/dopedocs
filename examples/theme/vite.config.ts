import { defineConfig } from 'vite';
import { dopedocs } from 'dopedocs/vite';
import { docs } from './docs';
export default defineConfig({ plugins: [dopedocs({ docs, stylesheet: [true, '/docs-theme.css'], articleType: 'Article', now: new Date('2026-10-18') })] });
