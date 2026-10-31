/** Optional ahead-of-time highlighting. Never imported by the core renderer. */
import { bundledLanguages, createHighlighter, type BundledLanguage, type ThemeRegistration } from "shiki";
import type { FactMap } from "./facts.js";
import { isGroup, type CodeTone, type CodeToken, type DocBlock, type DocPage, type DocSection, type DocSet, type ReferenceCode } from "./schema.js";

// Marker colors classify tokens; no Shiki palette or HTML enters the renderer.
const tones: Record<string, CodeTone> = {
    "#000001": "keyword", "#000002": "string", "#000003": "number",
    "#000004": "comment", "#000005": "function", "#000006": "type", "#000007": "punctuation",
};
const theme: ThemeRegistration = {
    name: "dopedocs-semantic", type: "light",
    settings: [
        { settings: { foreground: "#000000", background: "#ffffff" } },
        { scope: ["keyword", "storage"], settings: { foreground: "#000001" } },
        { scope: "string", settings: { foreground: "#000002" } },
        { scope: "constant.numeric", settings: { foreground: "#000003" } },
        { scope: "comment", settings: { foreground: "#000004" } },
        { scope: ["entity.name.function", "support.function"], settings: { foreground: "#000005" } },
        { scope: ["entity.name.type", "support.type"], settings: { foreground: "#000006" } },
        { scope: "punctuation", settings: { foreground: "#000007" } },
    ],
};

/** Prepare a new document for BOTH panel and static rendering. Run in a build
 * or content-preparation step and serialize/bundle the returned plain data.
 * Missing/unsupported languages retain literal pre/code with no highlighting. */
export async function prepareCode<F extends FactMap>(docs: DocSet<F>): Promise<DocSet<F>> {
    const highlighter = await createHighlighter({ themes: [theme], langs: [] });
    const cache = new Map<string, CodeToken[]>();
    const block = async (item: DocBlock): Promise<DocBlock> => {
        if (item.kind === "tabs") {
            const panes = [];
            for (const pane of item.panes) panes.push({ ...pane, blocks: await prepareBlocks(pane.blocks) });
            return { ...item, panes };
        }
        if (item.kind === "disclosure") return { ...item, blocks: await prepareBlocks(item.blocks) };
        if (item.kind !== "code") return item;
        return { ...item, tokens: await tokenize(item.language, item.code) };
    };
    /** Tokens for one sample, or undefined for a missing or unsupported language. */
    const tokenize = async (language: string | undefined, code: string): Promise<CodeToken[] | undefined> => {
        if (!language || !Object.hasOwn(bundledLanguages, language)) return undefined;
        const key = `${language}\0${code}`;
        let tokens = cache.get(key);
        if (!tokens) {
            await highlighter.loadLanguage(language as BundledLanguage);
            const lines = highlighter.codeToTokens(code, { lang: language as BundledLanguage, theme: theme.name! }).tokens;
            tokens = lines.flatMap((line, index) => [
                ...(index ? [{ text: "\n" }] : []),
                ...line.map((token) => ({ text: token.content, ...(tones[token.color?.toLowerCase() ?? ""] ? { tone: tones[token.color!.toLowerCase()] } : {}) })),
            ]);
            cache.set(key, tokens);
        }
        // Preserve unusual line endings exactly, falling back if tokenization
        // normalized them. Rendering independently checks this invariant too.
        return tokens.map((token) => token.text).join("") === code ? tokens : undefined;
    };
    /** A reference's code panels, every sample tokenized (DEC-20). */
    const panels = async (code: ReferenceCode[] | undefined): Promise<ReferenceCode[] | undefined> => {
        if (!code) return code;
        const out: ReferenceCode[] = [];
        for (const panel of code) {
            const samples = [];
            for (const sample of panel.samples) samples.push({ ...sample, tokens: await tokenize(sample.language, sample.code) });
            out.push({ ...panel, samples });
        }
        return out;
    };
    const prepareBlocks = async (items: DocBlock[]): Promise<DocBlock[]> => {
        const blocks = [];
        for (const item of items) blocks.push(await block(item));
        return blocks;
    };
    const page = async <P extends DocPage>(item: P): Promise<P> => ({ ...item, blocks: await prepareBlocks(item.blocks) });
    try {
        const visit = async (items: DocSection[]): Promise<DocSection[]> => {
            const result: DocSection[] = [];
            for (const item of items) result.push(isGroup(item)
                ? { ...item, ...(item.landing ? { landing: await page(item.landing) } : {}), children: await visit(item.children) } : await page(item));
            return result;
        };
        const sections = await visit(docs.sections);
        const reference = docs.reference && {
            ...(await page(docs.reference)),
            code: await panels(docs.reference.code),
            groups: await Promise.all(docs.reference.groups.map(async (group) => ({
                ...group,
                entries: await Promise.all(group.entries.map(async (entry) => ({
                    ...entry,
                    ...(entry.blocks ? { blocks: await prepareBlocks(entry.blocks) } : {}),
                    code: await panels(entry.code),
                }))),
            }))),
        };
        return {
            ...docs, sections,
            ...(docs.articles ? { articles: await Promise.all(docs.articles.map(page)) } : {}),
            ...(reference ? { reference } : {}),
        };
    } finally { highlighter.dispose(); }
}
