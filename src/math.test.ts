import { describe, expect, it } from "vitest";
import { prepareMath } from "./math.js";
import { renderBlock, renderBody } from "./render.js";
import { defineDocs, pagesOf, validate, type DocBlock } from "./schema.js";
import { buildStatic } from "./static.js";

const tex = String.raw`V = \frac{D \times P}{T \times E}`;
const fixture = (blocks: DocBlock[]) => defineDocs({
    entity: { name: "Example", url: "https://example.com", notToBeConfusedWith: [] },
    title: "Formula", lead: "Example formula.",
    facts: { time: { value: "time spent", reviewed: "2026-10-18" } },
    sections: [{ id: "chapter", title: "Chapter", children: [{
        id: "formula", title: "Formula", question: "How is value calculated?",
        answer: "Value divides the product of demand and price by time and effort.", blocks,
    }] }],
});

describe("build-time math", () => {
    it("builds accessible static MathML for display and inline formulas, with no new script", () => {
        const docs = fixture([
            { kind: "math", tex, label: "Value equals demand times price divided by time times effort",
                where: [{ symbol: "T", text: "The {fact:time}, in **hours**." }] },
            { kind: "math", tex: "x^2", display: false },
        ]);
        const prepared = prepareMath(docs);
        const html = buildStatic(prepared, { now: new Date("2026-10-18") })["docs/formula/index.html"]!;
        expect(html).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">');
        expect(html).toContain("<mfrac>");
        expect(html).toContain("<msup>");
        expect(html).toContain('<annotation encoding="application/x-tex">');
        expect(html).toContain('role="math" aria-label="Value equals demand times price divided by time times effort"');
        expect(html).toContain('<dt>T</dt><dd>The time spent, in <strong>hours</strong>.</dd>');
        expect(html).toContain('<span class="dd-math"><span class="dd-math-equation"><math');
        const scripts = (s: string) => s.match(/<script\b[^>]*>[\s\S]*?<\/script>/g) ?? [];
        const plain = buildStatic(fixture([]), { now: new Date("2026-10-18") })["docs/formula/index.html"]!;
        expect(scripts(html)).toEqual(scripts(plain));
        expect(html).not.toMatch(/katex\.(?:js|css)|mathjax/i);
        expect(renderBody(prepared)).toContain("<mfrac>");
        expect(validate(prepared, { today: new Date("2026-10-18") })).toEqual([]);
        expect(pagesOf(docs.sections)[0]!.page.blocks[0]).not.toHaveProperty("prepared");
        expect(JSON.parse(JSON.stringify(prepared))).toEqual(prepared);
    });

    it("prepares article formulas and preserves the rest of the document", () => {
        const docs = fixture([{ kind: "p", text: "Unchanged prose." }]);
        const article = { ...pagesOf(docs.sections)[0]!.page, id: "article", published: "2026-10-18", blocks: [{ kind: "math" as const, tex }] };
        const prepared = prepareMath({ ...docs, articles: [article] });
        expect(buildStatic(prepared)["articles/article/index.html"]).toContain("<mfrac>");
        expect(prepared.facts).toBe(docs.facts);
        expect(pagesOf(prepared.sections)[0]!.page.blocks).toEqual(pagesOf(docs.sections)[0]!.page.blocks);
    });

    it("rejects blank or invalid TeX and validates definition prose without interpreting TeX", () => {
        expect(() => prepareMath(fixture([{ kind: "math", tex: " " }]))).toThrow("non-empty TeX");
        expect(() => prepareMath(fixture([{ kind: "math", tex: String.raw`\frac{` }]))).toThrow();
        expect(validate(fixture([{ kind: "math", tex: " " }]))).toContainEqual(expect.objectContaining({ code: "empty-math", severity: "fatal" }));
        const docs = fixture([{ kind: "math", tex: "{fact:missing}", where: [{ symbol: "x", text: "{fact:missing} [bad](#missing)" }] }]);
        const codes = validate(docs).map(f => f.code);
        expect(codes.filter(code => code === "unknown-fact-reference")).toHaveLength(1);
        expect(codes).toContain("unknown-section-link");
    });

    it("escapes unprepared source and ignores stale prepared data after source or mode changes", () => {
        const raw: DocBlock = { kind: "math", tex: '<script>**literal** {fact:missing}</script>', label: 'a"<b>', where: [{ symbol: "<x>", text: "Safe **text**" }] };
        const html = renderBlock(raw, {}, "test");
        expect(html).toContain('&lt;script&gt;**literal** {fact:missing}&lt;/script&gt;');
        expect(html).toContain('aria-label="a&quot;&lt;b&gt;"');
        expect(html).toContain("<dt>&lt;x&gt;</dt>");
        expect(html).not.toContain("<script>");
        const block = pagesOf(prepareMath(fixture([{ kind: "math", tex }])).sections)[0]!.page.blocks[0]!;
        if (block.kind !== "math") throw new Error("wrong kind");
        expect(renderBlock({ ...block, tex: "y" }, {}, "test")).not.toContain("<math");
        expect(renderBlock({ ...block, display: false }, {}, "test")).not.toContain("<math");
    });

    it("does not allow TeX commands to create links, images, scripts or HTML", () => {
        for (const tex of [String.raw`\href{javascript:alert(1)}{x}`, String.raw`\includegraphics{https://example.com/a.png}`, String.raw`\text{<script>alert(1)</script>}`]) {
            const body = renderBody(prepareMath(fixture([{ kind: "math", tex }])));
            expect(body).not.toMatch(/<script|<img|<a\b|href=|src=/);
        }
    });
});
