import { describe, expect, it } from "vitest";

import { defineFacts } from "./facts.js";
import {
    UnknownFactError,
    escapeHtml,
    inline,
    renderBlock,
    renderBody,
    renderLead,
    renderSection,
} from "./render.js";
import { defineDocs, type DocBlock, type DocSection } from "./schema.js";

const facts = defineFacts({
    price: { value: "free", reviewed: "2026-09-02" },
    /** Deliberately hostile: the value carries markup and both inline marks. */
    hostile: { value: '<img src=x onerror="alert(1)"> **not bold** `not code`', reviewed: "2026-09-02" },
});

const where = "a test";
const render = (raw: string) => inline(raw, facts, where);

const section = (over: Partial<DocSection> = {}): DocSection => ({
    id: "s",
    title: "S",
    question: "Q?",
    answer: "A.",
    blocks: [],
    ...over,
});

describe("escaping", () => {
    it("escapes markup an author wrote as prose", () => {
        expect(render("<script>alert(1)</script>")).toBe(
            "&lt;script&gt;alert(1)&lt;/script&gt;",
        );
    });

    it("escapes ampersands and quotes", () => {
        expect(escapeHtml('Tom & "Jerry"')).toBe("Tom &amp; &quot;Jerry&quot;");
    });

    it("escapes an attribute-breaking quote before any mark is applied", () => {
        expect(render('a **"b"** c')).toBe("a <strong>&quot;b&quot;</strong> c");
    });
});

describe("inline marks", () => {
    it("renders **strong**", () => {
        expect(render("a **b** c")).toBe("a <strong>b</strong> c");
    });

    it("renders `code`", () => {
        expect(render("run `npm i`")).toBe("run <code>npm i</code>");
    });

    it("leaves an unpaired ** literal", () => {
        expect(render("2 ** 3")).toBe("2 ** 3");
    });

    it("does not let an escaped entity form a mark", () => {
        // The author wrote a literal <strong> tag; it must stay text, and the
        // real mark beside it must still render.
        expect(render("<strong>x</strong> and **y**")).toBe(
            "&lt;strong&gt;x&lt;/strong&gt; and <strong>y</strong>",
        );
    });
});

describe("fact interpolation", () => {
    it("substitutes a registry value", () => {
        expect(render("Costs {fact:price}.")).toBe("Costs free.");
    });

    it("escapes the substituted value", () => {
        expect(render("{fact:hostile}")).toContain("&lt;img src=x");
        expect(render("{fact:hostile}")).not.toContain("<img");
    });

    it("does not re-read a fact value as markup", () => {
        // Substitution runs last precisely so a value holding ** or a backtick
        // stays a literal claim rather than restyling the document.
        const out = render("{fact:hostile}");
        expect(out).not.toContain("<strong>");
        expect(out).not.toContain("<code>");
        expect(out).toContain("**not bold**");
    });

    it("fills a reference that sits inside a mark", () => {
        expect(render("**{fact:price}**")).toBe("<strong>free</strong>");
    });

    it("throws on an unknown key, naming the key and where it was found", () => {
        expect(() => inline("{fact:nope}", facts, 'section "data"')).toThrow(
            UnknownFactError,
        );
        try {
            inline("{fact:nope}", facts, 'section "data"');
        } catch (error) {
            const e = error as UnknownFactError;
            expect(e.key).toBe("nope");
            expect(e.where).toBe('section "data"');
            expect(e.message).toContain("nope");
            expect(e.message).toContain("data");
        }
    });
});

