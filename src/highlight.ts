/** Optional ahead-of-time highlighting. Never imported by the core renderer. */
import { bundledLanguages, createHighlighter, type BundledLanguage, type ThemeRegistration } from "shiki";
import type { FactMap } from "./facts.js";
import { isGroup, type CodeTone, type CodeToken, type DocBlock, type DocPage, type DocSection, type DocSet } from "./schema.js";

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
        if (item.kind !== "code") return item;
        const language = item.language;
        if (!language || !Object.hasOwn(bundledLanguages, language)) return { ...item, tokens: undefined };
        const key = `${language}\0${item.code}`;
        let tokens = cache.get(key);
        if (!tokens) {
            await highlighter.loadLanguage(language as BundledLanguage);
            const lines = highlighter.codeToTokens(item.code, { lang: language as BundledLanguage, theme: theme.name! }).tokens;
            tokens = lines.flatMap((line, index) => [
                ...(index ? [{ text: "\n" }] : []),
                ...line.map((token) => ({ text: token.content, ...(tones[token.color?.toLowerCase() ?? ""] ? { tone: tones[token.color!.toLowerCase()] } : {}) })),
            ]);
            cache.set(key, tokens);
        }
        // Preserve unusual line endings exactly, falling back if tokenization
        // normalized them. Rendering independently checks this invariant too.
        return { ...item, tokens: tokens.map((token) => token.text).join("") === item.code ? tokens : undefined };
    };
    const page = async (item: DocPage): Promise<DocPage> => {
        const blocks = [];
        for (const itemBlock of item.blocks) blocks.push(await block(itemBlock));
        return { ...item, blocks };
    };
    try {
        const visit = async (items: DocSection[]): Promise<DocSection[]> => {
            const result: DocSection[] = [];
            for (const item of items) result.push(isGroup(item)
                ? { ...item, children: await visit(item.children) } : await page(item));
            return result;
        };
        const sections = await visit(docs.sections);
        return { ...docs, sections };
    } finally { highlighter.dispose(); }
}
