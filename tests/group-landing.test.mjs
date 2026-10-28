import { afterAll, beforeAll, expect, test } from 'vitest';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPackage } from './built-package.mjs';

const { chromium } = await import('playwright').catch(() => ({}));
let pkg, server, browser, url;
const page = id => ({ id, title: id, question: `What is ${id}?`, answer: `${id} explains a task.`,
    blocks: Array.from({ length: 12 }, () => ({ kind: 'p', text: 'A paragraph of chapter content.' })) });
const docs = {
    title: 'Manual', lead: 'Read the manual.', facts: {},
    entity: { name: 'Example', url: 'https://example.com', notToBeConfusedWith: [] },
    sections: [page('before'), { id: 'chapter', title: 'Chapter label', landing: page('overview'), children: [page('first')] }],
};
beforeAll(async () => {
    pkg = buildPackage();
    const { buildStatic } = await import(pathToFileURL(join(pkg.scratch, 'dist/static.js')).href);
    const output = buildStatic(docs, { stylesheet: '/style.css' });
    server = createServer((req, res) => {
        if (req.url === '/style.css') {
            res.setHeader('Content-Type', 'text/css');
            res.end(readFileSync(join(pkg.scratch, 'styles/dopedocs.css')));
        } else if (req.url.startsWith('/modules/')) {
            res.setHeader('Content-Type', 'text/javascript');
            res.end(readFileSync(join(pkg.scratch, 'dist', req.url.slice('/modules/'.length))));
        } else if (req.url.startsWith('/docs/')) {
            res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/html');
            res.end(output[req.url.slice(1) + (req.url.endsWith('.js') ? '' : 'index.html')]);
        } else {
            res.setHeader('Content-Type', 'text/html');
            res.end(`<link rel="stylesheet" href="/style.css"><button id="open">Read</button><div id="host"></div><script type="module">
                import { mountPanel } from '/modules/panel.js';
                window.panel = mountPanel(document.getElementById('host'), ${JSON.stringify(docs)});
                document.getElementById('open').onclick = () => panel.open('first');
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

test.skipIf(!chromium)('static chapter label navigates to its landing without JavaScript', async () => {
    const reader = await browser.newPage({ javaScriptEnabled: false });
    await reader.goto(url + '/docs/first/');
    await reader.locator('summary a').click();
    await reader.waitForURL(url + '/docs/overview/');
    expect(await reader.locator('h1').textContent()).toBe('overview');
    expect(await reader.locator('summary a').getAttribute('aria-current')).toBe('page');
    await reader.locator('[rel=next]').click();
    await reader.waitForURL(url + '/docs/first/');
    await reader.close();
});

test.skipIf(!chromium)('panel label selects landing once, updates URL and reading progress, and retains disclosure control', async () => {
    const reader = await browser.newPage();
    await reader.goto(url + '/host');
    await reader.waitForFunction(() => window.ready);
    await reader.locator('#open').click();
    const root = reader.locator('.dd-overlay');
    const group = root.locator('[data-dd-group=chapter]');
    await expect.poll(() => group.getAttribute('open')).not.toBeNull();
    expect(await root.locator('.dd-section').evaluateAll(els => els.map(el => el.id))).toEqual(['before', 'overview', 'first']);
    expect(await root.locator('.dd-nav > .dd-nav-list [data-dd-link=overview]').count()).toBe(1);
    await root.locator('summary a').click();
    await reader.waitForURL(url + '/docs/overview/');
    await expect.poll(() => reader.evaluate(() => panel.activeId)).toBe('overview');
    expect(await root.locator('progress').getAttribute('value')).toBe('2');
    expect(await root.locator('progress').getAttribute('max')).toBe('3');
    expect(await root.locator('summary a').getAttribute('aria-current')).toBe('location');
    await group.locator('summary').focus();
    await reader.keyboard.press('Enter');
    await expect.poll(() => group.getAttribute('open')).toBeNull();
    await reader.keyboard.press('Enter');
    await expect.poll(() => group.getAttribute('open')).not.toBeNull();
    await root.locator('.dd-nav > .dd-nav-list [data-dd-link=first]').click();
    await reader.waitForURL(url + '/docs/first/');
    await reader.close();
});
