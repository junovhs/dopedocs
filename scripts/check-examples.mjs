import { mkdtemp, readFile, readdir, copyFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const scratch = await mkdtemp(join(tmpdir(), 'dopedocs-examples-'));
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  const packed = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], root))[0];
  const app = join(scratch, 'app'); await mkdir(app);
  await (await import('node:fs/promises')).writeFile(join(app, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(scratch, packed.filename)], app);
  const examples = join(app, 'node_modules/dopedocs/examples');
  const sources = (await readdir(examples)).filter(name => name.endsWith('.ts'));
  assert(sources.includes('user-manual.ts') && sources.includes('onboarding-walkthrough.ts'));
  await mkdir(join(app, 'src'));
  for (const source of sources) await copyFile(join(examples, source), join(app, 'src', source));
  run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', '--lib', 'ES2022,DOM,DOM.Iterable', '--strict', '--skipLibCheck', '--outDir', 'build', ...sources.map(source => `src/${source}`)], app);
  const { buildStatic } = await import(pathToFileURL(join(app, 'node_modules/dopedocs/dist/static.js')));
  const { pagesOf, validate } = await import(pathToFileURL(join(app, 'node_modules/dopedocs/dist/schema.js')));
  const kinds = new Set();
  for (const source of sources) {
    const { docs } = await import(pathToFileURL(join(app, 'build', source.replace(/\.ts$/, '.js'))));
    assert.deepEqual(validate(docs), [], `${source} has validation findings`);
    const tree = buildStatic(docs, { search: true });
    assert(tree['docs/index.html'].includes('<h1'));
    for (const { page } of pagesOf(docs.sections)) {
      assert(tree[`docs/${page.id}/index.html`]);
      for (const block of page.blocks) {
        kinds.add(block.kind);
        const images = block.kind === 'image' ? [block] : block.kind === 'gallery' ? block.images : [];
        const urls = images.flatMap(image => [image.src, image.href, image.srcset?.split(' ')[0], ...(image.sources ?? []).map(item => item.srcset.split(' ')[0])]);
        if (block.kind === 'video') urls.push(block.src, block.poster);
        for (const url of urls.filter(url => url?.startsWith('/manual-assets/'))) {
          const bytes = await readFile(join(examples, url.slice(1)));
          assert(bytes.length > 0, `Missing media ${url}`);
        }
      }
    }
    console.log(`PASS ${source}: public package typecheck, ${Object.keys(tree).length} static files, valid local media`);
  }
  for (const kind of ['p','list','callout','steps','checklist','details','cards','quote','metrics','compare','keys','table','facts','image','gallery','video','code']) assert(kinds.has(kind), `Missing example block ${kind}`);
  assert((await readFile(join(root, 'README.md'), 'utf8')).includes('./examples/user-manual.ts'));
  console.log(`PASS all ${kinds.size} stable block kinds covered from installed tarball`);
} finally { await rm(scratch, { recursive: true, force: true }); }
