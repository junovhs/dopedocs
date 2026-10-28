import { afterAll, beforeAll, expect, test } from 'vitest';
import ts from 'typescript';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { buildPackage } from './built-package.mjs';
import { spawnCommand } from '../scripts/run-command.mjs';

const root = resolve(import.meta.dirname, '..');
const budgets = JSON.parse(readFileSync(join(root, 'tests/reader-weight-budgets.json'), 'utf8'));
const gzip = contents => gzipSync(contents, { level: 9 }).length;
let pkg, packedRoot, measurements, readerAssets;

// npm's tarball is read directly, without installing dependencies or consulting
// stale dist/. Only regular files are needed; archive metadata is skipped.
function unpack(archive, destination) {
    const tar = gunzipSync(readFileSync(archive));
    for (let offset = 0; offset + 512 <= tar.length;) {
        const header = tar.subarray(offset, offset + 512);
        const field = (start, end) => header.subarray(start, end).toString().replace(/\0.*$/s, '');
        const name = [field(345, 500), field(0, 100)].filter(Boolean).join('/');
        if (!name) break;
        const size = parseInt(field(124, 136).trim(), 8) || 0;
        expect(name.startsWith('package/') && !name.split('/').includes('..'), name).toBe(true);
        if (header[156] === 0 || header[156] === 48) {
            const target = join(destination, name.slice('package/'.length));
            mkdirSync(dirname(target), { recursive: true });
            writeFileSync(target, tar.subarray(offset + 512, offset + 512 + size));
        }
        offset += 512 + Math.ceil(size / 512) * 512;
    }
}

