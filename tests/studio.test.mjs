import {beforeAll,afterAll,test,expect,vi} from 'vitest';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import {createServer} from 'node:http';
import {writeFileSync,readFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {buildPackage} from './built-package.mjs';
import { docs } from '../examples/theme/docs.ts';
import { studioControls, studioTokenExceptions } from '../src/studio-controls.ts';
import { checkReadability } from '../src/studio-readability.ts';
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
afterAll(async()=>{if(server) await new Promise(resolve=>server.close(resolve));pkg?.cleanup();if(root) rmSync(root,{recursive:true,force:true});});
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

test('every documented typography token has a Type control; new tokens fail coverage', () => {
    const text = readFileSync(new URL('../styles/TOKENS.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    function missing(source) {
        const sections = [source.split('### Type\n')[1]?.split('### Shape')[0],
            source.split('### Basic typography')[1]?.split('### Structural keywords')[0],
            source.split('### Supported features by font role')[1]?.split('## Math')[0]].join('\n');
        const documented = [...new Set(sections.match(/--dd-[a-z0-9-]+/g))];
        const controls = new Set(studioControls.filter(spec => spec.tab === 'Type').map(spec => spec.token));
        return documented.filter(token => !controls.has(token));
    }
    expect(missing(text)).toEqual([]);
    expect(missing(text.replace('### Basic typography', '### Basic typography\n| `--dd-new-typography` | added | 1 |'))).toEqual(['--dd-new-typography']);
});

test('every documented theme token has a rendered control or an explained nonvisual exception', async () => {
    const text = readFileSync(new URL('../styles/TOKENS.md', import.meta.url), 'utf8');
    const controls = new Set(studioControls.map(spec => spec.token));
    const exceptions = new Set(Object.keys(studioTokenExceptions));
    const missing = source => [...new Set(source.match(/--dd-[a-z0-9-]+/g))].filter(token => !controls.has(token) && !exceptions.has(token));
    expect(missing(text)).toEqual([]);
    expect(missing(text + '\n| `--dd-unreachable-token` | new | default |')).toEqual(['--dd-unreachable-token']);
    expect(controls.size).toBe(studioControls.length);
    expect(Object.values(studioTokenExceptions).every(reason => reason.trim().length > 20)).toBe(true);
    const html = await (await fetch(url + '/__dopedocs/studio')).text();
    for (const token of controls) expect(html).toContain(`data-control="${token}"`);
});

test('readability checks catch both modes, alpha contrast, small type, measure and leading; every fix passes', () => {
    const input = { size: 13, measure: 120, leading: 1.1, modes: {
        light: { text: '#777777', link: 'rgb(240 240 240)', background: '#ffffff' },
        dark: { text: '#333333', link: '#ffffff00', background: '#000000' },
    } };
    const warnings = checkReadability(input);
    expect(warnings.map(warning => warning.id)).toEqual(['light-text-contrast', 'light-link-contrast', 'dark-text-contrast', 'dark-link-contrast', 'body-size', 'line-length', 'body-leading']);
    for (const warning of warnings) {
        if (warning.mode) input.modes[warning.mode][warning.token === '--dd-accent' ? 'link' : 'text'] = warning.value;
        else if (warning.token === '--dd-text-size') input.size = parseFloat(warning.value);
        else if (warning.token === '--dd-measure') input.measure = parseFloat(warning.value);
        else input.leading = parseFloat(warning.value);
    }
    expect(checkReadability(input)).toEqual([]);
    input.modes.light.text = '#767676';
    expect(checkReadability(input)).toEqual([]);
});

test.skipIf(!chromium)('readability warnings never block saving and their buttons restore readable settings', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
        await fetch(url + '/__dopedocs/theme', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokens: {
            '--dd-bg': '#ffffff', '--dd-text-soft': '#777777', '--dd-accent': '#eeeeee',
            '--dd-text-size': '13px', '--dd-measure': '120ch', '--dd-leading': '1.1',
        } }) });
        await page.goto(url + '/__dopedocs/studio');
        await expect.poll(() => page.locator('#status').textContent()).toContain('Ready');
        expect(readFileSync(join(root, 'theme.css'), 'utf8')).toContain('--dd-text-size: 13px');
        await page.getByRole('tab', { name: 'Type', exact: true }).click();
        for (const id of ['body-size', 'line-length', 'body-leading']) {
            expect(await page.locator(`[data-warning="${id}"]`).isVisible()).toBe(true);
        }
        if (process.env.DOPEDOCS_ARTIFACTS) await page.screenshot({ path: join(process.env.DOPEDOCS_ARTIFACTS, 'studio-readability-warnings.png') });
        for (const id of ['body-size', 'line-length', 'body-leading']) {
            await page.getByRole('button', { name: 'Fix ' + id, exact: true }).click();
            await expect.poll(() => page.locator(`[data-warning="${id}"]`).count()).toBe(0);
        }
        await page.getByRole('tab', { name: 'Style', exact: true }).click();
        await page.getByRole('button', { name: 'Fix light-link-contrast', exact: true }).click();
        await expect.poll(() => page.locator('[data-warning="light-link-contrast"]').count()).toBe(0);
        await expect.poll(() => page.locator('#status').textContent()).toContain('Saved');
        const saved = readFileSync(join(root, 'theme.css'), 'utf8');
        for (const declaration of ['--dd-text-size: 15.5px', '--dd-measure: 65ch', '--dd-leading: 1.75']) expect(saved).toContain(declaration);
        expect(Number(await page.locator('[data-range="--dd-measure"]').inputValue())).toBeGreaterThan(300);
    } finally { await browser.close(); }
});

