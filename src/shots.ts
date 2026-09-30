/**
 * Screenshots for documentation, taken from the running app, reproducibly.
 *
 * A documentation picture goes stale the moment the interface moves, and a
 * picture nobody can retake is how a generated or doctored image ends up in a
 * manual. This module makes taking the whole set one command:
 *
 *   npx dopedocs-shots                 # every shot in dopedocs.shots.mjs
 *   npx dopedocs-shots --only hero     # just some
 *   npx dopedocs-shots --list          # what the config declares
 *
 * It fixes everything that makes two runs differ: the clock (frozen at one
 * instant), the zone and locale, the viewport and pixel ratio of each shot,
 * the app's stored state (written before the page loads), web fonts (fetched
 * once, then served from a local cache), and motion (reduced motion, every
 * animation removed, transitions finished, focus and pointer parked). A shot
 * is framed by a real element's box, or the union of several, never a
 * freehand rectangle, so a crop cannot cut through a glyph.
 *
 * Alongside the PNGs it writes `shots.json`, the size of every file it made.
 * `shotImage()` reads that into a DocImage, so declared dimensions can never
 * drift from the pictures.
 *
 * Playwright is an optional peer dependency: install it (and a Chromium) to
 * take pictures. Nothing else in dopedocs needs it.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { ShotManifest, ShotRecord } from "./shot-image.js";

/* ── Configuration ───────────────────────────────────────────────────────── */

/**
 * The parts of a Playwright page a shot's steps usually need. Declared
 * structurally so dopedocs needs no Playwright types to compile; the object
 * passed in is the real Page, so anything else it has can be reached by a cast.
 */
export interface ShotPage {
    click(selector: string, options?: Record<string, unknown>): Promise<void>;
    fill(selector: string, value: string, options?: Record<string, unknown>): Promise<void>;
    hover(selector: string, options?: Record<string, unknown>): Promise<void>;
    press(selector: string, key: string, options?: Record<string, unknown>): Promise<void>;
    waitForSelector(selector: string, options?: Record<string, unknown>): Promise<unknown>;
    waitForTimeout(ms: number): Promise<void>;
    evaluate<R, A = unknown>(fn: (arg: A) => R | Promise<R>, arg?: A): Promise<R>;
    goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
    keyboard: { press(key: string): Promise<void>; type(text: string): Promise<void> };
    mouse: { move(x: number, y: number): Promise<void> };
}

/** What a shot frames: the viewport, one element, or the union of several. */
export type ShotFrame = "viewport" | "page" | string | string[];

export interface Shot {
    /** File name without extension; also the manifest key `shotImage` looks up. */
    name: string;
    /** A note on where the picture is used. Shown by `--list`; nothing else reads it. */
    serves?: string;
    /** CSS pixels. Default: the config's viewport. */
    viewport?: { width: number; height: number };
    /** Device pixel ratio. 2 for close-ups that must stay sharp. Default 1. */
    dpr?: number;
    /** Path under the app's URL to open. Default "/". */
    path?: string;
    /** Replaces the config's storage for this shot. */
    storage?: Record<string, unknown>;
    /** Steps before the shutter: open a dialog, choose a tab, type a name. */
    before?: (page: ShotPage) => Promise<void>;
    /** What to capture. Default "viewport". */
    frame?: ShotFrame;
    /** Grows (or, negative, shrinks) an element frame by this many CSS pixels. */
    pad?: number;
    /** Extra CSS for this shot only, e.g. to hide something transient. */
    css?: string;
    /** Resized PNG copies to make, by width in pixels. */
    widths?: number[];
    /** Also write a WebP of the full size and of each resized copy. */
    webp?: boolean;
}

