import { afterAll, beforeAll, expect, test } from 'vitest';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPackage } from './built-package.mjs';

// Browser checks use the optional Playwright peer, like dopedocs-shots.
const { chromium } = await import('playwright').catch(() => ({}));
let pkg, server, browser, url, output;
const docs = {
    title: 'Keyboard manual', lead: 'Read the manual.',
    entity: { name: 'Example', url: 'https://example.com', notToBeConfusedWith: [] },
    facts: {}, sections: ['dd-content', 'dd-content-1', 'second', 'last'].map(id => ({
        id, title: id, question: `What is ${id}?`, answer: `${id} is a manual section.`,
        blocks: Array.from({ length: 20 }, () => ({ kind: 'p', text: 'Reading content with a [link](https://example.com/).' })),
    })),
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
                panels.forEach((panel, index) => document.getElementById('open-' + index).onclick = () => panel.open('second'));
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

test('static skip target is focusable, precedes chrome, and avoids authored ids', () => {
    for (const html of Object.values(output).filter(value => value.startsWith('<!doctype'))) {
        expect(html).toContain('class="dd-skip"');
        expect(html.indexOf('class="dd-skip"')).toBeLessThan(html.indexOf('class="dd-bar"'));
        const target = html.match(/class="dd-skip" href="#([^"]+)"/)[1];
        expect(html).toContain(`<main id="${target}" tabindex="-1"`);
        expect(html.match(new RegExp(`id="${target}"`, 'g'))).toHaveLength(1);
    }
});

test.skipIf(!chromium)('Tab and Enter skip static chrome under CSP without changing URL; no-script fallback works', async () => {
    const page = await browser.newPage();
    const response = await page.goto(url + '/docs/dd-content/');
    expect(response.headers()['content-security-policy']).toBe("script-src 'self'");
    const before = page.url();
    const skip = page.locator('.dd-skip');
    expect(await skip.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
    await page.keyboard.press('Tab');
    await expect.poll(() => skip.evaluate(el => el === document.activeElement)).toBe(true);
    expect(await skip.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
    expect(await skip.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === el;
    })).toBe(true);
    await page.keyboard.press('Enter');
    expect(await page.locator('main').evaluate(el => el === document.activeElement)).toBe(true);
    expect(page.url()).toBe(before);
    await page.keyboard.press('Tab');
    expect(await page.locator('main a').first().evaluate(el => el === document.activeElement)).toBe(true);
    await page.close();
    const noScript = await browser.newPage({ javaScriptEnabled: false });
    await noScript.goto(url + '/docs/dd-content/');
    await noScript.keyboard.press('Tab');
    await noScript.keyboard.press('Enter');
    expect(await noScript.locator('main').evaluate(el => el === document.activeElement)).toBe(true);
    expect(new URL(noScript.url()).hash).toBe('#dd-content-main');
    expect(await noScript.locator('link[rel=canonical]').getAttribute('href')).toBe('https://example.com/docs/dd-content/');
    await noScript.close();
});

test.skipIf(!chromium)('each mounted panel skips to its own main while preserving section URL and scroll', async () => {
    const page = await browser.newPage();
    await page.goto(url + '/host?entry=keyboard');
    await page.waitForFunction(() => window.ready);
    const ids = await page.locator('.dd-main').evaluateAll(els => els.map(el => el.id));
    expect(new Set(ids).size).toBe(2);
    for (const index of [0, 1]) {
        await page.keyboard.press('Tab');
        expect(await page.locator('#open-' + index).evaluate(el => el === document.activeElement)).toBe(true);
        await page.keyboard.press('Enter');
        const root = page.locator('.dd-overlay').nth(index);
        const skip = root.locator('.dd-skip');
        await expect.poll(() => skip.evaluate(el => el === document.activeElement)).toBe(true);
        await page.keyboard.press('Tab');
        expect(await root.locator('.dd-back').evaluate(el => el === document.activeElement)).toBe(true);
        await page.keyboard.press('Shift+Tab');
        expect(await skip.evaluate(el => el === document.activeElement)).toBe(true);
        expect(await skip.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
        const before = page.url();
        const scroll = await root.locator('.dd-body').evaluate(el => el.scrollTop);
        await page.keyboard.press('Enter');
        expect(await root.locator('main').evaluate(el => el === document.activeElement)).toBe(true);
        expect(page.url()).toBe(before);
        expect(await root.locator('.dd-body').evaluate(el => el.scrollTop)).toBe(scroll);
        await page.evaluate(index => panels[index].close(), index);
        await page.waitForURL(url + '/host?entry=keyboard');
    }
    await page.close();
});