test.skipIf(!chromium)('slider input previews without a request; release and a palette each save once', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        await page.goto(url + '/__dopedocs/studio');
        await expect.poll(() => page.locator('#status').textContent()).toContain('Ready');
        let writes = 0;
        page.on('request', req => { if (req.method() === 'POST' && req.url().endsWith('/theme')) writes++; });
        await page.getByRole('tab', { name: 'Type', exact: true }).click();
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
        await page.getByRole('tab', { name: 'Type', exact: true }).click();
        const measure = page.locator('[data-token="--dd-measure"]');
        await measure.fill('720px'); await measure.press('Tab');
        await expect.poll(() => readFileSync(join(root, 'theme.css'), 'utf8')).toContain('--dd-measure: 720px');
        await page.getByRole('tab', { name: 'Layout', exact: true }).click();
        await page.locator('[data-token-choice="--dd-outline"][data-value="off"]').click();
        await expect.poll(() => readFileSync(join(root, 'theme.css'), 'utf8')).toContain('--dd-outline: off');
        await page.getByRole('tab', { name: 'Pieces', exact: true }).click();
        await page.getByRole('switch', { name: 'Navigation', exact: true }).uncheck();
        await expect.poll(() => readFileSync(join(root, 'theme.css'), 'utf8')).toContain('--dd-show-nav: none');
        await page.locator('[data-reset="--dd-show-nav"]').click();
        await expect.poll(() => page.getByRole('switch', { name: 'Navigation', exact: true }).isChecked()).toBe(true);
        for (const mode of ['light', 'dark']) {
            if (await page.locator('body').getAttribute('data-appearance') !== mode) await page.locator('#appearance').click();
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

test.skipIf(!chromium)('Remix panel matches the prototype geometry and typography; all shell actions work', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const external = [];
    page.on('request', request => { if (!request.url().startsWith(url)) external.push(request.url()); });
    try {
        await page.goto(url + '/__dopedocs/studio');
        await expect.poll(() => page.locator('#status').textContent()).toContain('Ready');
        await page.locator('[data-skin="Studio"]').click();
        await expect.poll(() => page.locator('#status').textContent()).toContain('Saved');
        await page.locator('[data-mode="light"]').click();
        await expect.poll(() => page.locator('#status').textContent()).toContain('Saved');
        await page.evaluate(() => document.fonts.ready);
        expect(await page.locator('body').getAttribute('data-appearance')).toBe('dark');
        expect(await page.locator('aside').boundingBox()).toMatchObject({ x: 1036, y: 108, width: 404, height: 892 });
        expect((await page.locator('.skin-preview').first().boundingBox()).height).toBe(52);
        expect((await page.locator('.presets button').first().boundingBox()).height).toBe(54);
        expect(await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Inter');
        expect(await page.locator('.panel-title h2').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Bricolage');
        expect(await page.evaluate(() => document.fonts.check('13px Inter') && document.fonts.check('19px "Bricolage Grotesque"'))).toBe(true);
        if (process.env.DOPEDOCS_ARTIFACTS) {
            await page.screenshot({ path: join(process.env.DOPEDOCS_ARTIFACTS, 'studio-mock-aligned.png') });
            await page.locator('aside').screenshot({ path: join(process.env.DOPEDOCS_ARTIFACTS, 'studio-remix-panel.png') });
        }
        await page.locator('[data-preset="1"]').click();
        await expect.poll(() => page.locator('#status').textContent()).toContain('Saved');
        expect(readFileSync(join(root, 'theme.css'), 'utf8')).toContain('--dd-body: Georgia, serif');
        await page.locator('[data-toggle-panel]').first().click();
        expect(await page.locator('aside').isVisible()).toBe(false);
        await page.locator('[data-toggle-panel]').first().click();
        expect(await page.locator('aside').isVisible()).toBe(true);
        await page.locator('#appearance').click();
        expect(await page.locator('body').getAttribute('data-appearance')).toBe('light');
        await page.locator('#reset-theme').click();
        await expect.poll(() => page.locator('#status').textContent()).toContain('Saved');
        expect(readFileSync(join(root, 'theme.css'), 'utf8')).toContain('.custom {color: red}');
        expect(readFileSync(join(root, 'theme.css'), 'utf8')).not.toContain('--dd-body:');
        expect(external).toEqual([]);
    } finally { await browser.close(); }
}, 15000);
