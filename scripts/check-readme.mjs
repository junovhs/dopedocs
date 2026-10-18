import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const scratch = await mkdtemp(join(tmpdir(), 'dopedocs-readme-'));
function run(command, args, cwd, noWarnings = false) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  const output = result.stdout + result.stderr;
  if (result.status !== 0 || (noWarnings && /\bwarn(?:ing)?\b/i.test(output))) throw new Error(`${command} ${args.join(' ')} failed (${result.status}):\n${output}`);
  return result.stdout;
}
try {
  const markdown = await readFile(join(root, 'README.md'), 'utf8');
  const fences = [...markdown.matchAll(/^```([^\n]*)\n([\s\S]*?)^```/gm)];
  const packed = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], root))[0];
  const app = join(scratch, 'app'); await mkdir(app);
  await writeFile(join(app, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  let shell = '', count = 0;
  for (const [, language, code] of fences) {
    if (language === 'sh') {
      assert.equal(code.trim(), 'npm install dopedocs');
      run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(scratch, packed.filename)], app);
    } else {
      const filename = code.match(/^(?:\/\/|\/\*|<!--) ([\w./-]+)/)?.[1];
      assert(filename, `Every code fence must name its destination: ${language}`);
      assert(['ts','css','html'].includes(language));
      const target = join(app, filename); await mkdir(dirname(target), { recursive: true }); await writeFile(target, code);
      if (language === 'html') shell = code;
    }
    count++;
  }
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-dev', 'vite@6', 'astro@5', 'typescript@~5.6.2', '@types/node@22'], app);
  await writeFile(join(app, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>README fixture</title></head><body>${shell}<script type="module" src="/src/main.ts"></script></body></html>`);
  await writeFile(join(app, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, allowImportingTsExtensions: true, skipLibCheck: true, lib: ['ES2022','DOM','DOM.Iterable'] }, include: ['src/**/*.ts','vite.config.ts'] }));
  run(process.execPath, [join(app,'node_modules/typescript/bin/tsc')], app, true);
  run(process.execPath, [join(app,'node_modules/vite/bin/vite.js'), 'build'], app, true);
  assert((await readFile(join(app,'dist/docs/storage/index.html'),'utf8')).includes('Field Notes stores notes in your browser.'));
  assert((await readFile(join(app,'dist/docs/dopedocs.css'),'utf8')).length > 0);
  assert((await readFile(join(app,'dist/docs-theme.css'),'utf8')).includes('--dd-accent'));
  await mkdir(join(app,'src/pages'), { recursive: true });
  await writeFile(join(app,'src/pages/index.astro'), '<html lang="en"><head><meta charset="utf-8" /><title>README Astro fixture</title><link rel="stylesheet" href="/docs-theme.css" /></head><body><button data-open-docs>Read the documentation</button><script>import "../main.ts";</script></body></html>');
  run(process.execPath, [join(app,'node_modules/astro/astro.js'), 'build'], app, true);
  assert((await readFile(join(app,'dist/docs/storage/index.html'),'utf8')).includes('Field Notes stores notes in your browser.'));
  // Execute both authored documents after compiling them against the installed public API.
  run(process.execPath, [join(app,'node_modules/typescript/bin/tsc'), '--module','NodeNext','--moduleResolution','NodeNext','--target','ES2022','--skipLibCheck','--outDir','compiled','src/docs.ts','src/service-docs.ts'], app, true);
  const { buildStatic } = await import(pathToFileURL(join(app,'node_modules/dopedocs/dist/static.js')));
  for (const name of ['docs','service-docs']) {
    const { docs } = await import(pathToFileURL(join(app,'compiled',`${name}.js`)));
    const tree = buildStatic(docs, name === 'service-docs' ? { entityType: 'LocalBusiness', articleType: 'Article' } : {});
    assert(tree['docs/index.html']);
    if (name === 'service-docs') assert(tree['docs/fees/index.html'].includes('Harbor Visits charges no booking fee.'));
  }
  for (const [, target] of markdown.matchAll(/\]\(\.\/([^#)]+)(?:#[^)]*)?\)/g)) await readFile(join(root, target));
  console.log(`PASS all ${count} README fences extracted and used; packed-package typecheck, Vite build, Astro build, both document builds; no application warnings`);
} finally { await rm(scratch, { recursive: true, force: true }); }