export interface ShotsConfig {
    /**
     * Where the app is served. When absent, a Vite dev server is started from
     * the working directory for the run and stopped after it.
     */
    url?: string;
    /** Environment for the started dev server, e.g. placeholder API keys. */
    env?: Record<string, string>;
    /** Directory the pictures and `shots.json` are written to. */
    out: string;
    /** URL path `out` is served at, for the manifest. Default "/" + basename(out). */
    publicPath?: string;
    /** The instant the page's clock is frozen at, e.g. "2026-09-04T10:30:00-07:00". */
    time?: string;
    /** IANA zone. Default "UTC". */
    timezone?: string;
    /** Default "en-US". */
    locale?: string;
    /** Default for shots that do not set one. Default 1280×800. */
    viewport?: { width: number; height: number };
    /**
     * localStorage written before the app loads, key to value. Strings are
     * stored as they are; anything else is JSON-encoded. Storage is cleared
     * first, so nothing from a previous run leaks in.
     */
    storage?: Record<string, unknown>;
    /** Requests served from a disk cache after their first fetch. Default: Google Fonts. */
    cache?: RegExp[];
    /** Where cached responses live. Default node_modules/.cache/dopedocs-shots. */
    cacheDir?: string;
    /**
     * Refuse to shoot until a face of each of these families has loaded, so a
     * set is never silently taken in fallback fonts.
     */
    fonts?: string[];
    /** Requests aborted outright, e.g. a placeholder backend. */
    block?: (string | RegExp)[];
    /** CSS applied to every shot, e.g. to hide ambient decoration. */
    css?: string;
    shots: Shot[];
}

/** Declares a shots config, for type checking in a plain `.mjs` or `.ts` file. */
export function defineShots(config: ShotsConfig): ShotsConfig {
    return config;
}

/* ── Capture ─────────────────────────────────────────────────────────────── */

/** Every animation removed, every transition finished, no caret. */
const SETTLE_CSS = `*, *::before, *::after {
    animation: none !important;
    transition-delay: 0s !important;
    transition-duration: 0s !important;
    caret-color: transparent !important;
}`;

const GOOGLE_FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

export interface CaptureOptions {
    /** Take only these shots; the manifest keeps every other entry. */
    only?: string[];
    /** Overrides `config.out`. */
    out?: string;
    /** Called once per file written. */
    log?: (line: string) => void;
    /** Working directory the config's relative paths resolve against. */
    cwd?: string;
}

export interface CapturedFile {
    shot: string;
    path: string;
    width?: number;
    height?: number;
    sha256: string;
}

