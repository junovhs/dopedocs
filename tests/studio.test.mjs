import {beforeAll,afterAll,test,expect,vi} from 'vitest';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import {createServer} from 'node:http';
import {writeFileSync,readFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {buildPackage} from './built-package.mjs';
import { docs } from '../examples/theme/docs.ts';
const { chromium } = await import('playwright').catch(() => ({}));
let pkg,root,server,url,host;
beforeAll(async()=>{
    pkg=buildPackage(); root=mkdtempSync(join(tmpdir(),'dd-studio-'));
    writeFileSync(join(root,'theme.css'),'/* keep me */\n:root { --dd-accent: #123456; }\n.custom {color: red}');
    const {createHost}=await import(pathToFileURL(join(pkg.scratch,'dist/host.js')).href);
    host=createHost({docs:{...docs,title:'Real manual',lead:'Real content'},stylesheet:true,themeFile:'theme.css',studio:true});host.setRoot(root);
    const middleware=[];host.serve({middlewares:{use:fn=>middleware.push(fn)}});
    server=createServer((req,res)=>{let i=0;const next=()=>middleware[i++]?.(req,res,next)??undefined;next();});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port;
},30000);
afterAll(async()=>{await new Promise(resolve=>server.close(resolve));pkg.cleanup();rmSync(root,{recursive:true,force:true});});
test('dev editor saves/reopens the host file and never enters production output',async()=>{
    expect(await (await fetch(url+'/__dopedocs/studio')).text()).toContain('Your documentation preview');
    expect(await (await fetch(url+'/__dopedocs/preview')).text()).toContain('Real manual');
    const post=data=>fetch(url+'/__dopedocs/theme',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    expect((await post({token:'--dd-sidebar-side',value:'right'})).status).toBe(200);
    expect(readFileSync(join(root,'theme.css'),'utf8')).toContain('.custom {color: red}');
    expect((await (await fetch(url+'/__dopedocs/theme')).json()).classes).toContain('dd-sidebar-side-right');
    const saved=readFileSync(join(root,'theme.css'),'utf8');
    expect((await post({token:'--dd-accent',value:'red; color: blue'})).status).toBe(400);
    expect(readFileSync(join(root,'theme.css'),'utf8')).toBe(saved);
    const rejected=await fetch(url+'/__dopedocs/theme',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:'{}'});expect(rejected.status).toBe(403);
    expect(Object.keys(host.build()).some(path=>path.includes('__dopedocs'))).toBe(false);
    expect(Object.values(host.build()).join('').includes('studioClient')).toBe(false);
});

test('a theme batch validates before one write and preserves hand-written CSS', async () => {
    const post = data => fetch(url + '/__dopedocs/theme', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const spy = vi.spyOn(fs, 'writeFileSync');
    syncBuiltinESMExports();
    try {
        expect((await post({ tokens: { '--dd-accent': '#456789', '--dd-measure': '65ch' } })).status).toBe(200);
        expect(spy.mock.calls.filter(([path]) => path === join(root, 'theme.css'))).toHaveLength(1);
    } finally { spy.mockRestore(); syncBuiltinESMExports(); }
    const saved = readFileSync(join(root, 'theme.css'), 'utf8');
    expect(saved).toContain('.custom {color: red}');
    expect(saved).toContain('/* keep me */');
    expect(saved).toContain('--dd-accent: #456789');
    expect(saved).toContain('--dd-measure: 65ch');
    for (const tokens of [{ '--dd-accent': 'red', '--dd-measure': 'blue; color: red' }, { '--dd-missing': 'red' }, [], null]) {
        expect((await post({ tokens })).status).toBe(400);
        expect(readFileSync(join(root, 'theme.css'), 'utf8')).toBe(saved);
    }
    expect((await post({ tokens: { '--dd-measure': null } })).status).toBe(200);
    expect(readFileSync(join(root, 'theme.css'), 'utf8')).not.toContain('--dd-measure:');
});

test.skipIf(!chromium)('slider input previews without a request; release and a palette each save once', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        await page.goto(url + '/__dopedocs/studio');
        await expect.poll(() => page.locator('#status').textContent()).toContain('Ready');
        let writes = 0;
        page.on('request', req => { if (req.method() === 'POST' && req.url().endsWith('/theme')) writes++; });
        await page.getByRole('tab', { name: 'Layout', exact: true }).click();
        const slider = page.locator('[data-range="--dd-measure"]');
        await slider.evaluate(el => { el.value = '680'; el.dispatchEvent(new Event('input', { bubbles: true })); });
        expect(await page.frameLocator('#preview').locator('html').evaluate(el => el.style.getPropertyValue('--dd-measure'))).toBe('680px');
        expect(writes).toBe(0);
        await slider.dispatchEvent('change');
        await expect.poll(() => page.locator('#status').textContent()).toContain('Saved');
        expect(writes).toBe(1);
        expect(await page.frameLocator('#preview').locator('html').evaluate(el => el.style.getPropertyValue('--dd-measure'))).toBe('');
        await page.getByRole('tab', { name: 'Style', exact: true }).click();
        await page.locator('[data-skin="Paper"]').click();
        await expect.poll(() => page.locator('#status').textContent()).toContain('Saved');
        expect(writes).toBe(2);
        expect(readFileSync(join(root, 'theme.css'), 'utf8')).toContain('.custom {color: red}');
    } finally { await browser.close(); }
});

