import { afterAll, beforeAll, expect, test } from 'vitest';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPackage } from './built-package.mjs';

const { chromium } = await import('playwright').catch(() => ({}));
let pkg, server, browser, url, output, buildStatic;
const docs = {
    title: 'Copy fixture manual', lead: 'Manual lead outside section.',
    entity: { name: 'Example', url: 'https://example.com/product', notToBeConfusedWith: [] },
    facts: { seats: { value: 'Seven seats', reviewed: '2026-10-18', note: 'Internal registry note' } },
    sections: [{ id: 'chapter', title: 'Chapter label', landing: {
        id: 'overview', title: 'Overview', question: 'What does this offer?', answer: 'The offer includes {fact:seats}.',
        blocks: [{ kind: 'heading', text: 'Setup' }, { kind: 'p', text: 'Read **carefully** and [continue](https://example.com).' },
            { kind: 'tabs', label: 'Install choices', panes: ['npm', 'pnpm'].map(key => ({ key, label: key, blocks: [
                { kind: 'code', code: key + ' install toolkit\n  --save', language: 'sh' },
            ] })) },
            { kind: 'disclosure', summary: 'More help', blocks: [{ kind: 'p', text: 'Closed detail with {fact:seats}.' },
                { kind: 'math', tex: 'x^2', label: 'x squared' }] },
            { kind: 'table', head: ['Name', 'Value'], rows: [['Seats', '{fact:seats}']] },
        ],
    }, children: [{ id: 'other', title: 'Other page', question: 'What else exists?', answer: 'Another page exists.', blocks: [] }] }],
};
beforeAll(async () => {
    pkg = buildPackage();
    ({ buildStatic } = await import(pathToFileURL(join(pkg.scratch, 'dist/static.js')).href));
    output = buildStatic(docs, { copyPage: true, stylesheet: '/style.css', now: new Date('2026-10-18') });
    server = createServer((req, res) => {
        if (req.url === '/style.css') {
            res.setHeader('Content-Type', 'text/css');
            res.end(readFileSync(join(pkg.scratch, 'styles/dopedocs.css')));
        } else if (req.url.startsWith('/modules/')) {
            res.setHeader('Content-Type', 'text/javascript');
            res.end(readFileSync(join(pkg.scratch, 'dist', req.url.slice('/modules/'.length))));
        } else if (req.url.startsWith('/product/docs/')) {
            res.setHeader('Content-Security-Policy', "script-src 'self'");
            res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
            res.end(output[req.url.slice('/product/'.length) + (req.url.endsWith('.js') ? '' : 'index.html')]);
        } else {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`<link rel="stylesheet" href="/style.css"><button id="open">Open</button><div id="host"></div><script type="module">
                import { mountPanel } from '/modules/panel.js';
                window.panel = mountPanel(document.getElementById('host'), ${JSON.stringify(docs)}, { copyPage: !location.search.includes('off'), syncUrl: false });
                document.getElementById('open').onclick = () => panel.open('overview'); window.ready = true;
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

test('opt-in only emits a self-hosted enhancement on section pages; existing output is unchanged when off', () => {
    const off = buildStatic(docs, { now: new Date('2026-10-18') });
    expect(buildStatic(docs, { copyPage: false, now: new Date('2026-10-18') })).toEqual(off);
    expect(off['docs/copy.js']).toBeUndefined();
    expect(output['docs/overview/index.html']).toContain('<script src="/product/docs/copy.js" defer></script>');
    expect(output['docs/index.html']).not.toContain('copy.js');
});

for (const surface of ['static', 'panel']) {
    test.skipIf(!chromium)(`${surface}: keyboard copies the resolved section and canonical URL, including folded alternatives`, async () => {
        const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
        const page = await context.newPage();
        await page.goto(url);
        await page.evaluate(() => navigator.clipboard.writeText('untouched'));
        await page.goto(url + (surface === 'static' ? '/product/docs/overview/' : '/host'));
        if (surface === 'panel') {
            await page.waitForFunction(() => window.ready);
            await page.locator('#open').click();
        }
        const root = surface === 'panel' ? page.locator('.dd-overlay') : page.locator('main');
        const button = root.getByRole('button', { name: 'Copy page: Overview', exact: true });
        await button.waitFor();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('untouched');
        await button.focus();
        await page.keyboard.press('Enter');
        await expect.poll(() => root.locator('#overview .dd-copy-status').textContent()).toBe('Page copied.');
        const content = await page.evaluate(() => navigator.clipboard.readText());
        expect(content.replace(/\s+/g, ' ')).toBe('Overview The offer includes Seven seats. Setup Read carefully and continue. Install choices npm sh npm install toolkit --save pnpm sh pnpm install toolkit --save More help Closed detail with Seven seats. x squared Name Value Seats Seven seats https://example.com/product/docs/overview/');
        expect(content).toContain('The offer includes Seven seats.');
        expect(content).toContain('Read carefully and continue.');
        expect(content).toContain('npm install toolkit\n  --save');
        expect(content).toContain('pnpm install toolkit\n  --save');
        expect(content).toContain('More help');
        expect(content).toContain('Closed detail with Seven seats.');
        expect(content).toContain('x squared');
        expect(content).toContain('Name\tValue');
        expect(content.endsWith('https://example.com/product/docs/overview/')).toBe(true);
        for (const excluded of ['{fact:', 'Copy page', 'Page copied', 'Contents', 'Complete manual', 'Other page', 'Internal registry note', 'Manual lead outside', 'Chapter label', 'Setup#']) expect(content).not.toContain(excluded);
        expect((content.match(/Install choices/g) ?? []).length).toBe(1);
        expect(await button.evaluate(el => el === document.activeElement)).toBe(true);
        const screenshotRoot = '/home/juno/dopedocs/target/ishoo-worktrees/COPY-01/review';
        mkdirSync(screenshotRoot, { recursive: true });
        await page.screenshot({ path: join(screenshotRoot, surface + '-light.png') });
        await page.addStyleTag({ content: ':root { --dd-panel:#18181b; --dd-bg:#18181b; --dd-text:#fafafa; --dd-muted:#a1a1aa; --dd-text-soft:#d4d4d8; --dd-panel-muted:#27272a; --dd-line:#3f3f46; --dd-accent:#e4e4e7; }' });
        await page.screenshot({ path: join(screenshotRoot, surface + '-dark.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: join(screenshotRoot, surface + '-phone.png') });
        if (surface === 'panel') {
            await page.evaluate(async () => {
                const retained = document.querySelector('#overview .dd-copy-button');
                panel.destroy();
                await navigator.clipboard.writeText('after destroy');
                retained.click();
            });
            expect(await page.locator('.dd-copy-button').count()).toBe(0);
            expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('after destroy');
        }
        await context.close();
    });
    test.skipIf(!chromium)(`${surface}: denied clipboard has an accessible manual-copy hint`, async () => {
        const page = await browser.newPage();
        await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } }));
        await page.goto(url + (surface === 'static' ? '/product/docs/overview/' : '/host'));
        if (surface === 'panel') {
            await page.waitForFunction(() => window.ready);
            await page.locator('#open').click();
        }
        const button = page.getByRole('button', { name: 'Copy page: Overview', exact: true });
        await button.focus();
        await page.keyboard.press('Space');
        const status = page.locator('#overview .dd-copy-status');
        await expect.poll(() => status.textContent()).toBe('Could not copy. Select the page text and copy it manually.');
        expect(await status.getAttribute('role')).toBe('status');
        expect(await button.evaluate(el => el === document.activeElement)).toBe(true);
        await page.close();
    });
}

test.skipIf(!chromium)('no JavaScript leaves complete static content and no inert copy button; panel off omits controls', async () => {
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.goto(url + '/product/docs/overview/');
    expect(await page.locator('.dd-copy-button').count()).toBe(0);
    expect(await page.locator('#overview').textContent()).toContain('The offer includes Seven seats.');
    expect(await page.locator('[data-dd-pane]').count()).toBe(2);
    await page.locator('.dd-disclosure summary').click();
    expect(await page.locator('.dd-disclosure-body').isVisible()).toBe(true);
    await page.close();
    const host = await browser.newPage();
    await host.goto(url + '/host?off');
    await host.waitForFunction(() => window.ready);
    expect(await host.locator('.dd-copy-button').count()).toBe(0);
    await host.evaluate(() => panel.destroy());
    expect(await host.locator('.dd-overlay').count()).toBe(0);
    await host.close();
});
