/** Development-time, host-owned font installation; no reader requests leave the host (DEC-13). */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { create, type Font } from "fontkit";
import { parse } from "postcss";
import { parseTheme, readThemeFile, updateTheme } from "./theme.js";

export interface FontOptions {
    weights?: number[];
    italic?: boolean;
    subset?: string;
    role?: "display" | "body" | "ui" | "mono";
    file?: string;
    publicDir?: string;
    publicPath?: string;
    license?: string;
    source?: string;
}
interface Face { bytes: Uint8Array; weight: number; style: string; range: string; }
const roles = ["display", "body", "ui", "mono"] as const;
const quote = (value: string) => JSON.stringify(value);
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const marker = (id: string, end = false) => `/* dopedocs font ${id}:${end ? "end" : "start"} */`;

function fontOf(bytes: Uint8Array): Font {
    const font = create(Buffer.from(bytes));
    if (!("characterSet" in font)) throw new Error("Font collections are not supported; choose one OTF, TTF or WOFF2 face");
    return font;
}
function unicodeRange(font: Font): string {
    const points = [...new Set(font.characterSet)].sort((a, b) => a - b);
    const ranges: string[] = [];
    for (let index = 0; index < points.length; index++) {
        const start = points[index];
        let end = start;
        while (points[index + 1] === end + 1) end = points[++index];
        ranges.push(`U+${start.toString(16).toUpperCase()}${end === start ? "" : `-${end.toString(16).toUpperCase()}`}`);
    }
    if (!ranges.length) throw new Error("Font has no Unicode characters");
    return ranges.join(",");
}
async function download(url: string): Promise<Buffer> {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Font source returned ${response.status}: ${url}`);
    return Buffer.from(await response.arrayBuffer());
}
function blockRange(css: string, id: string): [number, number] | undefined {
    const start = css.indexOf(marker(id));
    if (start < 0) return undefined;
    const end = css.indexOf(marker(id, true), start);
    if (end < 0) throw new Error(`Incomplete managed font block: ${id}`);
    return [start, end + marker(id, true).length];
}
function replaceBlock(css: string, id: string, block: string): string {
    const range = blockRange(css, id);
    return range ? css.slice(0, range[0]) + block + css.slice(range[1]) : css + (css && !css.endsWith("\n") ? "\n" : "") + block + "\n";
}
function paths(options: FontOptions) {
    const publicPath = options.publicPath ?? "/fonts/dopedocs";
    if (!/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(publicPath)) throw new Error("--public-path must be a local absolute URL path");
    return { file: resolve(options.file ?? "docs-theme.css"), directory: resolve(options.publicDir ?? "public", "fonts/dopedocs"), publicPath: publicPath.replace(/\/$/, "") };
}

/** Read the generated family blocks from the same host theme file used by the CLI. */
export function listFonts(options: FontOptions = {}): { id: string; family: string }[] {
    const css = readThemeFile(paths(options).file);
    return [...css.matchAll(/\/\* dopedocs font ([a-z0-9-]+):start \*\//g)].map(match => {
        const range = blockRange(css, match[1])!;
        const block = css.slice(...range);
        const family = /font-family:\s*("(?:[^"\\]|\\.)*")/.exec(block)?.[1];
        return { id: match[1], family: family ? JSON.parse(family) as string : match[1] };
    });
}

/** DEC-13: download only selected faces, stage them locally, and emit local URLs plus the licence. */
export async function addFont(input: string, options: FontOptions = {}): Promise<string> {
    const role = options.role ?? "body";
    if (!roles.includes(role)) throw new Error(`Unknown font role: ${role}`);
    let weights = options.weights ?? [400];
    if (!weights.length || weights.some(weight => !Number.isInteger(weight) || weight < 1 || weight > 1000)) throw new Error("--weights must contain integers from 1 to 1000");
    const subset = options.subset ?? "latin";
    if (!/^[a-z0-9-]+$/.test(subset)) throw new Error("Invalid font subset");
    const style = options.italic ? "italic" : "normal";
    const local = existsSync(input) || /\.(otf|ttf|woff2)$/i.test(input);
    let family: string;
    let license: Buffer;
    const faces: Face[] = [];
    if (local) {
        const path = resolve(input);
        if (![".otf", ".ttf", ".woff2"].includes(extname(path).toLowerCase())) throw new Error("Use an OTF, TTF or WOFF2 font");
        const original = readFileSync(path);
        const font = fontOf(original);
        const preferred = (font as Font & { name?: { records?: { preferredFamily?: Record<string, string> } } }).name?.records?.preferredFamily;
        family = preferred?.en ?? Object.values(preferred ?? {})[0] ?? font.familyName;
        if (!options.weights) weights = [font["OS/2"].usWeightClass || 400];
        const licensePath = options.license ?? ["OFL.txt", "LICENSE", "LICENSE.txt", "LICENCE", "LICENCE.txt"].map(name => join(dirname(path), name)).find(name => existsSync(name));
        if (!licensePath) throw new Error("Local fonts need an adjacent licence file or --license <path>");
        license = readFileSync(licensePath);
        const axis = font.variationAxes.wght;
        if (axis && weights.some(weight => weight < axis.min || weight > axis.max)) throw new Error("Requested weight is outside the local variable font range");
        if (!axis && weights.some(weight => weight !== (font["OS/2"].usWeightClass || 400))) throw new Error("Requested weight does not match the local static font; add the matching font file");
        const bytes = extname(path).toLowerCase() === ".woff2" ? original : await (await import("wawoff2")).compress(original);
        if (Buffer.from(bytes).subarray(0, 4).toString() !== "wOF2") throw new Error("Font conversion did not produce WOFF2");
        for (const weight of [...new Set(weights)]) faces.push({ bytes, weight, style: options.italic || font.italicAngle !== 0 ? "italic" : "normal", range: unicodeRange(font) });
    } else {
        const id = slug(input);
        if (!id) throw new Error("Empty font family");
        const source = (options.source ?? "https://cdn.jsdelivr.net/npm").replace(/\/$/, "");
        const metadata = JSON.parse((await download(`${source}/@fontsource/${id}@latest/package.json`)).toString()) as { version: string };
        if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/.test(metadata.version)) throw new Error("Font source returned an invalid package version");
        const base = `${source}/@fontsource/${id}@${metadata.version}`;
        license = await download(`${base}/LICENSE`);
        family = "";
        for (const weight of [...new Set(weights)]) {
            const css = parse((await download(`${base}/${weight}${options.italic ? "-italic" : ""}.css`)).toString());
            const filename = `${id}-${subset}-${weight}-${style}.woff2`;
            let range: string | undefined;
            css.walkAtRules("font-face", rule => {
                const values: Record<string, string> = {};
                rule.walkDecls(decl => { values[decl.prop] = decl.value; });
                if (!values.src?.includes(`./files/${filename})`) && !values.src?.includes(`./files/${filename}'`) && !values.src?.includes(`./files/${filename}"`)) return;
                family = values["font-family"].replace(/^['"]|['"]$/g, "");
                range = values["unicode-range"];
            });
            if (!range || !/^U\+[a-f0-9?-]+(?:,\s*U\+[a-f0-9?-]+)*$/i.test(range)) throw new Error(`Font source has no ${subset} ${weight} ${style} face for ${input}`);
            const bytes = await download(`${base}/files/${filename}`);
            if (bytes.subarray(0, 4).toString() !== "wOF2") throw new Error(`Not a WOFF2 font: ${filename}`);
            fontOf(bytes);
            faces.push({ bytes, weight, style, range });
        }
    }
    if (!family || /[\r\n\x00-\x1f]/.test(family)) throw new Error("Font has an invalid family name");
    if (!license.length) throw new Error("Font licence is empty");
    const id = slug(family);
    if (!id) throw new Error("Font family needs a usable file name");
    const target = paths(options);
    const folder = join(target.directory, id);
    let css = readThemeFile(target.file);
    const prior = parseTheme(css)[`--dd-${role}`];
    const prefix = `${quote(family)}, `;
    const stack = prior?.startsWith(prefix) ? prior : prefix + (prior ?? (role === "mono" ? "monospace" : "var(--dd-sans, sans-serif)"));
    css = updateTheme(css, role, stack);
    const oldRange = blockRange(css, id);
    const retained: string[] = [];
    if (oldRange) parse(css.slice(...oldRange)).walkAtRules("font-face", rule => {
        let weight = "", style = "normal";
        rule.walkDecls("font-weight", decl => { weight = decl.value; });
        rule.walkDecls("font-style", decl => { style = decl.value; });
        if (!faces.some(face => String(face.weight) === weight && face.style === style)) retained.push(rule.toString());
    });
    const block = [marker(id), ...retained, ...faces.map(face => `@font-face {\n    font-family: ${quote(family)};\n    font-style: ${face.style};\n    font-weight: ${face.weight};\n    font-display: swap;\n    src: url(${quote(`${target.publicPath}/${id}/${face.weight}-${face.style}.woff2`)}) format("woff2");\n    unicode-range: ${face.range};\n}`), marker(id, true)].join("\n");
    css = replaceBlock(css, id, block);
    parse(css);
    // All requests, validation and CSS edits finish before mutating the host.
    mkdirSync(folder, { recursive: true });
    for (const face of faces) writeFileSync(join(folder, `${face.weight}-${face.style}.woff2`), face.bytes);
    writeFileSync(join(folder, "LICENSE.txt"), license);
    mkdirSync(dirname(target.file), { recursive: true });
    writeFileSync(target.file, css);
    return id;
}

