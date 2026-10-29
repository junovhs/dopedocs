import { beforeAll, afterAll, test, expect } from 'vitest';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPackage } from './built-package.mjs';
import { docs } from '../examples/theme/docs.ts';
import { structuralClasses } from '../src/structure.ts';

const { chromium } = await import('playwright').catch(() => ({}));
let pkg, server, browser, url;
beforeAll(async () => {
    pkg = buildPackage();
    const { buildStatic } = await import(pathToFileURL(join(pkg.scratch, 'dist/static.js')).href);
    const output = buildStatic(docs, { stylesheet: '/style.css', now: new Date('2026-10-28') });
    server = createServer((req, res) => {
        if (req.url === '/style.css') {
            res.setHeader('Content-Type', 'text/css');
            return res.end(readFileSync(join(pkg.scratch, 'styles/dopedocs.css')));
        }
        if (req.url.startsWith('/modules/')) {
            res.setHeader('Content-Type', 'text/javascript');
            return res.end(readFileSync(join(pkg.scratch, 'dist', req.url.slice(9))));
        }
        if (req.url === '/panel') {
            res.setHeader('Content-Type', 'text/html');
            return res.end(`<link rel="stylesheet" href="/style.css"><div id="host"></div><script type="module">
                import { mountPanel } from '/modules/panel.js';
                window.panel = mountPanel(document.querySelector('#host'), ${JSON.stringify(docs)}, { syncUrl: false });
                panel.open();
            </script>`);
        }
        res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/html');
        res.end(output[req.url.slice(1) + (req.url.endsWith('/') ? 'index.html' : '')] || '');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
    if (chromium) browser = await chromium.launch();
}, 30000);
afterAll(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); pkg?.cleanup(); });

for (const surface of ['static', 'panel']) {
    test.skipIf(!chromium)(`${surface}: motion keywords and reduced motion control every transition`, async () => {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(url + (surface === 'panel' ? '/panel' : '/docs/'));
        await page.locator('.dd-nav-link').first().waitFor();
        for (const [preset, duration] of [['calm', '0.32s'], ['snappy', '0.14s'], ['none', '0s']]) {
            await page.evaluate(classes => {
                const root = document.querySelector('.dd-overlay') || document.body;
                root.classList.remove('dd-motion-calm', 'dd-motion-snappy', 'dd-motion-none');
                root.classList.add(...classes);
            }, structuralClasses({ '--dd-motion': preset }));
            expect(await page.locator('.dd-nav-link').first().evaluate(el => getComputedStyle(el).transitionDuration.split(',')[0])).toBe(duration);
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(() => {
            const root = document.querySelector('.dd-overlay') || document.body;
            root.classList.remove('dd-motion-none'); root.classList.add('dd-motion-calm');
        });
        expect(await page.locator('.dd-nav-link').first().evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
        if (surface === 'panel') {
            expect(await page.evaluate(() => {
                let behavior;
                document.querySelector('.dd-body').scrollTo = options => { behavior = options.behavior; };
                window.panel.open(document.querySelector('.dd-section').id);
                return behavior;
            })).toBe('auto');
        }
        await page.close();
    });
    test.skipIf(!chromium)(`${surface}: density scales content spacing and measure accepts characters`, async () => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        await page.goto(url + (surface === 'panel' ? '/panel' : '/docs/'));
        await page.locator('.dd-section').first().waitFor();
        const samples = [];
        for (const density of [0.8, 1, 1.25]) {
            await page.evaluate(value => {
                document.documentElement.style.setProperty('--dd-density', String(value));
                document.documentElement.style.setProperty('--dd-measure', '65ch');
                document.documentElement.style.setProperty('--dd-column', '1000px');
            }, density);
            const spacing = await page.locator('.dd-section').first().evaluate(el => parseFloat(getComputedStyle(el).marginBottom));
            samples.push(spacing);
            expect(await page.locator('.dd-section').first().evaluate(el => {
                const ruler = document.createElement('div');
                ruler.style.width = '65ch'; el.append(ruler);
                const expected = ruler.getBoundingClientRect().width; ruler.remove();
                return Math.abs(parseFloat(getComputedStyle(el).maxWidth) - expected);
            })).toBeLessThan(1);
            if (process.env.DOPEDOCS_ARTIFACTS) {
                mkdirSync(process.env.DOPEDOCS_ARTIFACTS, { recursive: true });
                await page.screenshot({ path: join(process.env.DOPEDOCS_ARTIFACTS, `density-${surface}-${density}.png`) });
            }
        }
        expect(samples[0] / samples[1]).toBeCloseTo(0.8);
        expect(samples[2] / samples[1]).toBeCloseTo(1.25);
        await page.close();
    });
}