/** A PNG's pixel size, from its IHDR chunk. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
}

type Browser = {
    newContext(options: Record<string, unknown>): Promise<Context>;
    newPage(): Promise<RawPage>;
    close(): Promise<void>;
};
type Context = {
    route(url: string | RegExp, handler: (route: Route) => unknown): Promise<void>;
    addInitScript(script: (arg: unknown) => void, arg: unknown): Promise<void>;
    newPage(): Promise<RawPage>;
    close(): Promise<void>;
};
type Route = {
    request(): { url(): string };
    fetch(): Promise<{ ok(): boolean; body(): Promise<Uint8Array>; headers(): Record<string, string> }>;
    fulfill(options: Record<string, unknown>): Promise<void>;
    abort(): Promise<void>;
};
type RawPage = ShotPage & {
    clock: { setFixedTime(time: Date): Promise<void> };
    addStyleTag(options: { content: string }): Promise<unknown>;
    screenshot(options: Record<string, unknown>): Promise<Uint8Array>;
    locator(selector: string): { first(): { boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null> } };
    close(): Promise<void>;
};

async function loadChromium(): Promise<{ launch(): Promise<Browser> }> {
    try {
        const name = "playwright";
        const mod = (await import(name)) as { chromium: { launch(): Promise<Browser> } };
        return mod.chromium;
    } catch {
        throw new Error("dopedocs-shots needs Playwright: npm i -D playwright && npx playwright install chromium");
    }
}

async function startVite(cwd: string, env: Record<string, string>): Promise<{ url: string; close(): Promise<void> }> {
    Object.assign(process.env, env);
    let vite: { createServer(options: Record<string, unknown>): Promise<{ listen(): Promise<unknown>; resolvedUrls: { local: string[] } | null; close(): Promise<void> }> };
    try {
        const name = "vite";
        vite = await import(name);
    } catch {
        throw new Error("No `url` in the shots config and Vite is not installed; set `url` to where the app is served.");
    }
    const server = await vite.createServer({ root: cwd, logLevel: "error", server: { port: 0, host: "127.0.0.1" } });
    await server.listen();
    const url = server.resolvedUrls?.local[0];
    if (!url) throw new Error("The Vite dev server did not report a URL.");
    return { url, close: () => server.close() };
}

/** Takes the configured shots, writes them and the manifest, and returns what it wrote. */
export async function captureShots(config: ShotsConfig, options: CaptureOptions = {}): Promise<CapturedFile[]> {
    const cwd = options.cwd ?? process.cwd();
    const out = resolve(cwd, options.out ?? config.out);
    const publicPath = (config.publicPath ?? `/${out.split(/[\\/]/).pop()}`).replace(/\/$/, "");
    const cacheDir = resolve(cwd, config.cacheDir ?? "node_modules/.cache/dopedocs-shots");
    const log = options.log ?? (() => {});
    const only = options.only;
    const shots = only ? config.shots.filter((shot) => only.includes(shot.name)) : config.shots;
    const unknown = only?.filter((name) => !config.shots.some((shot) => shot.name === name)) ?? [];
    if (unknown.length) throw new Error(`Unknown shot: ${unknown.join(", ")}`);
    const names = new Set<string>();
    for (const shot of config.shots) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(shot.name)) throw new Error(`Shot name "${shot.name}" must be a lowercase slug.`);
        if (names.has(shot.name)) throw new Error(`Two shots are named "${shot.name}".`);
        names.add(shot.name);
    }
    mkdirSync(out, { recursive: true });
    mkdirSync(cacheDir, { recursive: true });

    const server = config.url ? null : await startVite(cwd, config.env ?? {});
    const base = config.url ?? server!.url;
    const chromium = await loadChromium();
    const browser = await chromium.launch();
    const written: CapturedFile[] = [];
    const manifestPath = join(out, "shots.json");
    const manifest: ShotManifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
    for (const name of Object.keys(manifest)) if (!names.has(name)) delete manifest[name];

    const write = (shot: string, file: string, bytes: Uint8Array): CapturedFile => {
        writeFileSync(file, bytes);
        const size = file.endsWith(".png") ? pngSize(bytes) : undefined;
        const record: CapturedFile = { shot, path: file, ...size, sha256: createHash("sha256").update(bytes).digest("hex") };
        written.push(record);
        log(`${file.split(/[\\/]/).pop()!.padEnd(34)} ${record.sha256.slice(0, 12)}  ${size ? `${size.width}x${size.height}` : ""}`);
        return record;
    };

    try {
        for (const shot of shots) {
            const bytes = await captureOne(browser, base, config, shot, cacheDir);
            const full = write(shot.name, join(out, `${shot.name}.png`), bytes);
            const record: ShotRecord = { src: `${publicPath}/${shot.name}.png`, width: full.width!, height: full.height!, sizes: [], webp: [] };
            for (const copy of await derive(browser, bytes, shot)) {
                const file = `${shot.name}${copy.width === full.width ? "" : `-${copy.width}`}.${copy.type}`;
                const saved = write(shot.name, join(out, file), copy.bytes);
                const src = `${publicPath}/${file}`;
                if (copy.type === "png") record.sizes.push({ width: saved.width!, height: saved.height!, src });
                else record.webp.push({ width: copy.width, src });
            }
            record.sizes.sort((a, b) => a.width - b.width);
            record.webp.sort((a, b) => a.width - b.width);
            manifest[shot.name] = record;
        }
    } finally {
        await browser.close();
        await server?.close();
    }
    const ordered = Object.fromEntries(config.shots.filter((s) => manifest[s.name]).map((s) => [s.name, manifest[s.name]]));
    writeFileSync(manifestPath, `${JSON.stringify(ordered, null, 4)}\n`);
    return written;
}

