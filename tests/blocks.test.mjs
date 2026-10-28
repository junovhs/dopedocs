import { afterAll, beforeAll, expect, test } from 'vitest';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPackage } from './built-package.mjs';

// Browser checks use the optional Playwright peer, like dopedocs-shots.
const { chromium } = await import('playwright').catch(() => ({}));
let pkg, server, browser, url, output;
const panes = ["npm", "pnpm"].map(key => ({ key, label: key, blocks: [{ kind: "code", code: `${key} install example`, language: "sh" }] }));
const tabs = (group = "package-manager") => ({ kind: "tabs", label: "Package manager", group, panes });
const docs = {
    title: 'Install the toolkit', lead: 'Choose your package manager, then follow the guide.',
    entity: { name: 'Example', url: 'https://example.com', notToBeConfusedWith: [] },
    facts: {}, sections: [{ id: 'chapter', title: 'Getting started', children: [], landing: {
        id: 'install', title: 'Install', question: 'How do I install the toolkit?', answer: 'Install the toolkit with npm or pnpm.',
        blocks: [tabs(), { kind: 'heading', text: 'Run the example' }, tabs(), tabs('unrelated'),
            { kind: 'disclosure', summary: 'Troubleshooting', blocks: [{ kind: 'p', text: 'Check your connection and try again.' }, tabs('nested')] }],
    } }],
};
beforeAll(async () => {
    pkg = buildPackage();
    const { buildStatic } = await import(pathToFileURL(join(pkg.scratch, 'dist/static.js')).href);
    output = buildStatic(docs, { stylesheet: '/style.css', now: new Date('2026-10-18') });
    server = createServer((req, res) => {
        if (req.url === '/style.css') {
            res.setHeader('Content-Type', 'text/css');
            res.end(readFileSync(join(pkg.scratch, 'styles/dopedocs.css')));
        } else if (req.url.startsWith('/modules/')) {
            res.setHeader('Content-Type', 'text/javascript');
            res.end(readFileSync(join(pkg.scratch, 'dist', req.url.slice('/modules/'.length))));
        } else if (req.url.startsWith('/docs/')) {
            res.setHeader('Content-Security-Policy', "script-src 'self'");
            res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/html');
            res.end(output[req.url.slice(1) + (req.url.endsWith('.js') ? '' : 'index.html')]);
        } else {
            res.setHeader('Content-Type', 'text/html');
            res.end(`<link rel="stylesheet" href="/style.css"><button id="open-0">Open first manual</button><button id="open-1">Open second manual</button><div id="one"></div><div id="two"></div><script type="module">
                import { mountPanel } from '/modules/panel.js';
                const docs = ${JSON.stringify(docs)};
                window.panels = ['one', 'two'].map(id => mountPanel(document.getElementById(id), docs));
                panels.forEach((panel, index) => document.getElementById('open-' + index).onclick = () => panel.open('install'));
                window.ready = true;
            </script>`);
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
    if (chromium) browser = await chromium.launch({ headless: true });
}, 30000);
afterAll(async () => {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    pkg?.cleanup();
});


test('emits tabs enhancement only for documents using tabs', async () => {
    expect(output['docs/tabs.js']).toContain('mountTabs');
    expect(output['docs/install/index.html']).toContain('<script src="/docs/tabs.js" defer></script>');
    const { buildStatic } = await import(pathToFileURL(join(pkg.scratch, 'dist/static.js')).href);
    expect(buildStatic({ ...docs, sections: [] })['docs/tabs.js']).toBeUndefined();
});

async function checkTabs(page, root) {
    const sets = root.locator('.dd-tabs');
    const first = sets.nth(0);
    const selected = () => root.locator('[role="tab"][aria-selected="true"]').allTextContents();
    expect(await first.getByRole('tablist', { name: 'Package manager' }).count()).toBe(1);
    await first.getByRole('tab', { name: 'npm', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    expect((await selected()).slice(0, 3)).toEqual(['pnpm', 'pnpm', 'npm']);
    expect(await first.getByRole('tab', { name: 'pnpm', exact: true }).evaluate(el => el === document.activeElement)).toBe(true);
    const pane = first.getByRole('tabpanel');
    expect(await pane.count()).toBe(1);
    const id = await pane.getAttribute('id');
    expect(await first.getByRole('tab', { name: 'pnpm', exact: true }).getAttribute('aria-controls')).toBe(id);
    await page.keyboard.press('Home');
    expect((await selected()).slice(0, 2)).toEqual(['npm', 'npm']);
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowRight');
    expect((await selected()).slice(0, 2)).toEqual(['npm', 'npm']);
    await page.keyboard.press('ArrowLeft');
    expect((await selected()).slice(0, 2)).toEqual(['pnpm', 'pnpm']);
    await page.keyboard.press('Tab');
    expect(await pane.evaluate(el => el === document.activeElement)).toBe(true);
    const summary = root.locator('.dd-disclosure > summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    expect(await root.locator('.dd-disclosure').getAttribute('open')).not.toBeNull();
}

test.skipIf(!chromium)('static tabs work under self-only CSP; keyboard, sync and disclosure', async () => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(url + '/docs/install/');
    expect(response.headers()['content-security-policy']).toBe("script-src 'self'");
    await checkTabs(page, page.locator('main'));
    expect(errors).toEqual([]);
    await page.close();
});

test.skipIf(!chromium)('no-JS static panes are sequential and labelled; disclosure works natively', async () => {
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.goto(url + '/docs/install/');
    expect(await page.locator('[role="tab"]').count()).toBe(0);
    const first = page.locator('.dd-tabs').first();
    expect(await first.locator('.dd-tab-label').allTextContents()).toEqual(['npm', 'pnpm']);
    for (const pane of await first.locator('.dd-tab-pane').all()) expect(await pane.isVisible()).toBe(true);
    const summary = page.locator('.dd-disclosure > summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    expect(await page.locator('.dd-disclosure-body').isVisible()).toBe(true);
    await page.close();
});

test.skipIf(!chromium)('mounted panels synchronize locally and assign unique accessible ids', async () => {
    const page = await browser.newPage();
    await page.goto(url + '/host');
    await page.waitForFunction(() => window.ready);
    await page.locator('#open-0').click();
    await checkTabs(page, page.locator('#one'));
    await page.evaluate(() => panels[0].close());
    await page.locator('#open-1').click();
    expect(await page.locator('#two [role="tab"][aria-selected="true"]').allTextContents()).toEqual(['npm', 'npm', 'npm', 'npm']);
    const ids = await page.locator('[role="tab"], [role="tabpanel"]').evaluateAll(els => els.map(el => el.id));
    expect(new Set(ids).size).toBe(ids.length);
    await page.evaluate(() => panels.forEach(panel => panel.destroy()));
    expect(await page.locator('.dd-overlay').count()).toBe(0);
    await page.close();
});

test.skipIf(!chromium || !process.env.BLK_SCREENSHOTS)('captures token-themed static and panel review surfaces', async () => {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    await page.goto(url + '/docs/install/');
    await page.locator('.dd-tabs').first().getByRole('tab', { name: 'pnpm', exact: true }).click();
    await page.locator('.dd-disclosure > summary').click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: join(process.env.BLK_SCREENSHOTS, 'static-light.png'), fullPage: true });
    await page.addStyleTag({ content: ':root { --dd-bg: #18181b; --dd-panel: #202023; --dd-panel-muted: #27272a; --dd-muted: #a1a1aa; --dd-text: #fafafa; --dd-text-soft: #d4d4d8; --dd-line: #52525b; --dd-accent: #c4b5fd; --dd-ink: #09090b; }' });
    await page.screenshot({ path: join(process.env.BLK_SCREENSHOTS, 'static-dark.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: join(process.env.BLK_SCREENSHOTS, 'static-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1100, height: 1000 });
    await page.goto(url + '/host');
    await page.waitForFunction(() => window.ready);
    await page.locator('#open-0').click();
    await page.locator('#one .dd-tabs').first().getByRole('tab', { name: 'pnpm', exact: true }).click();
    await page.screenshot({ path: join(process.env.BLK_SCREENSHOTS, 'panel-light.png'), fullPage: true });
    await page.close();
});
