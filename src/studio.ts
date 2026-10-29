/** Development-only editing routes. No Studio HTML or script enters buildStatic. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { studioControls, renderControl } from './studio-controls.js';
import { documentedThemeTokens, parseTheme, readThemeFile, writeThemeToken } from './theme.js';
import { structuralClasses } from './structure.js';
import { installedFontCapabilities } from './font-features.js';
import { fontCatalog, previewFont, installStudioFont } from './studio-fonts.js';
import { studioPalettes } from './studio-palettes.js';
import { studioFontClient } from './studio-font-client.js';
import { studioClient } from './studio-client.js';
import type { DevServerLike } from './host.js';
const PREFIX = '/__dopedocs/';
function fontPickerHtml() {
    return `<details id="font-picker"><summary>Find or upload fonts</summary><p>Preview on your own text, then install locally.</p>
<label>Font role<select id="font-role"><option value="display">Headings</option><option value="body">Body</option><option value="ui">Interface</option><option value="mono">Code</option></select></label>
<label>Search Google Fonts<input id="font-search" type="search" placeholder="Family name"></label>
<label>Category<select id="font-category"><option value="">All</option><option value="serif">Serif</option><option value="sans-serif">Sans</option><option value="monospace">Mono</option><option value="display">Display</option><option value="handwriting">Handwriting</option></select></label>
<label><input id="font-variable" type="checkbox" style="display:inline;width:auto"> Variable fonts only</label>
<button id="font-search-button">Search catalog</button><p id="font-message" role="status"></p><div id="font-results"></div>
<label>Weights<input id="font-weights" value="400" placeholder="400,700"></label><label>Language subset<input id="font-subset" value="latin"></label>
<div id="font-drop" tabindex="0"><label>Your own font — drop here or choose<input id="font-file" type="file" accept=".woff2,.otf,.ttf"></label></div>
<label>Font licence text<textarea id="font-license" rows="4" placeholder="Paste the licence that permits hosting this font"></textarea></label><button id="font-upload">Install your font</button></details><details id="advanced-type"><summary>Advanced type</summary><p id="feature-message">Choose an installed font role to inspect its supported features.</p><div id="font-features"></div><div id="font-axes"></div></details>`;
}
function studioHtml() {
    const tabs = ['Style', 'Layout', 'Type', 'Pieces'];
    function skinCards() {
        return '<h3>Choose a starting palette</h3><div class="skin-grid">' + Object.entries(studioPalettes).map(([name, modes]) => {
            const colors = [modes.light['--dd-bg'], modes.light['--dd-text'], modes.light['--dd-accent']];
            return '<button class="skin-card" data-skin="' + name + '" aria-pressed="false"><span class="swatches">' + colors.map(color => '<i style="background:' + color + '"></i>').join('') + '</span>' + name + '</button>';
        }).join('') + '</div><select id="skin" aria-label="Skin" hidden>' + Object.keys(studioPalettes).map(name => '<option>' + name + '</option>').join('') + '</select><div class="seg" role="group" aria-label="Color mode"><button data-mode="light" aria-pressed="true">Light</button><button data-mode="dark" aria-pressed="false">Dark</button></div><select id="mode" aria-label="Mode" hidden><option>light</option><option>dark</option></select>';
    }
    function panel(tab: string, index: number) {
        const controls = studioControls.filter(spec => spec.tab === tab);
        const basic = controls.filter(spec => !spec.advanced).map(renderControl).join('');
        const advanced = controls.filter(spec => spec.advanced).map(renderControl).join('');
        return '<section role="tabpanel" data-panel="' + tab + '" ' + (index ? 'hidden' : '') + '><h2>' + tab + '</h2>' +
            (tab === 'Style' ? skinCards() : '') + '<h3>Basic</h3>' + basic +
            '<details class="advanced"><summary>Advanced</summary><div class="controls">' + advanced + (tab === 'Type' ? fontPickerHtml() : '') + '</div></details></section>';
    }
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>dopedocs Studio</title><link rel="stylesheet" href="/__dopedocs/studio.css"></head>' +
        '<body data-appearance="light"><header><h1>dopedocs <span>Studio</span></h1><small>Your content. Your theme.</small><span id="status" role="status">Opening…</span><button id="reload">Reload file</button></header>' +
        '<main><iframe id="preview" title="Your documentation preview" src="/__dopedocs/preview"></iframe><aside><nav role="tablist" aria-label="Remix controls">' +
        [...tabs, 'Export'].map((tab, index) => '<button role="tab" data-tab="' + tab + '" aria-selected="' + (index === 0) + '">' + tab + '</button>').join('') + '</nav>' +
        tabs.map(panel).join('') + '<section role="tabpanel" data-panel="Export" hidden><h2>Your theme CSS</h2><p>Edits save automatically. Hand-written CSS stays in place.</p><pre id="export-css"></pre></section></aside></main>' +
        '<script>(' + studioClient.toString() + ')(' + JSON.stringify(studioPalettes) + ',' + JSON.stringify(studioControls) + ',(' + studioFontClient.toString() + '));</script></body></html>';
}
export function serveStudio(server: DevServerLike, options: {
    file: string;
    build: () => Record<string, string>;
    basePath: string;
    publicDir: string;
}) {
    const file = resolve(options.file);
    const state = () => { const css = readThemeFile(file); const tokens = parseTheme(css); return { css, tokens, classes: structuralClasses(tokens) }; };
    server.middlewares.use((incoming, outgoing, next) => {
        const req = incoming as IncomingMessage, res = outgoing as ServerResponse;
        const path = (req.url ?? '').split('?')[0];
        if (!path?.startsWith(PREFIX))
            return next();
        const send = (body: string, type = 'application/json', code = 200) => { res.statusCode = code; res.setHeader('Content-Type', type + '; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.end(body); };
        // Restrict local editing to local hosts and same-origin JSON requests.
        const host = req.headers.host ?? '';
        if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))
            return send(JSON.stringify({ error: 'Studio requires a loopback host' }), 'application/json', 403);
        if (req.method === 'POST' && (req.headers.origin && req.headers.origin !== `http://${host}` && req.headers.origin !== `https://${host}` || !req.headers['content-type']?.startsWith('application/json')))
            return send(JSON.stringify({ error: 'Same-origin JSON required' }), 'application/json', 403);
        void (async () => {
            if (req.method === 'GET' && path === PREFIX + 'studio.css')
                return send(readFileSync(new URL('../styles/studio.css', import.meta.url), 'utf8'), 'text/css');
            if (req.method === 'GET' && path === PREFIX + 'studio')
                return send(studioHtml(), 'text/html');
            if (req.method === 'GET' && path === PREFIX + 'preview') {
                const tree = options.build();
                const base = options.basePath.replace(/^\/+|\/+$/g, '');
                const html = tree[base ? `${base}/index.html` : 'index.html'];
                if (!html)
                    throw new Error('No generated manual to preview');
                return send(html.replace('</head>', `<link rel="stylesheet" href="${PREFIX}theme.css"></head>`), 'text/html');
            }
            if (req.method === 'GET' && path === PREFIX + 'theme.css')
                return send(readThemeFile(file), 'text/css');
            if (req.method === 'GET' && path === PREFIX + 'font-features') {
                const role = new URL(req.url!, 'http://localhost').searchParams.get('role') ?? 'body';
                return send(JSON.stringify(installedFontCapabilities(file, options.publicDir, role)));
            }
            if (req.method === 'GET' && path === PREFIX + 'fonts')
                return send(JSON.stringify(await fontCatalog()));
            if (req.method === 'GET' && path === PREFIX + 'font-preview') {
                const params = new URL(req.url!, 'http://localhost').searchParams;
                const bytes = await previewFont(params.get('id') ?? '', Number(params.get('weight')), params.get('subset') ?? 'latin');
                res.statusCode = 200;
                res.setHeader('Content-Type', 'font/woff2');
                res.setHeader('Cache-Control', 'private, max-age=3600');
                return res.end(bytes);
            }
            if (req.method === 'POST' && path === PREFIX + 'fonts') {
                let body = '';
                for await (const part of req) {
                    body += part;
                    if (body.length > 24 * 1024 * 1024)
                        throw new Error('Font upload is too large');
                }
                await installStudioFont(JSON.parse(body), { file, publicDir: options.publicDir });
                return send(JSON.stringify(state()));
            }
            if (req.method === 'GET' && path === PREFIX + 'theme')
                return send(JSON.stringify(state()));
            if (req.method === 'POST' && path === PREFIX + 'theme') {
                let body = '';
                for await (const part of req) {
                    body += part;
                    if (body.length > 65536)
                        throw new Error('Request too large');
                }
                const { token, value } = JSON.parse(body) as {
                    token: string;
                    value?: string;
                };
                if (!documentedThemeTokens().includes(token) || value !== undefined && typeof value !== 'string')
                    throw new Error('Unknown token or invalid value');
                writeThemeToken(file, token, value);
                return send(JSON.stringify(state()));
            }
            send(JSON.stringify({ error: 'Unknown Studio route' }), 'application/json', 404);
        })().catch(error => send(JSON.stringify({ error: (error as Error).message }), 'application/json', 400));
    });
}
