import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const scratch = await mkdtemp(join(tmpdir(), 'dopedocs-release-'));
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
const probe = `
import { readFile } from 'node:fs/promises';
import { buildStatic } from 'dopedocs/static';
const pkg = JSON.parse(await readFile('node_modules/dopedocs/package.json','utf8'));
let astro = false; try { await import('dopedocs/astro'); astro = true; } catch {}
const docs = { entity: { name: 'Example', url: 'https://example.com', notToBeConfusedWith: [] }, title: 'Manual', lead: 'Read the manual.', facts: {}, sections: [{ id: 'test', title: 'Test', question: 'What does Example do?', answer: 'Example explains a task.', blocks: [{kind:'p',text:'Read [the guide](https://example.com).'}] }] };
const tree = buildStatic(docs);
let packagedDocs = false; try { packagedDocs = (await readFile('node_modules/dopedocs/docs/reference.md','utf8')).includes('dopedocs reference'); } catch {}
console.log(JSON.stringify({ version: pkg.version, astro, links: tree['docs/test/index.html'].includes('href="https://example.com"'), facts: Object.hasOwn(tree,'facts.json'), packagedDocs }));
`;
try {
  const packed = JSON.parse(run('npm', ['pack','--ignore-scripts','--json','--pack-destination',scratch], root))[0];
  for (const path of ['dist/astro.js','dist/search.js','styles/dopedocs.css','LICENSE','docs/reference.md','examples/plumbing-starter.ts','examples/manual-assets/dial.webm']) assert(packed.files.some(file => file.path === path), `Tarball missing ${path}`);
  const results = {};
  for (const [name, spec] of [['baseline','dopedocs@0.4.0'],['candidate',join(scratch,packed.filename)]]) {
    const app = join(scratch,name); await mkdir(app); await writeFile(join(app,'package.json'),JSON.stringify({private:true,type:'module'}));
    run('npm',['install','--ignore-scripts','--no-audit','--no-fund',spec],app);
    results[name] = JSON.parse(run(process.execPath,['--input-type=module','-e',probe],app));
    console.log(`${name}: ${JSON.stringify(results[name])}`);
  }
  assert.equal(results.candidate.version,version);
  for (const key of ['astro','links','facts','packagedDocs']) assert.equal(results.candidate[key],true,`Missing candidate ${key}`);
  assert.equal(results.baseline.astro,false); assert.equal(results.baseline.links,false);
  console.log(`PASS 0.4.0 regression reproduced; ${version} installed tarball fixes Astro resolution/links and ships facts, reference, examples and media`);
} finally { await rm(scratch,{recursive:true,force:true}); }