/** Remove an installed family while retaining unrelated CSS and host font stack entries. */
export function removeFont(input: string, options: FontOptions = {}): void {
    const target = paths(options);
    const installed = listFonts(options).find(font => font.id === slug(input));
    if (!installed) throw new Error(`Font is not installed: ${input}`);
    let css = readThemeFile(target.file);
    const range = blockRange(css, installed.id)!;
    css = css.slice(0, range[0]) + css.slice(range[1]);
    const values = parseTheme(css);
    for (const role of roles) {
        const value = values[`--dd-${role}`];
        if (value?.includes(`${quote(installed.family)}, `)) css = updateTheme(css, role, value.replace(`${quote(installed.family)}, `, ""));
    }
    writeFileSync(target.file, css);
    rmSync(join(target.directory, installed.id), { recursive: true, force: true });
}

export async function fontsCommand(args: string[]): Promise<void> {
    const [action, ...rest] = args;
    const options: FontOptions = {};
    const inputs: string[] = [];
    const flags: Record<string, keyof FontOptions> = { "--weights": "weights", "--subset": "subset", "--role": "role", "--file": "file", "--public-dir": "publicDir", "--public-path": "publicPath", "--license": "license", "--source": "source" };
    for (let index = 0; index < rest.length; index++) {
        const argument = rest[index];
        if (argument === "--italic") { options.italic = true; continue; }
        if (!argument.startsWith("--")) { inputs.push(argument); continue; }
        const key = flags[argument];
        const value = rest[++index];
        if (!key || !value || value.startsWith("--")) throw new Error(`Invalid option: ${argument}`);
        if (key === "weights") options.weights = value.split(",").map(Number);
        else Object.assign(options, { [key]: value });
    }
    if (action === "list" && !inputs.length) for (const font of listFonts(options)) console.log(`${font.id}\t${font.family}`);
    else if (action === "add" && inputs.length === 1) console.log(`Installed ${await addFont(inputs[0], options)}`);
    else if (action === "remove" && inputs.length === 1) removeFont(inputs[0], options);
    else throw new Error("Usage: dopedocs fonts add <family|path> [--weights 400,700] [--italic] [--subset latin] [--role display|body|ui|mono]; fonts list; fonts remove <family>");
}