describe("block markup", () => {
    const out = (block: DocBlock) => renderBlock(block, facts, where);

    it("renders a paragraph", () => {
        expect(out({ kind: "p", text: "Hello" })).toBe('<p class="dd-p">Hello</p>');
    });

    it("renders an unordered list by default and an ordered one on request", () => {
        expect(out({ kind: "list", items: ["a", "b"] })).toBe(
            '<ul class="dd-list"><li>a</li><li>b</li></ul>',
        );
        expect(out({ kind: "list", items: ["a"], ordered: true })).toBe(
            '<ol class="dd-list"><li>a</li></ol>',
        );
    });

    it("renders a callout, defaulting its tone to note", () => {
        expect(out({ kind: "callout", text: "Mind this" })).toBe(
            '<div class="dd-callout dd-callout--note"><p>Mind this</p></div>',
        );
        expect(out({ kind: "callout", text: "x", tone: "warn" })).toContain(
            "dd-callout--warn",
        );
    });

    it("renders key rows as kbd and description pairs", () => {
        expect(out({ kind: "keys", rows: [["Esc", "Close"]] })).toBe(
            '<div class="dd-keys"><kbd>Esc</kbd><span>Close</span></div>',
        );
    });

    it("renders a table inside its own scroll container", () => {
        const html = out({ kind: "table", head: ["A", "B"], rows: [["1", "2"]] });
        expect(html).toContain('<div class="dd-table-scroll">');
        expect(html).toContain("<th>A</th><th>B</th>");
        expect(html).toContain("<td>1</td><td>2</td>");
    });

    it("renders a facts card, with the title only when given", () => {
        const withTitle = out({ kind: "facts", title: "At a glance", rows: [["Cost", "{fact:price}"]] });
        expect(withTitle).toContain('<p class="dd-facts-title">At a glance</p>');
        expect(withTitle).toContain("<dt>Cost</dt><dd>free</dd>");
        expect(out({ kind: "facts", rows: [["Cost", "free"]] })).not.toContain(
            "dd-facts-title",
        );
    });
});

describe("sections", () => {
    it("carries the id as an anchor and the answer as a lead", () => {
        const html = renderSection(section({ answer: "Example is {fact:price}." }), facts);
        expect(html).toContain('<section class="dd-section" id="s">');
        expect(html).toContain('<h2 class="dd-section-title">S</h2>');
        expect(html).toContain('<p class="dd-answer">Example is free.</p>');
    });

    it("omits the answer when asked", () => {
        expect(renderSection(section(), facts, { showAnswer: false })).not.toContain(
            "dd-answer",
        );
    });

    it("renders a child one heading level deeper, as its own anchored section", () => {
        const html = renderSection(
            section({ id: "parent", children: [section({ id: "child", title: "C" })] }),
            facts,
        );
        expect(html).toContain('<h2 class="dd-section-title">S</h2>');
        expect(html).toContain('<section class="dd-section" id="child">');
        expect(html).toContain('<h3 class="dd-section-title">C</h3>');
    });

    it("escapes a title and an id rather than trusting them", () => {
        const html = renderSection(section({ id: "a", title: '<b>"T"</b>' }), facts);
        expect(html).toContain("&lt;b&gt;&quot;T&quot;&lt;/b&gt;");
    });
});

describe("document", () => {
    const docs = defineDocs({
        entity: { name: "Example", url: "https://example.com", notToBeConfusedWith: [] },
        title: "How Example works",
        lead: "Example is {fact:price}.",
        facts,
        sections: [section({ id: "one" }), section({ id: "two" })],
    });

    it("renders the lead with facts filled", () => {
        expect(renderLead(docs)).toContain('<p class="dd-lead">Example is free.</p>');
    });

    it("renders every section in reading order", () => {
        const html = renderBody(docs);
        expect(html.indexOf('id="one"')).toBeLessThan(html.indexOf('id="two"'));
    });
});

/* ── Type-level tests ────────────────────────────────────────────────────────
   Checked by `npm run check`. This record is exhaustive over the block union,
   so adding a `DocBlock` member without teaching `renderBlock` to draw it fails
   here as well as in the switch, which has no `default` arm. */

export const everyBlockKindIsRendered: Record<DocBlock["kind"], true> = {
    p: true,
    list: true,
    callout: true,
    keys: true,
    table: true,
    facts: true,
};