test.skipIf(!chromium)('typed controls save colors, lengths, keywords and switches; every tab has light/dark appearance', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(url + '/__dopedocs/studio');
        await expect.poll(() => page.locator('#status').textContent()).toContain('Ready');
        const accent = page.locator('[data-token="--dd-accent"]');
        await accent.fill('#654321'); await accent.press('Tab');
        await expect.poll(() => readFileSync(join(root, 'theme.css'), 'utf8')).toContain('--dd-accent: #654321');
        await page.getByRole('tab', { name: 'Layout', exact: true }).click();
        const measure = page.locator('[data-token="--dd-measure"]');
        await measure.fill('720px'); await measure.press('Tab');
        await expect.poll(() => readFileSync(join(root, 'theme.css'), 'utf8')).toContain('--dd-measure: 720px');
        await page.locator('[data-token-choice="--dd-outline"][data-value="off"]').click();
        await expect.poll(() => readFileSync(join(root, 'theme.css'), 'utf8')).toContain('--dd-outline: off');
        await page.getByRole('tab', { name: 'Pieces', exact: true }).click();
        await page.getByRole('switch', { name: 'Navigation', exact: true }).uncheck();
        await expect.poll(() => readFileSync(join(root, 'theme.css'), 'utf8')).toContain('--dd-show-nav: none');
        await page.locator('[data-reset="--dd-show-nav"]').click();
        await expect.poll(() => page.getByRole('switch', { name: 'Navigation', exact: true }).isChecked()).toBe(true);
        for (const mode of ['light', 'dark']) {
            await page.getByRole('tab', { name: 'Style', exact: true }).click();
            await page.locator(`[data-mode="${mode}"]`).click();
            await expect.poll(() => page.locator('#status').textContent()).toContain('Saved');
            for (const tab of ['Style', 'Layout', 'Type', 'Pieces']) {
                await page.getByRole('tab', { name: tab, exact: true }).click();
                if (process.env.DOPEDOCS_ARTIFACTS) {
                    mkdirSync(process.env.DOPEDOCS_ARTIFACTS, { recursive: true });
                    await page.screenshot({ path: join(process.env.DOPEDOCS_ARTIFACTS, `studio-${tab}-${mode}.png`) });
                }
            }
        }
        expect(errors).toEqual([]);
    } finally { await browser.close(); }
}, 30000);
