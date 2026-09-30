import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { defineFacts } from "./facts.js";
import {
    UnknownFactError,
    escapeHtml,
    inline,
    renderBlock,
    renderBody,
    renderIdentity,
    renderLead,
    renderSection,
} from "./render.js";
import { defineDocs, type DocBlock, type DocPage } from "./schema.js";

const facts = defineFacts({
    price: { value: "free", reviewed: "2026-09-02" },
    /** Deliberately hostile: the value carries markup and both inline marks. */
    hostile: { value: '<img src=x onerror="alert(1)"> **not bold** `not code`', reviewed: "2026-09-02" },
});

const where = "a test";
const render = (raw: string) => inline(raw, facts, where);

const section = (over: Partial<DocPage> = {}): DocPage => ({
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

    it("renders numbered instructional steps", () => {
        const html = out({
            kind: "steps",
            items: [{ title: "Choose **one** task", text: "Open it while it is {fact:price}." }],
        });
        expect(html).toContain('<ol class="dd-steps">');
        expect(html).toContain('<li class="dd-step">');
        expect(html).toContain('<p class="dd-step-title">Choose <strong>one</strong> task</p>');
        expect(html).toContain('<p class="dd-step-text">Open it while it is free.</p>');
    });

    it("renders checklist state accessibly without interactive controls", () => {
        const html = out({
            kind: "checklist",
            items: [{ text: "Finished", checked: true }, { text: "Still to do" }],
        });
        expect(html).toContain('<ul class="dd-checklist">');
        expect(html).toContain('class="dd-check is-checked"');
        expect(html).toContain('<span class="dd-visually-hidden">Complete: </span>Finished');
        expect(html).toContain('<span class="dd-visually-hidden">Not complete: </span>Still to do');
        expect(html).not.toContain("<input");
    });

    it("renders a native disclosure that works without JavaScript", () => {
        const html = out({
            kind: "details",
            summary: "Why is this **hidden**?",
            text: "It is optional.",
            open: true,
        });
        expect(html).toContain(
            '<details class="dd-details" data-dd-print="It is optional." open>',
        );
        expect(html).toContain("<summary>Why is this <strong>hidden</strong>?</summary>");
        expect(html).toContain("<p>It is optional.</p>");
    });

    it("renders linked and unlinked cards with escaped destinations", () => {
        const html = out({
            kind: "cards",
            items: [
                { title: "Start", text: "Take the tour", href: '/tour?x=1&y="2"', label: "Open" },
                { title: "Remember", text: "A plain note" },
            ],
        });
        expect(html).toContain('<a class="dd-card" href="/tour?x=1&amp;y=&quot;2&quot;">');
        expect(html).toContain('<span class="dd-card-label">Open<span aria-hidden="true"> &rarr;</span></span>');
        expect(html).toContain('<article class="dd-card">');
    });

    it("renders a semantic quotation and optional citation", () => {
        const html = out({
            kind: "quote",
            text: "Do the **next** thing.",
            attribution: "A calm guide",
            cite: "https://example.test/source?a=1&b=2",
        });
        expect(html).toContain('<blockquote cite="https://example.test/source?a=1&amp;b=2">');
        expect(html).toContain("Do the <strong>next</strong> thing.");
        expect(html).toContain("<figcaption>A calm guide</figcaption>");
    });

    it("renders metric items as a description list", () => {
        const html = out({
            kind: "metrics",
            items: [{ value: "{fact:price}", label: "Price", detail: "Forever" }],
        });
        expect(html).toContain('<dl class="dd-metrics">');
        expect(html).toContain("<dt>Price</dt>");
        expect(html).toContain('<span class="dd-metric-value">free</span>');
        expect(html).toContain('<span class="dd-metric-detail">Forever</span>');
    });

    it("renders a two-sided comparison", () => {
        const html = out({
            kind: "compare",
            before: { title: "Before", text: "A scattered list" },
            after: { title: "After", text: "One clear next step" },
        });
        expect(html).toContain('<div class="dd-compare">');
        expect(html).toContain('dd-compare-item--before');
        expect(html).toContain('dd-compare-item--after');
        expect(html).toContain("One clear next step");
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

    it("renders a group as a label over its pages, with no section or body of its own", () => {
        const html = renderSection(
            { id: "chapter", title: "Chapter", children: [section({ id: "a", title: "A" }), section({ id: "b", title: "B" })] },
            facts,
        );
        expect(html).toContain('<p class="dd-group-label">Chapter</p>');
        expect(html).not.toContain('id="chapter"');
        expect(html).toContain('<section class="dd-section" id="a">');
        // Pages in a group keep the page heading level; the label is not a heading.
        expect(html).toContain('<h2 class="dd-section-title">B</h2>');
        expect(html.match(/<section /g)).toHaveLength(2);
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
    steps: true,
    checklist: true,
    details: true,
    cards: true,
    quote: true,
    metrics: true,
    compare: true,
    keys: true,
    table: true,
    facts: true,
    image: true,
    gallery: true,
    video: true,
};

/* ── Release identity ────────────────────────────────────────────────────── */

describe("release identity", () => {
    const base = { name: "No Ceremony" };

    it("renders nothing when a document declares no identity", () => {
        const docs = defineDocs({
            entity: { name: "E", url: "https://e.com", notToBeConfusedWith: [] },
            title: "T",
            lead: "L",
            facts,
            sections: [],
        });
        expect(renderLead(docs)).not.toContain("dd-identity");
    });

    it("renders the card when one is declared", () => {
        const html = renderIdentity({
            ...base,
            version: "0.1.0",
            channel: "Preview",
            maker: { name: "Strange Systems" },
        });
        expect(html).toContain('<p class="dd-identity-name">No Ceremony</p>');
        expect(html).toContain("<span>Version 0.1.0</span>");
        expect(html).toContain("<span>Preview</span>");
        expect(html).toContain("<span>by Strange Systems</span>");
    });

    it("omits absent fields rather than leaving a dangling separator", () => {
        const html = renderIdentity(base);
        expect(html).not.toContain("dd-identity-meta");
        expect(html).not.toContain("dd-identity-dot");

        const one = renderIdentity({ ...base, version: "1.0" });
        expect(one).toContain("dd-identity-meta");
        expect(one).not.toContain("dd-identity-dot");

        const two = renderIdentity({ ...base, version: "1.0", channel: "Beta" });
        expect(two.match(/dd-identity-dot/g)).toHaveLength(1);
    });

    it("links the maker when given an href", () => {
        const html = renderIdentity({ ...base, maker: { name: "SS", href: "#who" } });
        expect(html).toContain('href="#who"');
        expect(html).toContain('data-dd-link="who"');
    });

    it("escapes every text field", () => {
        const html = renderIdentity({
            name: '<script>x</script>',
            version: '"1"',
            maker: { name: "<b>M</b>", href: '"><img>' },
        });
        expect(html).toContain("&lt;script&gt;");
        expect(html).not.toContain("<script>x");
        expect(html).toContain("&quot;1&quot;");
        expect(html).not.toContain("<img>");
    });

    it("passes the brandmark through as markup, since it is inline SVG", () => {
        const html = renderIdentity({ ...base, mark: "<svg><circle r='2'/></svg>" });
        expect(html).toContain("<svg><circle r='2'/></svg>");
    });

    it("places the identity above the title in the lead", () => {
        const docs = defineDocs({
            entity: { name: "E", url: "https://e.com", notToBeConfusedWith: [] },
            identity: { ...base, version: "0.1.0" },
            title: "How it works",
            lead: "Lead.",
            facts,
            sections: [],
        });
        const html = renderLead(docs);
        expect(html.indexOf("dd-identity")).toBeLessThan(html.indexOf("dd-title"));
    });
});

/* ── Marks (ENG-06) ──────────────────────────────────────────────────────── */

describe("brandmarks", () => {
    it("emits inline SVG as markup", () => {
        const html = renderIdentity({ name: "App", mark: '<svg viewBox="0 0 1 1"></svg>' });
        expect(html).toContain(
            '<span class="dd-identity-mark" aria-hidden="true"><svg viewBox="0 0 1 1"></svg></span>',
        );
        expect(html).not.toContain("<img");
    });

    it("treats anything else as the URL of an image", () => {
        for (const src of ["/logo.png", "logo.jpg", "https://cdn.test/m.svg", "/a.webp"]) {
            const html = renderIdentity({ name: "App", mark: src });
            expect(html).toContain(`<img src="${src}" alt="">`);
        }
    });

    it("escapes a URL, so a mark cannot inject markup", () => {
        const html = renderIdentity({ name: "App", mark: '/x.png" onerror="alert(1)' });
        expect(html).toContain("&quot;");
        expect(html).not.toContain('onerror="alert(1)"');
    });

    it("leading whitespace does not make SVG look like a URL", () => {
        const html = renderIdentity({ name: "App", mark: "\n  <svg></svg>" });
        expect(html).not.toContain("<img");
    });

    it("puts a mark on a facts card, beside its title", () => {
        const html = renderBlock({
            kind: "facts",
            title: "Strange Systems",
            mark: "/glyph.png",
            rows: [["Based in", "Eugene, Oregon"]],
        }, {}, "a facts card");
        expect(html).toContain('<div class="dd-facts-head">');
        expect(html).toContain('<span class="dd-facts-mark" aria-hidden="true">');
        expect(html).toContain('<img src="/glyph.png" alt="">');
        expect(html).toContain('<p class="dd-facts-title">Strange Systems</p>');
    });

    it("links a facts card's head to its subject's site, in a new tab when external", () => {
        const html = renderBlock({
            kind: "facts",
            title: "Strange Systems",
            mark: "/glyph.png",
            href: "https://strangesystems.dev/",
            rows: [["Based in", "Eugene, Oregon"]],
        }, {}, "a facts card");
        expect(html).toContain('<a class="dd-facts-head dd-facts-link" href="https://strangesystems.dev/" target="_blank" rel="noopener">');
        expect(html).toContain('<span class="dd-facts-url">strangesystems.dev<span aria-hidden="true"> ↗</span></span></a>');
        expect(html).toContain('<img src="/glyph.png" alt="">');
    });

    it("leaves a facts card without a mark exactly as it was", () => {
        const html = renderBlock({
            kind: "facts",
            title: "Strange Systems",
            rows: [["Based in", "Eugene, Oregon"]],
        }, {}, "a facts card");
        expect(html).toBe(
            '<div class="dd-facts"><p class="dd-facts-title">Strange Systems</p>' +
                '<dl class="dd-facts-rows"><dt>Based in</dt><dd>Eugene, Oregon</dd></dl></div>',
        );
    });
});

/* ── Pictures and video (ENG-07) ─────────────────────────────────────────── */

describe("image and video blocks", () => {
    const render = (block: DocBlock) => renderBlock(block, {}, "a media block");

    it("renders a picture with its alt, inside a figure", () => {
        const html = render({ kind: "image", src: "/shot.png", alt: "The order, top first" });
        expect(html).toBe(
            '<figure class="dd-figure"><img class="dd-media dd-media--center" src="/shot.png"' +
                ' alt="The order, top first" loading="lazy" decoding="async"></figure>',
        );
    });

    it("reserves space when told the dimensions", () => {
        const html = render({
            kind: "image",
            src: "/shot.png",
            alt: "A screenshot",
            width: 1200,
            height: 800,
        });
        expect(html).toContain('width="1200" height="800"');
    });

    it("renders responsive and art-directed candidates with loading hints", () => {
        const html = render({
            kind: "image",
            src: "/wide-1200.jpg",
            srcset: "/wide-640.jpg 640w, /wide-1200.jpg 1200w",
            sizes: "(max-width: 700px) 100vw, 660px",
            sources: [
                { srcset: "/portrait.webp", media: "(max-width: 500px)", type: "image/webp" },
            ],
            alt: "A responsive product screen",
            loading: "eager",
            fetchPriority: "high",
            position: "top",
        });
        expect(html).toContain("<picture>");
        expect(html).toContain(
            '<source srcset="/portrait.webp" media="(max-width: 500px)" type="image/webp">',
        );
        expect(html).toContain('srcset="/wide-640.jpg 640w, /wide-1200.jpg 1200w"');
        expect(html).toContain('sizes="(max-width: 700px) 100vw, 660px"');
        expect(html).toContain('loading="eager" fetchpriority="high"');
        expect(html).toContain("dd-media--top");
    });

    it("can link a figure to its full-size rendition", () => {
        const html = render({
            kind: "image",
            src: "/small.jpg",
            href: '/original.jpg?download="yes"',
            alt: "A linked product screen",
        });
        expect(html).toContain(
            '<a class="dd-media-link" href="/original.jpg?download=&quot;yes&quot;">',
        );
        expect(html).toContain("</a></figure>");
    });

    it("renders an accessible gallery with individually captioned figures", () => {
        const html = render({
            kind: "gallery",
            columns: 3,
            label: "Three ways to view the list",
            images: [
                { src: "/one.png", alt: "Day view", caption: "**Day** view" },
                { src: "/two.png", alt: "Week view" },
            ],
        });
        expect(html).toContain(
            '<div class="dd-gallery dd-gallery--3" role="group" aria-label="Three ways to view the list">',
        );
        expect(html.match(/<figure class="dd-gallery-item">/g)).toHaveLength(2);
        expect(html).toContain('<figcaption class="dd-figcaption"><strong>Day</strong> view</figcaption>');
    });

    it("renders a caption as prose, with marks and facts", () => {
        const html = renderBlock(
            { kind: "image", src: "/s.png", alt: "A shot", caption: "It is **{fact:price}**." },
            { price: { value: "free", reviewed: "2026-09-02" } },
            "a media block",
        );
        expect(html).toContain(
            '<figcaption class="dd-figcaption">It is <strong>free</strong>.</figcaption>',
        );
    });

    it("renders a video with controls and no autoplay", () => {
        const html = render({ kind: "video", src: "/tour.mp4", poster: "/tour.jpg" });
        expect(html).toContain('<video class="dd-media" src="/tour.mp4"');
        expect(html).toContain('poster="/tour.jpg"');
        expect(html).toContain("controls");
        expect(html).toContain('preload="metadata"');
        expect(html).not.toContain("autoplay");
    });

    it("escapes a src and an alt, so neither can inject markup", () => {
        const html = render({
            kind: "image",
            src: '/x.png" onerror="alert(1)',
            alt: '"><script>alert(1)</script>',
        });
        expect(html).not.toContain("<script>");
        expect(html).not.toContain('onerror="alert(1)"');
        expect(html).toContain("&quot;");
    });
});

describe("manual accessibility presentation", () => {
    const stylesheet = readFileSync(
        new URL("../styles/dopedocs.css", import.meta.url),
        "utf8",
    );

    it("publishes reduced-motion and forced-colors adaptations", () => {
        expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
        expect(stylesheet).toContain("@media (forced-colors: active)");
        expect(stylesheet).toContain(".dd-media-link:focus-visible");
    });

    it("publishes a print layout that expands disclosures and avoids clipped tables", () => {
        expect(stylesheet).toContain("@media print");
        expect(stylesheet).toContain(".dd-details::details-content");
        expect(stylesheet).toContain("content: attr(data-dd-print)");
        expect(stylesheet).toContain(":root:root");
        expect(stylesheet).toContain("*:has(> .dd-overlay.is-open)");
        expect(stylesheet).toMatch(/\.dd-table-scroll\s*\{\s*overflow: visible;/);
        expect(stylesheet).toMatch(/\.dd-gallery-item,[\s\S]*break-inside: avoid;/);
    });
});