async function captureOne(browser: Browser, base: string, config: ShotsConfig, shot: Shot, cacheDir: string): Promise<Uint8Array> {
    const context = await browser.newContext({
        viewport: shot.viewport ?? config.viewport ?? { width: 1280, height: 800 },
        deviceScaleFactor: shot.dpr ?? 1,
        colorScheme: "light",
        reducedMotion: "reduce",
        locale: config.locale ?? "en-US",
        timezoneId: config.timezone ?? "UTC",
    });
    try {
        for (const pattern of config.cache ?? [GOOGLE_FONTS]) {
            await context.route(pattern, async (route) => {
                const url = route.request().url();
                const key = createHash("sha256").update(url).digest("hex").slice(0, 32);
                const body = join(cacheDir, key);
                if (!existsSync(body)) {
                    const response = await route.fetch();
                    if (!response.ok()) return route.fulfill({ response });
                    writeFileSync(body, await response.body());
                    writeFileSync(`${body}.json`, JSON.stringify({ url, type: response.headers()["content-type"] ?? "application/octet-stream" }));
                }
                const { type } = JSON.parse(readFileSync(`${body}.json`, "utf8")) as { type: string };
                await route.fulfill({ status: 200, contentType: type, body: readFileSync(body), headers: { "access-control-allow-origin": "*" } });
            });
        }
        for (const pattern of config.block ?? []) await context.route(pattern, (route) => route.abort());
        const storage = Object.fromEntries(
            Object.entries(shot.storage ?? config.storage ?? {}).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
        );
        await context.addInitScript((arg) => {
            const entries = arg as Record<string, string>;
            try {
                if (sessionStorage.getItem("dopedocs-shots-seeded")) return;
                localStorage.clear();
                for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
                sessionStorage.setItem("dopedocs-shots-seeded", "1");
            } catch { /* storage unavailable: the shot shows an unseeded app */ }
        }, storage);
        const page = await context.newPage();
        if (config.time) await page.clock.setFixedTime(new Date(config.time));
        await page.goto(new URL(shot.path ?? "/", base).href, { waitUntil: "networkidle" });
        await page.addStyleTag({ content: `${SETTLE_CSS}\n${config.css ?? ""}\n${shot.css ?? ""}` });
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        if (config.fonts?.length) {
            const missing = await page.evaluate((families: string[]) =>
                families.filter((family) => ![...document.fonts].some((face) => face.family.replaceAll('"', "") === family && face.status === "loaded")), config.fonts);
            if (missing.length) throw new Error(`Shot "${shot.name}": fonts not loaded (${missing.join(", ")}); refusing to shoot in fallback fonts.`);
        }
        if (shot.before) await shot.before(page);
        await page.mouse.move(0, 0);
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
        // Two frames for anything a step scheduled, then a quiet moment.
        await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
        await page.waitForTimeout(400);
        const frame = shot.frame ?? "viewport";
        const common = { animations: "disabled", caret: "hide" };
        if (frame === "viewport") return await page.screenshot(common);
        if (frame === "page") return await page.screenshot({ ...common, fullPage: true });
        return await page.screenshot({ ...common, clip: await frameOf(page, frame, shot.pad ?? 0, shot.name) });
    } finally {
        await context.close();
    }
}

async function frameOf(page: RawPage, frame: string | string[], pad: number, name: string) {
    const boxes = [];
    for (const selector of Array.isArray(frame) ? frame : [frame]) {
        const box = await page.locator(selector).first().boundingBox();
        if (!box) throw new Error(`Shot "${name}": nothing to frame at ${selector}.`);
        boxes.push(box);
    }
    const x = Math.floor(Math.min(...boxes.map((b) => b.x)) - pad);
    const y = Math.floor(Math.min(...boxes.map((b) => b.y)) - pad);
    const right = Math.ceil(Math.max(...boxes.map((b) => b.x + b.width)) + pad);
    const bottom = Math.ceil(Math.max(...boxes.map((b) => b.y + b.height)) + pad);
    return { x, y, width: right - x, height: bottom - y };
}

/**
 * Resized PNGs and WebP copies, drawn by the same browser from the PNG it just
 * took. Canvas encoding is deterministic for identical pixels, so these repeat
 * byte for byte too.
 */
async function derive(browser: Browser, png: Uint8Array, shot: Shot): Promise<{ width: number; type: "png" | "webp"; bytes: Uint8Array }[]> {
    if (!shot.widths?.length && !shot.webp) return [];
    const page = await browser.newPage();
    try {
        const source = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
        const encoded = await page.evaluate(async (arg: { source: string; widths: number[]; webp: boolean }) => {
            const image = new Image();
            image.src = arg.source;
            await image.decode();
            const encode = (width: number, type: string) => {
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = Math.round((image.naturalHeight * width) / image.naturalWidth);
                const context = canvas.getContext("2d")!;
                context.imageSmoothingQuality = "high";
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                return canvas.toDataURL(type, 0.82);
            };
            const out: { width: number; type: "png" | "webp"; data: string }[] = [];
            for (const width of [image.naturalWidth, ...arg.widths]) {
                if (width !== image.naturalWidth) out.push({ width, type: "png", data: encode(width, "image/png") });
                if (arg.webp) out.push({ width, type: "webp", data: encode(width, "image/webp") });
            }
            return out;
        }, { source, widths: shot.widths ?? [], webp: !!shot.webp });
        return encoded.map(({ width, type, data }) => ({ width, type, bytes: Buffer.from(data.split(",")[1]!, "base64") }));
    } finally {
        await page.close();
    }
}
