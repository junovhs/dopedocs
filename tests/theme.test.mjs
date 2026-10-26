import { afterAll, beforeAll, expect, test } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPackage } from './built-package.mjs';
let pkg, host, theme;
beforeAll(async () => {
    pkg = buildPackage();
    host = join(pkg.scratch, 'host');
    mkdirSync(host);
    theme = await import(pathToFileURL(join(pkg.scratch, 'dist/theme.js')).href);
}, 30000);
afterAll(() => pkg?.cleanup());
const fixture = '/* our theme */\r\n:root {\r\n  /* keep accent comment */\r\n  --dd-accent : #123;\r\n  --dd-bg: var(--brand, white); /* keep */\r\n}\r\n.custom::before { content: "}; --dd-accent: untouched"; }\r\n@media (prefers-color-scheme: dark) { :root { --dd-accent: pink; } }\r\n';

test('built theme CLI changes only the requested declaration and supports list/get/unset', () => {
    const path = join(host, 'docs-theme.css');
    writeFileSync(path, fixture);
    const set = pkg.run(['theme', 'set', 'accent', '#ff6a2b'], host);
    expect(set.status, set.stderr).toBe(0);
    expect(readFileSync(path, 'utf8')).toBe(fixture.replace('#123', '#ff6a2b'));
    const get = pkg.run(['theme', 'get', '--dd-accent'], host);
    expect(get.status).toBe(0);
    expect(get.stdout.trim()).toBe('#ff6a2b');
    expect(pkg.run(['theme', 'list'], host).stdout).toContain('--dd-accent: #ff6a2b');
    expect(pkg.run(['theme', 'unset', 'accent'], host).status).toBe(0);
    expect(readFileSync(path, 'utf8')).toBe(fixture.replace('--dd-accent : #123;', ''));
});

test('creates a missing file/block, warns on unknown tokens, and rejects injected rules without writing', () => {
    const args = ['--file', 'nested/theme.css'];
    expect(pkg.run(['theme', 'unset', 'accent', ...args], host).status).toBe(0);
    expect(existsSync(join(host, 'nested/theme.css'))).toBe(false);
    expect(pkg.run(['theme', 'set', 'accent', 'var(--brand, #fff)', ...args], host).status).toBe(0);
    const path = join(host, 'nested/theme.css');
    const before = readFileSync(path, 'utf8');
    expect(before).toContain('/* dopedocs theme */');
    const invalid = pkg.run(['theme', 'set', 'accent', 'red; } .evil { color: red', ...args], host);
    expect(invalid.status).toBe(1);
    expect(readFileSync(path, 'utf8')).toBe(before);
    const unknown = pkg.run(['theme', 'set', 'future-token', 'blue', ...args], host);
    expect(unknown.status).toBe(0);
    expect(unknown.stderr).toContain('unknown dopedocs token --dd-future-token');
    expect(pkg.run(['theme', 'get', 'not-set', ...args], host).status).toBe(1);
    expect(pkg.run(['theme', 'set', 'bad;name', 'red'], host).status).toBe(1);
});

test('module handles BOMs, missing semicolons, duplicate declarations and managed root selection', () => {
    const css = '\uFEFF:root { --dd-accent: red !important; --dd-accent: blue; /* keep */ }';
    expect(theme.parseTheme(css)['--dd-accent']).toBe('red !important');
    expect(theme.updateTheme(css, 'accent', 'green !important')).toBe(css.replace('red', 'green'));
    expect(theme.updateTheme(css, 'accent')).toBe('\uFEFF:root {   /* keep */ }');
    expect(theme.parseTheme(theme.updateTheme(':root { --dd-bg: white }', 'accent', 'red'))).toEqual({ '--dd-bg': 'white', '--dd-accent': 'red' });
    const managed = ':root { /* dopedocs theme */ --dd-accent: red; }\n:root { --dd-accent: blue; }';
    expect(theme.updateTheme(managed, 'accent', 'green')).toBe(managed.replace('red', 'green'));
});