// Count each shipped ESM file once, at its own gzip size, as separate responses.
// Fail closed on unresolved/bare imports so new dependencies cannot evade budget.
function moduleGraph(entry) {
    const files = new Map();
    function visit(path) {
        if (files.has(path)) return;
        const contents = readFileSync(join(packedRoot, path), 'utf8');
        files.set(path, contents);
        const source = ts.createSourceFile(path, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        function walk(node) {
            const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
                : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
            if (specifier) {
                expect(ts.isStringLiteral(specifier), `Nonliteral reader import in ${path}`).toBe(true);
                expect(specifier.text.startsWith('.'), `External reader import ${specifier.text} in ${path}`).toBe(true);
                const dependency = posix.normalize(posix.join(posix.dirname(path), specifier.text));
                expect(dependency.startsWith('dist/'), `Reader import escapes dist/: ${dependency}`).toBe(true);
                visit(dependency);
            }
            ts.forEachChild(node, walk);
        }
        walk(source);
    }
    visit(entry);
    return files;
}

beforeAll(async () => {
    pkg = buildPackage();
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    for (const entry of [...manifest.files, 'README.md', 'LICENSE']) {
        // The examples glob is the only wildcard in the package file list.
        const path = entry === 'examples/*.ts' ? 'examples' : entry;
        if (existsSync(join(root, path)) && !['dist', 'styles'].includes(path)) {
            cpSync(join(root, path), join(pkg.scratch, path), { recursive: true });
        }
    }
    const packed = spawnCommand('npm', ['pack', '--ignore-scripts', '--json'], { cwd: pkg.scratch, encoding: 'utf8' });
    expect(packed.status, packed.stdout + packed.stderr).toBe(0);
    packedRoot = join(pkg.scratch, 'unpacked');
    unpack(join(pkg.scratch, JSON.parse(packed.stdout)[0].filename), packedRoot);
    const css = readFileSync(join(packedRoot, 'styles/dopedocs.css'));
    const panel = moduleGraph('dist/panel.js');
    const panelBytes = [...panel.values()].reduce((sum, contents) => sum + gzip(contents), 0);
    readerAssets = new Map(panel);
    readerAssets.set('styles/dopedocs.css', css.toString());
    measurements = [
        { metric: 'readerCssRaw', asset: 'styles/dopedocs.css (raw)', bytes: css.length },
        { metric: 'readerCssGzip', asset: 'styles/dopedocs.css (gzip)', bytes: gzip(css) },
        { metric: 'panelGzip', asset: `panel runtime (${panel.size} ESM files, gzip)`, bytes: panelBytes },
    ];
    const { buildStatic } = await import(pathToFileURL(join(packedRoot, 'dist/static.js')).href);
    let largest = { metric: 'staticPageGzip', asset: '', bytes: 0 };
    for (const name of readdirSync(join(packedRoot, 'examples')).filter(name => name.endsWith('.ts')).sort()) {
        const source = readFileSync(join(packedRoot, 'examples', name), 'utf8');
        const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
        const entry = join(packedRoot, name.replace(/\.ts$/, '.js'));
        writeFileSync(entry, output);
        const { docs, buildOptions = {} } = await import(pathToFileURL(entry).href);
        const tree = buildStatic(docs, {
            ...buildOptions,
            search: true,
            stylesheet: '/docs/dopedocs.css',
            now: new Date('2026-10-18T00:00:00Z'),
        });
        tree['docs/dopedocs.css'] = css.toString();
        for (const [path, contents] of Object.entries(tree)) {
            if (/\.(html|css|js)$/.test(path)) readerAssets.set(`${name}/${path}`, contents);
            if (!path.endsWith('.html')) continue;
            const urls = [...contents.matchAll(/<script\b[^>]*\bsrc="([^"]+)"|<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(match => match[1] ?? match[2]);
            const required = [...new Set(urls.map(url => new URL(url, `https://reader.example/${path}`).pathname.slice(1)))];
            const assets = required.map(asset => {
                expect(tree[asset], `Unmeasured required asset ${asset} on ${name}/${path}`).toBeDefined();
                return [asset, gzip(tree[asset])];
            });
            const bytes = gzip(contents) + assets.reduce((sum, [, size]) => sum + size, 0);
            if (bytes > largest.bytes) {
                const dependencies = assets.map(([asset, size]) => `${asset} (${size} B)`).join(' + ');
                largest = { metric: 'staticPageGzip', asset: `${name}/${path} + ${dependencies} (gzip)`, bytes };
            }
        }
    }
    expect(largest.bytes).toBeGreaterThan(0);
    measurements.push(largest);
}, 30000);

afterAll(() => pkg?.cleanup());

test('packed reader CSS, panel graph and largest built example stay within reviewed budgets', () => {
    const failures = measurements.filter(item => item.bytes > budgets[item.metric].limitBytes);
    console.info(measurements.map(item => `${item.asset}: ${item.bytes} B / ${budgets[item.metric].limitBytes} B`).join('\n'));
    const messages = failures.map(item => {
        const limit = budgets[item.metric].limitBytes;
        return `${item.asset}: ${item.bytes} B exceeds ${limit} B budget by ${item.bytes - limit} B`;
    });
    expect(messages, 'Reader weight budget exceeded; review tests/reader-weight-budgets.json deliberately').toEqual([]);
});

test('reader output excludes Studio and development-only font tooling', () => {
    for (const [asset, contents] of readerAssets) {
        expect(asset, `Development module shipped to reader: ${asset}`).not.toMatch(/(?:studio[^/]*|fonts|font-fallback|font-features)\.[jt]s$/i);
        const tooling = /studio(?:-client|-fonts|-palettes)?\.[jt]s|fontkit|wawoff2|api\.fontsource\.org|fonts\.googleapis\.com|fonts\.gstatic\.com|\/__dopedocs\/studio|(?:from\s*|import\s*\()\s*["'][^"']*(?:fonts|font-fallback|font-features)\.js/i;
        const leak = contents.match(tooling);
        expect(leak === null, `Development tooling ${leak?.[0]} in reader asset ${asset}`).toBe(true);
    }
});
