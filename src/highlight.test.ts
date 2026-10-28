import { describe, expect, it } from "vitest";
import { prepareCode } from "./highlight.js";
import { renderBlock } from "./render.js";
import { defineDocs, pagesOf, validate, type DocBlock } from "./schema.js";
import { buildStatic } from "./static.js";

describe("literal code blocks", () => {
    it("escapes source and never interprets marks or fact syntax", () => {
        const html = renderBlock({ kind: "code", code: '<script>**bold** {fact:missing}</script>', caption: "A **literal** example" }, {}, "test");
        expect(html).toContain('&lt;script&gt;**bold** {fact:missing}&lt;/script&gt;');
        expect(html).not.toContain('<script>');
        expect(html).toContain('<strong>literal</strong>');
        expect(html).toContain('tabindex="0"');
    });
    it("ignores stale prepared tokens that disagree with source", () => {
        const html = renderBlock({ kind: "code", code: "safe source", tokens: [{ text: "other source", tone: "keyword" }] }, {}, "test");
        expect(html).toContain('<code>safe source</code>');
        expect(html).not.toContain('other source');
    });
    it("escapes prepared token text rather than trusting highlighted HTML", () => {
        const html = renderBlock({ kind: "code", code: "<img>", tokens: [{ text: "<img>", tone: "string" }] }, {}, "test");
        expect(html).toContain('dd-code-token--string">&lt;img&gt;</span>');
    });
});

describe("ahead-of-time highlighting", () => {
    it("preserves literal source on both surfaces, including unknown languages and CRLF", async () => {
        const source = 'const text = "<b>{fact:missing}</b>";\nconsole.log(text);\n';
        const blocks: DocBlock[] = [
            { kind: "code", code: source, language: "javascript" },
            { kind: "code", code: "a\r\nb\r\n", language: "js" },
            { kind: "code", code: "**literal**", language: "not-a-language" },
        ];
        const docs = defineDocs({entity:{name:"Example",url:"https://example.test",notToBeConfusedWith:[]},title:"Manual",lead:"Example manual.",facts:{},sections:[{id:"chapter",title:"Chapter",children:[{id:"code",title:"Code",question:"What is the sample?",answer:"Example shows literal source.",blocks}]}]});
        const prepared = await prepareCode(docs);
        expect(validate(prepared)).toEqual([]);
        expect(blocks[0]).not.toHaveProperty("tokens");
        const preparedBlocks = pagesOf(prepared.sections)[0]!.page.blocks;
        const first = preparedBlocks[0]!;
        if (first.kind !== "code") throw new Error("wrong kind");
        expect(first.tokens?.map(t => t.text).join("")).toBe(source);
        expect(first.tokens?.some(t => t.tone === "keyword")).toBe(true);
        const unknown = preparedBlocks[2]!;
        if (unknown.kind !== "code") throw new Error("wrong kind");
        expect(unknown.tokens).toBeUndefined();
        const html = buildStatic(prepared, {now:new Date("2026-10-18")})["docs/code/index.html"]!;
        expect(html).toContain('dd-code-token--keyword');
        expect(html).toContain('a\r\nb\r\n');
        expect(html).toContain('**literal**');
        expect(html).not.toContain('style="color:');
        // Highlighting adds no client script; only the shared skip link does.
        expect(html.replace('<script src="/docs/skip.js" defer></script>', '')).not.toContain('<script src');
    });
});
