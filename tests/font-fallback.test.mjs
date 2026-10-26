import { afterAll, beforeAll, expect, test } from 'vitest';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { parse } from 'postcss';
import { buildPackage } from './built-package.mjs';
const fixture = dirname(createRequire(import.meta.url).resolve('@fontsource/fraunces/package.json'));
let pkg, host, input;
beforeAll(() => {
    pkg = buildPackage(); host = join(pkg.scratch, 'host'); mkdirSync(host);
    input = join(host, 'font.woff2');
    cpSync(join(fixture, 'files/fraunces-latin-400-normal.woff2'), input);
    cpSync(join(fixture, 'LICENSE'), join(host, 'LICENSE'));
    writeFileSync(join(host, 'docs-theme.css'), ':root { --dd-display: var(--brand-font, serif); }\n.keep { color: purple; }\n');
}, 30000);
afterAll(() => pkg?.cleanup());
function faces(css) {
    const result = [];
    parse(css).walkAtRules('font-face', rule => {
        const values = {}; rule.walkDecls(decl => { values[decl.prop] = decl.value; }); result.push(values);
    });
    return result;
}
test('built fonts add computes fallback overrides from a real fixture and places it ahead of generic fonts', async () => {
    const run = await pkg.runAsync(['fonts', 'add', input, '--role', 'display'], host);
    expect(run.status, run.stderr).toBe(0);
    const css = readFileSync(join(host, 'docs-theme.css'), 'utf8');
    const fallback = faces(css).find(face => face['font-family'] === '"Fraunces Fallback Arial"');
    expect(fallback).toBeDefined();
    expect(fallback).toMatchObject({
        src: 'local("Arial"), local("ArialMT")', 'font-weight': '400', 'font-style': 'normal',
        'size-adjust': '92.9507%', 'ascent-override': '105.2171%', 'descent-override': '27.4339%', 'line-gap-override': '0%',
    });
    expect(css).toContain('--dd-display: "Fraunces", "Fraunces Fallback Arial", var(--brand-font, serif);');
    expect(css).toContain('.keep { color: purple; }');
    // The adjusted fallback em square reconstructs the fixture's 1956/2000 ascent.
    expect(parseFloat(fallback['size-adjust']) / 100 * parseFloat(fallback['ascent-override']) / 100).toBeCloseTo(1956 / 2000, 5);
    expect((await pkg.runAsync(['fonts', 'add', input, '--role', 'display'], host)).status).toBe(0);
    const repeated = readFileSync(join(host, 'docs-theme.css'), 'utf8');
    expect(repeated.match(/--dd-display:.*Fallback Arial/g)).toHaveLength(1);
    expect(faces(repeated).filter(face => face['font-family'] === '"Fraunces Fallback Arial"')).toHaveLength(1);
}, 20000);
test('mono uses a local monospaced fallback and remove cleans both stack entries', async () => {
    const run = await pkg.runAsync(['fonts', 'add', input, '--role', 'mono'], host);
    expect(run.status, run.stderr).toBe(0);
    const css = readFileSync(join(host, 'docs-theme.css'), 'utf8');
    const fallback = faces(css).find(face => face['font-family'] === '"Fraunces Fallback Courier New"');
    expect(fallback.src).toBe('local("Courier New"), local("CourierNewPSMT")');
    expect(faces(css).some(face => face['font-family'] === '"Fraunces Fallback Arial"')).toBe(true);
    expect(css).toContain('--dd-mono: "Fraunces", "Fraunces Fallback Courier New", monospace;');
    expect(pkg.run(['fonts', 'remove', 'Fraunces'], host).status).toBe(0);
    const removed = readFileSync(join(host, 'docs-theme.css'), 'utf8');
    expect(removed).not.toContain('Fraunces');
    expect(removed).toContain('--dd-display: var(--brand-font, serif);');
    expect(removed).toContain('--dd-mono: monospace;');
}, 20000);
