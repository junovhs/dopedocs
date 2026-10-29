import { beforeAll, afterAll, test, expect } from 'vitest';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPackage } from './built-package.mjs';

const { chromium } = await import(process.env.DOPEDOCS_PLAYWRIGHT || 'playwright').catch(() => ({}));
let pkg, server, browser, url;
beforeAll(async () => {
    pkg = buildPackage();
    const { buildStatic } = await import(pathToFileURL(join(pkg.scratch, 'dist/static.js')).href);
    const docs = { title: 'Field guide', lead: 'A practical guide to the equipment.',
        entity: { name: 'Example', url: 'https://example.com', notToBeConfusedWith: [] }, facts: {},
        sections: Array.from({ length: 24 }, (_, i) => ({ id: `page-${i}`, title: `Equipment ${i + 1}`,
            question: `How do I use equipment ${i + 1}?`, answer: 'Follow the instructions in this guide.',
            blocks: [{ kind: 'p', text: 'Read the instructions before starting. '.repeat(20) }] })) };
    const output = buildStatic(docs, { search: true, stylesheet: '/style.css', now: new Date('2026-10-18') });
    server = createServer((req, res) => {
        if (req.url === '/style.css') {
            res.setHeader('Content-Type', 'text/css'); res.end(readFileSync(join(pkg.scratch, 'styles/dopedocs.css')));
        } else {
            const key = req.url.slice(1) + (req.url.endsWith('/') ? 'index.html' : '');
            res.setHeader('Content-Type', key.endsWith('.js') ? 'text/javascript' : 'text/html');
            res.end(output[key] || '');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}/docs/`;
    if (chromium) browser = await chromium.launch({ headless: true });
}, 30000);
afterAll(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); pkg?.cleanup(); });

test.skipIf(!chromium)('phone sheet reverses in flight, manages focus, searches and follows links', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const artifacts = process.env.DOPEDOCS_ARTIFACTS;
    if (artifacts) await page.context().tracing.start({ screenshots: true, snapshots: true });
    await page.goto(url);
    const menu = page.locator('.dd-mobile-contents');
    const toggle = menu.locator(':scope > summary');
    const nav = menu.locator('nav');
    expect(await menu.getAttribute('open')).toBeNull();
    expect(await nav.isVisible()).toBe(false);
    if (artifacts) { mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: join(artifacts, 'mobile-closed.png') }); }
    await toggle.click();
    await page.waitForTimeout(70);
    const before = await nav.evaluate(el => el.getAnimations()[0].currentTime);
    await toggle.click();
    const reversed = await nav.evaluate(el => ({ time: el.getAnimations()[0].currentTime, rate: el.getAnimations()[0].playbackRate }));
    expect(reversed.rate).toBe(-1);
    expect(reversed.time).toBeGreaterThan(0);
    expect(reversed.time).toBeGreaterThanOrEqual(before - 20);
    await expect.poll(() => menu.getAttribute('open')).toBeNull();
    await toggle.click(); await page.waitForTimeout(270);
    expect(await nav.boundingBox()).toMatchObject({ x: 0, y: 52, width: 390, height: 792 });
    expect(await page.locator('main').evaluate(el => el.inert)).toBe(true);
    if (artifacts) await page.screenshot({ path: join(artifacts, 'mobile-open.png') });
    await toggle.focus(); await page.keyboard.press('Shift+Tab');
    expect(await page.locator(':focus').textContent()).toBe('Equipment 24');
    await page.keyboard.press('Tab'); expect(await toggle.evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press('Escape'); await page.waitForTimeout(270);
    expect(await menu.getAttribute('open')).toBeNull();
    expect(await page.locator('main').evaluate(el => el.inert)).toBe(false);
    await toggle.click(); await page.waitForTimeout(270);
    const search = nav.getByRole('searchbox'); await search.fill('Equipment 2');
    await expect.poll(() => nav.locator('.dd-search-results a').count()).toBeGreaterThan(0);
    await nav.locator('.dd-nav-link').first().click();
    await page.waitForURL('**/docs/page-0/');
    expect(await menu.getAttribute('open')).toBeNull();
    if (artifacts) await page.context().tracing.stop({ path: join(artifacts, 'mobile-motion-trace.zip') });
    await page.close();
});

test.skipIf(!chromium)('native fallback, desktop resize and reduced motion keep navigation usable', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    await page.goto(url);
    const menu = page.locator('.dd-mobile-contents');
    await menu.locator(':scope > summary').click(); expect(await menu.getAttribute('open')).toBeNull();
    await menu.locator(':scope > summary').click();
    await menu.locator('.dd-nav-link').last().click(); await page.waitForURL('**/page-23/');
    await menu.locator(':scope > summary').click();
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await menu.locator(':scope > summary').isVisible()).toBe(false);
    expect(await menu.locator('nav').isVisible()).toBe(true);
    expect((await menu.locator('nav').boundingBox()).height).toBeGreaterThan(100);
    await page.close();
    const enhanced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await enhanced.goto(url);
    const toggle = enhanced.locator('.dd-mobile-contents > summary');
    await toggle.click(); expect(await enhanced.locator('nav').evaluate(el => el.getAnimations().length)).toBe(0);
    await enhanced.setViewportSize({ width: 1280, height: 900 });
    expect(await enhanced.locator('main').evaluate(el => el.inert)).toBe(false);
    const rail = await enhanced.locator('nav').boundingBox(); const main = await enhanced.locator('main').boundingBox();
    expect(rail.x + rail.width).toBeLessThanOrEqual(main.x + 1);
    await enhanced.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => enhanced.locator('.dd-mobile-contents').getAttribute('open')).toBeNull();
    await enhanced.close();
});
