import { afterAll, beforeAll, expect, test } from 'vitest';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decompress } from 'wawoff2';
import { create } from 'fontkit';
import { buildPackage } from './built-package.mjs';
const require = createRequire(import.meta.url);
const fixture = dirname(require.resolve('@fontsource/fraunces/package.json'));
let pkg, host, server, source, buildStatic;
const requests = [];
beforeAll(async () => {
    pkg = buildPackage();
    host = join(pkg.scratch, 'host'); mkdirSync(host);
    ({ buildStatic } = await import(pathToFileURL(join(pkg.scratch, 'dist/static.js')).href));
    server = createServer((req, res) => {
        requests.push(req.url);
        const path = req.url.replace(/^\/@fontsource\/fraunces@(?:latest|5\.3\.0)\//, '');
        if (path === 'package.json') res.end(JSON.stringify({ version: '5.3.0' }));
        else if (['LICENSE', '400.css', '600.css', '400-italic.css', 'files/fraunces-latin-400-normal.woff2', 'files/fraunces-latin-600-normal.woff2', 'files/fraunces-latin-400-italic.woff2'].includes(path)) res.end(readFileSync(join(fixture, path)));
        else { res.statusCode = 404; res.end('not found'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    source = `http://127.0.0.1:${server.address().port}`;
}, 30000);
afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); pkg?.cleanup(); });

test('built CLI installs only selected Fontsource faces and licence, renders local references, lists and removes', async () => {
    const theme = join(host, 'docs-theme.css');
    const original = '/* host-owned */\n.custom { color: purple; }\n';
    writeFileSync(theme, original);
    const result = await pkg.runAsync(['fonts', 'add', 'Fraunces', '--weights', '400,600', '--role', 'display', '--source', source], host);
    expect(result.status, result.stderr).toBe(0);
    const css = readFileSync(theme, 'utf8');
    expect(css.startsWith(original)).toBe(true);
    expect(css).toContain('--dd-display: "Fraunces", "Fraunces Fallback Arial", var(--dd-sans, sans-serif)');
    expect(css.match(/font-display: swap/g)).toHaveLength(2);
    expect(css.match(/unicode-range:/g)).toHaveLength(4);
    const folder = join(host, 'public/fonts/dopedocs/fraunces');
    expect(readdirSync(folder).sort()).toEqual(['400-normal.woff2', '600-normal.woff2', 'LICENSE.txt']);
    expect(readFileSync(join(folder, 'LICENSE.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE');
    expect(requests.filter(path => path.endsWith('.woff2')).sort()).toEqual(['/\u0040fontsource/fraunces@5.3.0/files/fraunces-latin-400-normal.woff2', '/\u0040fontsource/fraunces@5.3.0/files/fraunces-latin-600-normal.woff2']);
    expect(pkg.run(['fonts', 'list'], host).stdout).toContain('fraunces\tFraunces');
    const docs = { entity: { name: 'Garden', url: 'https://garden.example', notToBeConfusedWith: [] }, title: 'Garden guide', lead: '', facts: {}, sections: [{ id: 'visit', title: 'Visit', question: 'When can I visit?', answer: 'Garden opens every day.', blocks: [] }] };
    const tree = buildStatic(docs, { stylesheet: '/docs-theme.css', now: new Date('2026-10-18') });
    expect(tree['docs/index.html']).toContain('href="/docs-theme.css"');
    expect(Object.values(tree).join('\n') + css).not.toMatch(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|127\.0\.0\.1/);
    for (const match of css.matchAll(/src: url\("([^"]+)"\)/g)) expect(existsSync(join(host, 'public', match[1]))).toBe(true);
    expect(pkg.run(['fonts', 'remove', 'Fraunces'], host).status).toBe(0);
    expect(existsSync(folder)).toBe(false);
    expect(readFileSync(theme, 'utf8')).toContain(original);
    expect(readFileSync(theme, 'utf8')).not.toContain('"Fraunces"');
    expect(pkg.run(['fonts', 'list'], host).stdout).toBe('');
}, 20000);

test('converts a local TTF, copies a WOFF2, preserves old faces on repeat adds, and refuses missing licences', async () => {
    const local = join(host, 'input'); mkdirSync(local);
    const woff2 = readFileSync(join(fixture, 'files/fraunces-latin-400-normal.woff2'));
    const ttf = await decompress(woff2);
    writeFileSync(join(local, 'font.ttf'), ttf);
    cpSync(join(fixture, 'LICENSE'), join(local, 'OFL.txt'));
    let result = await pkg.runAsync(['fonts', 'add', join(local, 'font.ttf'), '--role', 'body'], host);
    expect(result.status, result.stderr).toBe(0);
    const output = join(host, 'public/fonts/dopedocs/fraunces/400-normal.woff2');
    expect(readFileSync(output).subarray(0, 4).toString()).toBe('wOF2');
    expect(create(readFileSync(output)).familyName).toBe('Fraunces');
    cpSync(join(fixture, 'files/fraunces-latin-600-normal.woff2'), join(local, 'font.woff2'));
    result = await pkg.runAsync(['fonts', 'add', join(local, 'font.woff2'), '--weights', '600', '--role', 'body'], host);
    expect(result.status, result.stderr).toBe(0);
    const css = readFileSync(join(host, 'docs-theme.css'), 'utf8');
    expect(css).toContain('font-weight: 400;'); expect(css).toContain('font-weight: 600;');
    expect(readFileSync(join(host, 'public/fonts/dopedocs/fraunces/600-normal.woff2'))).toEqual(readFileSync(join(local, 'font.woff2')));
    const noLicense = join(host, 'unlicensed.woff2'); writeFileSync(noLicense, woff2);
    result = await pkg.runAsync(['fonts', 'add', noLicense], host);
    expect(result.status).toBe(1); expect(result.stderr).toContain('licence');
    expect(readFileSync(join(host, 'docs-theme.css'), 'utf8')).toBe(css);
}, 20000);

test('invalid selections and unavailable subsets fail without changing host CSS', async () => {
    const path = join(host, 'docs-theme.css'), before = readFileSync(path, 'utf8');
    for (const args of [['--weights', '0'], ['--weights', 'nope'], ['--role', 'wrong'], ['--subset', 'not-found']]) {
        const result = await pkg.runAsync(['fonts', 'add', 'Fraunces', ...args, '--source', source], host);
        expect(result.status, result.stdout).toBe(1);
        expect(readFileSync(path, 'utf8')).toBe(before);
    }
}, 20000);


test('italic selection adds a separate face without dropping normal faces', async () => {
    const result = await pkg.runAsync(['fonts', 'add', 'Fraunces', '--italic', '--role', 'display', '--source', source], host);
    expect(result.status, result.stderr).toBe(0);
    const css = readFileSync(join(host, 'docs-theme.css'), 'utf8');
    expect(css).toContain('font-style: italic;');
    expect(css).toContain('font-style: normal;');
    expect(existsSync(join(host, 'public/fonts/dopedocs/fraunces/400-italic.woff2'))).toBe(true);
}, 20000);
