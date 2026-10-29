/** Host-owned theme CSS, shared by terminal tools and the studio (DEC-12). */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parse, type Declaration, type Rule } from "postcss";

export function normalizeThemeToken(token: string): string {
    const name = token.startsWith("--dd-") ? token : `--dd-${token}`;
    if (!/^--dd-[a-z][a-z0-9-]*$/.test(name)) throw new Error(`Invalid theme token: ${token}`);
    return name;
}

/** The shipped documentation is the token registry; no second theme schema (DEC-05). */
export function documentedThemeTokens(): string[] {
    const text = readFileSync(new URL("../styles/TOKENS.md", import.meta.url), "utf8");
    return [...new Set(text.match(/--dd-[a-z0-9-]+/g) ?? [])].sort();
}

function themeRoot(css: string): Rule | undefined {
    const roots = parse(css).nodes.filter((node): node is Rule => node.type === "rule" && node.selector === ":root");
    return roots.find(rule => rule.nodes.some(node => node.type === "comment" && node.text.trim() === "dopedocs theme")) ?? roots.at(-1);
}

function declarations(rule: Rule | undefined): Declaration[] {
    return rule?.nodes.filter((node): node is Declaration => node.type === "decl") ?? [];
}

export function parseTheme(css: string): Record<string, string> {
    const values: Record<string, string> = {};
    const important = new Set<string>();
    for (const decl of declarations(themeRoot(css))) {
        if (!decl.prop.startsWith("--dd-") || (important.has(decl.prop) && !decl.important)) continue;
        values[decl.prop] = decl.value.trim() + (decl.important ? " !important" : "");
        if (decl.important) important.add(decl.prop);
    }
    return values;
}

/** DEC-12: splice only the selected declaration; preserve all unrelated CSS bytes. */
export function updateTheme(css: string, token: string, value?: string): string {
    const name = normalizeThemeToken(token);
    // PostCSS offsets omit a BOM, so keep it outside the parsed text.
    if (css.startsWith("\uFEFF")) return "\uFEFF" + updateTheme(css.slice(1), name, value);
    let replacement: Declaration | undefined;
    if (value !== undefined) {
        if (!value.trim()) throw new Error("Theme values must not be empty");
        const parsed = parse(`:root { ${name}: ${value}; }`);
        const rule = parsed.first;
        if (parsed.nodes.length !== 1 || rule?.type !== "rule" || rule.nodes.length !== 1 || rule.first?.type !== "decl" || rule.first.prop !== name) {
            throw new Error("Expected one CSS value, without extra declarations or rules");
        }
        replacement = rule.first;
    }
    const rule = themeRoot(css);
    const matches = declarations(rule).filter(decl => decl.prop === name);
    if (replacement && matches.length) {
        const decl = matches.filter(item => item.important).at(-1) ?? matches.at(-1)!;
        const start = decl.source!.start!.offset!;
        const end = decl.source!.end!.offset!;
        decl.value = replacement.value;
        decl.important = replacement.important;
        return css.slice(0, start) + decl.toString() + (css.slice(start, end).endsWith(";") ? ";" : "") + css.slice(end);
    }
    if (!replacement) {
        for (const decl of matches.reverse()) css = css.slice(0, decl.source!.start!.offset!) + css.slice(decl.source!.end!.offset!);
        return css;
    }
    const newline = css.includes("\r\n") ? "\r\n" : "\n";
    if (!rule) return css + (css && !css.endsWith("\n") ? newline : "") + `:root {${newline}    /* dopedocs theme */${newline}    ${name}: ${value};${newline}}${newline}`;
    const end = rule.source!.end!.offset! - 1;
    const last = rule.last;
    const needsSemicolon = last?.type === "decl" && !css.slice(last.source!.start!.offset!, last.source!.end!.offset!).endsWith(";");
    return css.slice(0, end) + (needsSemicolon ? ";" : "") + `${newline}    ${name}: ${value};${newline}` + css.slice(end);
}

export function readThemeFile(path: string): string {
    try { return readFileSync(path, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""; throw error; }
}

export function writeThemeToken(path: string, token: string, value?: string): void {
    writeThemeTokens(path, { [token]: value ?? null });
}

/** Validate and compose the entire batch before making one host-file write. */
export function writeThemeTokens(path: string, tokens: Record<string, string | null>): void {
    const before = readThemeFile(path);
    let after = before;
    for (const [token, value] of Object.entries(tokens)) {
        after = updateTheme(after, token, value ?? undefined);
    }
    if (after === before) return;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, after);
}
