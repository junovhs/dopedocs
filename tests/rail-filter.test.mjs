import { afterAll, beforeAll, expect, test } from 'vitest';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPackage } from './built-package.mjs';
const { chromium } = await import('playwright').catch(() => ({}));
let pkg, server, browser, url, output, buildStatic;
const section = (id, title) => ({ id, title, question: 'What is this?', answer: 'A fixture page.', blocks: [] });
const docs = { title: 'Filter manual', lead: 'Rail filter fixture.', entity: { name: 'Example', url: 'https://example.com', notToBeConfusedWith: [] }, facts: {}, sections: [
    { id: 'guide', title: 'Guide', landing: section('overview', 'Overview'), children: [
        { id: 'nested', title: 'Nested', children: [section('cafe', 'Café setup'), section('other', 'Other topic')] },
    ] }, { id: 'elsewhere', title: 'Elsewhere', children: [section('last', 'Last page')] }, section('solo', 'Solo')
] };
beforeAll(async () => {
    pkg = buildPackage();
    ({ buildStatic } = await import(pathToFileURL(join(pkg.scratch, 'dist/static.js')).href));
    output = buildStatic(docs, { railFilter: true, stylesheet: '/style.css', now: new Date('2026-10-18') });
    const custom = buildStatic(docs, { railFilter: { shortcut: 'f' }, stylesheet: '/style.css', now: new Date('2026-10-18') });
    server = createServer((req, res) => {
        if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(readFileSync(join(pkg.scratch, 'styles/dopedocs.css'))); }
        else if (req.url.startsWith('/modules/')) { res.setHeader('Content-Type', 'text/javascript'); res.end(readFileSync(join(pkg.scratch, 'dist', req.url.slice(9)))); }
        else if (req.url.startsWith('/docs/')) {
            res.setHeader('Content-Security-Policy', "script-src 'self'");
            res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/html');
            res.end(output[req.url.slice(1) + (req.url.endsWith('.js') ? '' : 'index.html')]);
        } else if (req.url === '/custom') { res.setHeader('Content-Type', 'text/html'); res.end(custom['docs/index.html']); }
        else if (req.url === '/boot.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(`import { mountPanel } from '/modules/panel.js'; window.panels = [1,2].map(n => mountPanel(document.getElementById('host'+n), ${JSON.stringify(docs)}, { syncUrl:false, search:false, railFilter: location.search.includes('off') ? false : { shortcut: location.search.includes('custom') ? 'f' : '/' } })); window.ready=true;`); }
        else { res.setHeader('Content-Type', 'text/html'); res.end('<link rel="stylesheet" href="/style.css"><input id="editor"><textarea></textarea><select><option>Choice</option></select><div contenteditable="true">Editable</div><div id="host1"></div><div id="host2"></div><script src="/boot.js" type="module"></script>'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
    if (chromium) browser = await chromium.launch({ headless: true });
}, 30000);
afterAll(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); pkg?.cleanup(); });

test('off preserves output and complete navigation; opt-in uses self-hosted script without inert fields', () => {
    const options = { now: new Date('2026-10-18') };
    const off = buildStatic(docs, options);
    expect(buildStatic(docs, { ...options, railFilter: false })).toEqual(off);
    expect(off['docs/rail-filter.js']).toBeUndefined();
    expect(output['docs/index.html']).toContain('/docs/rail-filter.js');
    expect(output['docs/index.html']).not.toContain('<input');
});
for (const surface of ['static', 'panel']) {
    test.skipIf(!chromium)(`${surface}: keyboard filter handles accents, ancestors, landing links, empty state and Escape`, async () => {
        const page = await browser.newPage();
        await page.goto(url + (surface === 'static' ? '/docs/' : '/host'));
        if (surface === 'panel') { await page.waitForFunction(() => window.ready); await page.evaluate(() => panels[0].open()); }
        const rail = page.locator('.dd-nav').first();
        expect(await rail.locator('.dd-rail-filter input').count()).toBe(1);
        const input = rail.getByRole('searchbox', { name: 'Filter contents (/)' });
        await page.keyboard.press('/');
        expect(await input.evaluate(el => el === document.activeElement)).toBe(true);
        await page.keyboard.type('CAFE');
        expect(await rail.getByRole('link', { name: 'Café setup' }).isVisible()).toBe(true);
        expect(await rail.locator('a').filter({ hasText: 'Other topic' }).isVisible()).toBe(false);
        expect(await rail.locator('summary').filter({ hasText: 'Guide' }).isVisible()).toBe(true);
        expect(await rail.locator('summary').filter({ hasText: 'Nested' }).isVisible()).toBe(true);
        expect(await rail.locator('summary').filter({ hasText: 'Elsewhere' }).isVisible()).toBe(false);
        await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
        const review = '/home/juno/dopedocs-review/NAV-04'; mkdirSync(review, { recursive: true });
        await page.screenshot({ animations: 'disabled', path: join(review, surface + '-filtered.png') });
        await input.fill('nothing matches');
        expect(await rail.locator('[role=status]').textContent()).toBe('No matching pages.');
        await page.keyboard.press('Escape');
        expect(await input.inputValue()).toBe('');
        expect(await rail.locator('[role=status]').textContent()).toBe('');
        if (surface === 'panel') expect(await page.locator('dialog[open]').count()).toBe(1);
        expect(await rail.locator('li[hidden]').count()).toBe(0);
        await input.fill('Guide');
        expect(await rail.getByRole('link', { name: 'Guide', exact: true }).isVisible()).toBe(true);
        await page.keyboard.press('Escape');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ animations: 'disabled', path: join(review, surface + '-phone.png') });
        await page.close();
    });
}
test.skipIf(!chromium)('custom shortcut and multiple panels isolate focus, editable fields and teardown', async () => {
    const page = await browser.newPage();
    await page.goto(url + '/host?custom'); await page.waitForFunction(() => window.ready);
    for (const selector of ['#editor', 'textarea', 'select', '[contenteditable]']) {
        await page.locator(selector).focus(); await page.keyboard.press('f');
        expect(await page.locator(selector).evaluate(el => el === document.activeElement)).toBe(true);
    }
    await page.evaluate(() => { panels[0].open(); panels[1].open(); });
    await page.locator('#host2 .dd-main').evaluate(el => el.insertAdjacentHTML('afterbegin', '<textarea id=inside></textarea>'));
    await page.locator('#inside').focus(); await page.keyboard.press('f');
    expect(await page.locator('#inside').inputValue()).toBe('f');
    await page.locator('#host2 .dd-back').focus();
    const input = page.locator('#host2 .dd-rail-filter input');
    await page.keyboard.press('/'); expect(await input.evaluate(el => el === document.activeElement)).toBe(false);
    await page.keyboard.press('f'); expect(await input.evaluate(el => el === document.activeElement)).toBe(true);
    await input.fill('Solo');
    expect(await page.locator('#host1 li[hidden]').count()).toBe(0);
    await page.evaluate(() => panels[1].destroy());
    await page.evaluate(() => panels[0].open()); await page.keyboard.press('f');
    expect(await page.locator('#host1 .dd-rail-filter input').evaluate(el => el === document.activeElement)).toBe(true);
    await page.close();
    const staticPage = await browser.newPage(); await staticPage.goto(url + '/custom');
    await staticPage.keyboard.press('f');
    expect(await staticPage.getByRole('searchbox').evaluate(el => el === document.activeElement)).toBe(true);
    await staticPage.close();
});
test.skipIf(!chromium)('no JavaScript keeps the full rail, native groups and landing links; panel off omits control', async () => {
    const page = await browser.newPage({ javaScriptEnabled: false }); await page.goto(url + '/docs/');
    expect(await page.locator('input').count()).toBe(0);
    expect(await page.locator('.dd-nav li[hidden]').count()).toBe(0);
    expect(await page.getByRole('link', { name: 'Café setup' }).isVisible()).toBe(true);
    expect(await page.getByRole('link', { name: 'Guide', exact: true }).getAttribute('href')).toBe('/docs/overview/');
    await page.close();
    const host = await browser.newPage(); await host.goto(url + '/host?off'); await host.waitForFunction(() => window.ready);
    expect(await host.locator('.dd-rail-filter').count()).toBe(0); await host.close();
});
