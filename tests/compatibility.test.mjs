import { afterAll, beforeAll, expect, test } from 'vitest';
import ts from 'typescript';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnCommand } from '../scripts/run-command.mjs';

const root = resolve(import.meta.dirname, '..');
const baseline = join(root, 'tests/compatibility');
const read = path => readFileSync(path, 'utf8');
const names = (text, pattern) => [...new Set(text.match(pattern) ?? [])].sort();
let scratch;
let surface;
let trees;

beforeAll(async () => {
    scratch = mkdtempSync(join(tmpdir(), 'dopedocs-compatibility-'));
    const pkg = JSON.parse(read(join(root, 'package.json')));
    // Build afresh: npm test must never inspect stale declarations in dist/.
    const build = spawnCommand(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
        '-p', 'tsconfig.build.json', '--outDir', join(scratch, 'dist')], { cwd: root, encoding: 'utf8' });
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    writeFileSync(join(scratch, 'package.json'), JSON.stringify(pkg));

    const publicTypes = Object.values(pkg.exports).flatMap(entry => typeof entry === 'object' && entry.types ? [join(scratch, entry.types)] : []);
    const program = ts.createProgram(publicTypes, { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: true });
    const checker = program.getTypeChecker();
    const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
    const exports = {};
    for (const [path, entry] of Object.entries(pkg.exports)) {
        if (typeof entry !== 'object' || !entry.types) continue;
        const source = program.getSourceFile(join(scratch, entry.types));
        exports[path] = checker.getExportsOfModule(checker.getSymbolAtLocation(source)).map(symbol => symbol.name).sort();
    }
    // Follow the declarations reachable from public entrypoints, including schema,
    // options and referenced helper types. Comment-only edits do not churn the API.
    const declarations = Object.fromEntries(program.getSourceFiles()
        .filter(source => {
            const path = relative(join(scratch, 'dist'), source.fileName);
            return !path.startsWith('..') && !isAbsolute(path);
        })
        .sort((a, b) => a.fileName.localeCompare(b.fileName))
        .map(source => [relative(scratch, source.fileName).replaceAll('\\', '/'), printer.printFile(source)]));
    const css = readdirSync(join(root, 'styles')).filter(name => name.endsWith('.css')).map(name => read(join(root, 'styles', name))).join('\n');
    const documented = read(join(root, 'styles/TOKENS.md'));
    const javascript = readdirSync(join(scratch, 'dist')).filter(name => name.endsWith('.js')).map(name => read(join(scratch, 'dist', name))).join('\n');
    surface = {
        packageExports: pkg.exports,
        exportedNames: exports,
        declarations,
        bins: pkg.bin,
        documentedTokens: names(documented, /--dd-[a-z0-9-]+/g),
        stylesheetTokens: names(css, /--dd-[a-z0-9-]+/g),
        stylesheetClasses: names(css, /\bdd-[a-z0-9_-]+/g),
        runtimeClasses: names(javascript, /\bdd-[a-z0-9_-]+/g),
    };
    const { buildStatic } = await import(pathToFileURL(join(scratch, 'dist/static.js')).href);
    trees = {};
    for (const [name, source] of [['user-manual', 'examples/user-manual.ts'], ['theme', 'examples/theme/docs.ts']]) {
        const output = ts.transpileModule(read(join(root, source)), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
        const entry = join(scratch, `${name}.js`);
        writeFileSync(entry, output);
        const { docs, buildOptions = {} } = await import(pathToFileURL(entry).href);
        // Match the shipped theme's build settings; fix time to avoid review-age churn.
        const options = name === 'theme' ? { stylesheet: ['/docs/dopedocs.css', '/docs-theme.css'], articleType: 'Article' } : buildOptions;
        trees[name] = buildStatic(docs, { ...options, now: new Date('2026-10-18T00:00:00Z') });
    }
}, 30000);

afterAll(() => { if (scratch) rmSync(scratch, { recursive: true, force: true }); });

test('public exports, declarations, bins, tokens and classes remain compatible (DEC-14)', async () => {
    await expect(JSON.stringify(surface, null, 2) + '\n').toMatchFileSnapshot(join(baseline, 'public-surface.json'));
});

test('unchanged consumer examples preserve output paths, URLs and exact HTML (DEC-14)', async () => {
    const paths = {};
    for (const [name, tree] of Object.entries(trees)) {
        paths[name] = { files: Object.keys(tree).sort(), urls: names(Object.values(tree).join('\n'), /(?:href|src)="[^"]*"/g) };
    }
    await expect(JSON.stringify(paths, null, 2) + '\n').toMatchFileSnapshot(join(baseline, 'output-paths.json'));
    for (const [name, tree] of Object.entries(trees)) {
        for (const [path, contents] of Object.entries(tree)) {
            if (!path.endsWith('.html')) continue;
            const golden = join(baseline, name, path);
            mkdirSync(dirname(golden), { recursive: true });
            await expect(contents).toMatchFileSnapshot(golden);
        }
    }
});
