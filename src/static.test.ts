import { describe, expect, it } from "vitest";

import { defineFacts } from "./facts.js";
import { defineDocs, type DocSet } from "./schema.js";
import {
    DEFAULT_SEARCH_BOTS,
    DEFAULT_TRAINING_BOTS,
    InvalidDocumentError,
    buildStatic,
} from "./static.js";
import { mergeCrawlerFile } from "./vite.js";

const facts = defineFacts({
    price: { value: "free", reviewed: "2026-09-02" },
});

const docs = defineDocs({
    entity: {
        name: "No Ceremony",
        url: "https://noceremony.app",
        legalName: "Strange Systems",
        tagline: "A day organiser that decides the order of your work.",
        notToBeConfusedWith: ["No Ceremony (band)", "Ceremony"],
        sameAs: ["https://github.com/junovhs"],
    },
    title: "How No Ceremony works",
    lead: "No Ceremony decides the order of your work, and it is {fact:price}.",
    facts,
    sections: [
        {
            id: "what-it-is",
            title: "What this is",
            question: "What is No Ceremony?",
            answer: "No Ceremony is a day organiser that decides which task to start next, and it is {fact:price}.",
            keywords: ["task order", "decision fatigue"],
            blocks: [{ kind: "p", text: "Storage tools keep work; this one orders it." }],
        },
        {
            id: "your-data",
            title: "Your data",
            children: [
                {
                    id: "data",
                    title: "Where it lives",
                    question: "Where does No Ceremony store my data?",
                    answer: "No Ceremony stores your list in your browser, with optional sync when signed in.",
                    blocks: [{ kind: "p", text: "Nothing leaves the device unless you sign in." }],
                },
                {
                    id: "export",
                    title: "Export",
                    question: "Can I export my No Ceremony data?",
                    answer: "No Ceremony exports the whole list as JSON at any time.",
                    blocks: [{ kind: "p", text: "Use the export control in settings." }],
                },
            ],
        },
    ],
});

const now = new Date("2026-09-02T00:00:00Z");
const out = buildStatic(docs, { now });
const graphOf = (html: string) =>
    JSON.parse(
        html
            .split('<script type="application/ld+json">')[1]!
            .split("</script>")[0]!
            .replace(/\\u003c/g, "<"),
    );
const nodesOf = (html: string) => graphOf(html)["@graph"] as Record<string, unknown>[];
const nodeOf = (html: string, type: string) =>
    nodesOf(html).find((n) => n["@type"] === type)!;

describe("the written tree", () => {
    it("emits an index, a page per page (groups get none), and the crawler files", () => {
        expect(Object.keys(out).sort()).toEqual([
            "docs/data/index.html",
            "docs/export/index.html",
            "docs/index.html",
            "docs/what-it-is/index.html",
            "llms.txt",
            "questions.json",
            "robots.txt",
            "sitemap.xml",
        ]);
    });

    it("honours a custom base path", () => {
        const custom = buildStatic(docs, { now, basePath: "/help/" });
        expect(Object.keys(custom)).toContain("help/what-it-is/index.html");
        expect(custom["help/index.html"]).toContain("https://noceremony.app/help/");
    });
});

describe("a section page", () => {
    const html = out["docs/what-it-is/index.html"]!;

    it("carries its heading and prose in the served HTML, with no JavaScript", () => {
        expect(html).toContain("<h1 class=\"dd-section-title\">What this is</h1>");
        expect(html).toContain("Storage tools keep work; this one orders it.");
        expect(html).not.toContain("<script src");
    });

    it("declares its own canonical URL", () => {
        expect(html).toContain(
            '<link rel="canonical" href="https://noceremony.app/docs/what-it-is/">',
        );
    });

    it("uses the section answer as its description, with facts filled", () => {
        expect(html).toContain(
            '<meta name="description" content="No Ceremony is a day organiser that decides which task to start next, and it is free.">',
        );
    });

    it("links the previous and next sections and the index", () => {
        expect(html).toContain('rel="next" href="/docs/data/"');
        expect(html).toContain("Complete manual (one page)");
    });
});

describe("the entity graph", () => {
    it("uses one identical @id across every page", () => {
        const ids = Object.entries(out)
            .filter(([path]) => path.endsWith(".html"))
            .map(([, html]) => (nodeOf(html, "Organization") as { "@id": string })["@id"]);
        expect(new Set(ids)).toEqual(new Set(["https://noceremony.app/#entity"]));
    });

    it("names the collision terms in disambiguatingDescription", () => {
        const entity = nodeOf(out["docs/index.html"]!, "Organization");
        expect(entity["disambiguatingDescription"]).toBe(
            "No Ceremony is not affiliated with No Ceremony (band), Ceremony.",
        );
    });

    it("carries legalName and sameAs when given", () => {
        const entity = nodeOf(out["docs/index.html"]!, "Organization");
        expect(entity["legalName"]).toBe("Strange Systems");
        expect(entity["sameAs"]).toEqual(["https://github.com/junovhs"]);
    });

    it("takes a different schema.org type on request", () => {
        const app = buildStatic(docs, { now, entityType: "SoftwareApplication" });
        expect(nodeOf(app["docs/index.html"]!, "SoftwareApplication")).toBeTruthy();
    });

    it("builds the index FAQ from every section's question and answer", () => {
        const faq = nodeOf(out["docs/index.html"]!, "FAQPage") as {
            mainEntity: { name: string; acceptedAnswer: { text: string } }[];
        };
        expect(faq.mainEntity).toHaveLength(3);
        expect(faq.mainEntity[0]!.name).toBe("What is No Ceremony?");
        // The fact is filled in the structured data, not left as a placeholder:
        // the machine-readable value and the visible sentence are one string.
        expect(faq.mainEntity[0]!.acceptedAnswer.text).toContain("it is free");
        expect(faq.mainEntity[0]!.acceptedAnswer.text).not.toContain("{fact:");
    });

    it("gives a page a TechArticle and a breadcrumb that skips its group, which has no URL", () => {
        const html = out["docs/export/index.html"]!;
        expect(nodeOf(html, "TechArticle")["headline"]).toBe("Export");
        const crumbs = nodeOf(html, "BreadcrumbList") as {
            itemListElement: { name: string; position: number }[];
        };
        expect(crumbs.itemListElement.map((c) => c.name)).toEqual([
            "How No Ceremony works",
            "Export",
        ]);
    });

    it("escapes < so a fact value cannot close the script tag early", () => {
        const hostile = buildStatic(
            {
                ...docs,
                facts: {
                    price: { value: "</script><img src=x>", reviewed: "2026-09-02" },
                },
            } as DocSet,
            { now },
        );
        const html = hostile["docs/index.html"]!;
        const block = html.split('<script type="application/ld+json">')[1]!;
        expect(block.split("</script>")[0]).not.toContain("<img");
        expect(html).toContain("\\u003c/script>");
        // And it still parses back to the original string.
        expect(JSON.stringify(graphOf(html))).toContain("</script><img src=x>");
    });
});

describe("sitemap.xml", () => {
    const xml = out["sitemap.xml"]!;

    it("declares the XML prolog and namespace", () => {
        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
        expect(xml).toContain(
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        );
    });

    it("lists the index and every section as canonical absolute URLs", () => {
        const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
        expect(locs).toEqual([
            "https://noceremony.app/docs/",
            "https://noceremony.app/docs/what-it-is/",
            "https://noceremony.app/docs/data/",
            "https://noceremony.app/docs/export/",
        ]);
        expect(locs.every((l) => l.startsWith("https://"))).toBe(true);
    });
});

describe("robots.txt", () => {
    const txt = out["robots.txt"]!;

    it("allows every named search crawler", () => {
        for (const bot of DEFAULT_SEARCH_BOTS) {
            expect(txt).toContain(`User-agent: ${bot}\nAllow: /`);
        }
    });

    it("disallows every named training crawler", () => {
        for (const bot of DEFAULT_TRAINING_BOTS) {
            expect(txt).toContain(`User-agent: ${bot}\nDisallow: /`);
        }
    });

    it("points at the sitemap", () => {
        expect(txt).toContain("Sitemap: https://noceremony.app/sitemap.xml");
    });

    it("lets a consumer decide their own policy in either direction", () => {
        const permissive = buildStatic(docs, {
            now,
            robots: { allowTraining: true, training: ["GPTBot"] },
        })["robots.txt"]!;
        expect(permissive).toContain("User-agent: GPTBot\nAllow: /");

        const closed = buildStatic(docs, {
            now,
            robots: { allowSearch: false, search: ["PerplexityBot"] },
        })["robots.txt"]!;
        expect(closed).toContain("User-agent: PerplexityBot\nDisallow: /");
    });
});

describe("llms.txt and questions.json", () => {
    it("lists every section with its question, answer and URL", () => {
        const txt = out["llms.txt"]!;
        for (const title of ["What this is", "Where it lives", "Export"]) {
            expect(txt).toContain(`### ${title}`);
        }
        expect(txt).toContain("Not to be confused with: No Ceremony (band), Ceremony.");
        expect(txt).toContain("https://noceremony.app/docs/export/");
    });

    it("emits the prompt set as parseable JSON with one entry per section", () => {
        const parsed = JSON.parse(out["questions.json"]!);
        expect(parsed.questions).toHaveLength(3);
        expect(parsed.questions[2]).toEqual({
            id: "export",
            question: "Can I export my No Ceremony data?",
            answer: "No Ceremony exports the whole list as JSON at any time.",
            url: "https://noceremony.app/docs/export/",
        });
    });
});

describe("refusing to publish a faulty document", () => {
    it("throws rather than emitting anything, listing the findings", () => {
        const broken: DocSet = {
            ...docs,
            sections: [
                {
                    id: "Bad Id",
                    title: "Bad",
                    question: "Is this valid?",
                    answer: "It is not.",
                    blocks: [],
                },
            ],
        };
        expect(() => buildStatic(broken, { now })).toThrow(InvalidDocumentError);
        try {
            buildStatic(broken, { now });
        } catch (error) {
            const e = error as InvalidDocumentError;
            expect(e.findings.map((f) => f.code)).toContain("invalid-section-id");
            expect(e.findings.map((f) => f.code)).toContain("answer-opens-with-pronoun");
            expect(e.message).toContain("Bad Id");
        }
    });

    it("does not block on an advisory finding such as a stale fact", () => {
        const stale: DocSet = {
            ...docs,
            facts: { price: { value: "free", reviewed: "2020-01-01" } },
        };
        expect(() => buildStatic(stale, { now })).not.toThrow();
    });
});

describe("stylesheet links", () => {
    const linksIn = (html: string) =>
        [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);

    it("links none by default", () => {
        expect(linksIn(out["docs/index.html"]!)).toEqual([]);
    });

    it("links a single href, as before", () => {
        const one = buildStatic(docs, { now, stylesheet: "/docs.css" });
        expect(linksIn(one["docs/index.html"]!)).toEqual(["/docs.css"]);
        expect(linksIn(one["docs/data/index.html"]!)).toEqual(["/docs.css"]);
    });

    it("links every href of an array, in order", () => {
        // Order is the point: the consumer's aliases must come after dopedocs'
        // own sheet or they cannot override its tokens.
        const many = buildStatic(docs, {
            now,
            stylesheet: ["/docs/dopedocs.css", "/docs-theme.css"],
        });
        expect(linksIn(many["docs/index.html"]!)).toEqual([
            "/docs/dopedocs.css",
            "/docs-theme.css",
        ]);
        expect(linksIn(many["docs/the-order/index.html"] ?? many["docs/data/index.html"]!)).toEqual([
            "/docs/dopedocs.css",
            "/docs-theme.css",
        ]);
    });

    it("escapes an href rather than trusting it", () => {
        const evil = buildStatic(docs, { now, stylesheet: '"><script>x</script>' });
        expect(evil["docs/index.html"]!).not.toContain("<script>x");
    });
});

describe("page titles", () => {
    const titlesIn = (html: string) => ({
        title: /<title>([^<]*)<\/title>/.exec(html)?.[1],
        og: /<meta property="og:title" content="([^"]*)">/.exec(html)?.[1],
        twitter: /<meta name="twitter:title" content="([^"]*)">/.exec(html)?.[1],
    });

    it("separates section and entity with a hyphen, never an em dash", () => {
        // The title is what shows in a search result and a browser tab, and the
        // separator is dopedocs' choice rather than the consumer's.
        const t = titlesIn(out["docs/what-it-is/index.html"]!);
        expect(t.title).toBe("What this is - No Ceremony");
        expect(t.og).toBe("What this is - No Ceremony");
        expect(t.twitter).toBe("What this is - No Ceremony");
        for (const value of Object.values(t)) {
            expect(value).not.toContain("—");
        }
    });

    it("emits no em dash in any generated page", () => {
        for (const [path, html] of Object.entries(out)) {
            if (!path.endsWith(".html")) continue;
            expect(html, `${path} contains an em dash`).not.toContain("—");
        }
    });
});

/* ── Chrome (DEC-07) ─────────────────────────────────────────────────────── */

describe("static page chrome", () => {
    const section = out["docs/what-it-is/index.html"]!;
    const index = out["docs/index.html"]!;

    it("wraps every page in the bar and rail the panel uses", () => {
        for (const html of [section, index, out["docs/export/index.html"]!]) {
            expect(html).toContain('<body class="dd-static">');
            expect(html).toContain('<div class="dd-bar">');
            expect(html).toContain('<nav class="dd-nav" aria-label="Contents">');
            expect(html).toContain('<main class="dd-page');
        }
    });

    it("links back to the site root, labelled with the entity", () => {
        expect(section).toContain('<a class="dd-back" href="/">');
        expect(section).toContain("No Ceremony</a>");
        // The document title names where the reader is, as it does in the panel.
        expect(section).toContain('<span class="dd-bar-page">How No Ceremony works</span>');
    });

    it("lists every page in the rail, a group as a foldable label over its pages", () => {
        for (const id of ["what-it-is", "data", "export"]) {
            expect(section).toContain(`href="/docs/${id}/"`);
        }
        // The group is a native, open <details> whose summary is a label, not a link.
        expect(section).toMatch(
            /<details class="dd-nav-group" open><summary>Your data<\/summary><ul class="dd-nav-list"><li><a[^>]*\/docs\/data\/"/,
        );
        expect(section).not.toContain("/docs/your-data/");
    });

    it("marks the current section, and only that one", () => {
        expect(section).toContain('class="dd-nav-link is-active"');
        expect(section.match(/is-active/g)).toHaveLength(1);
        expect(section).toContain('aria-current="page"');
        // The index is nobody's section, so nothing there is current.
        expect(index).not.toContain("is-active");
        expect(index).not.toContain('aria-current="page"');
    });

    it("is complete without JavaScript", () => {
        // Every chrome affordance is a link or plain markup: a reader with
        // scripting off, and a crawler, get the whole page and every route out
        // of it. A <script> here would be a regression of the crawler view.
        expect(section).not.toMatch(/<script(?![^>]*application\/ld\+json)/);
        expect(section).not.toContain("onclick");
        const routesOut = section.match(/<a class="dd-(back|nav-link)[^"]*"/g) ?? [];
        expect(routesOut.length).toBeGreaterThanOrEqual(4);
    });

    it("needs no configuration — chrome is derived from the document", () => {
        // Same document, no options at all beyond the injected clock.
        const bare = buildStatic(docs, { now })["docs/data/index.html"]!;
        expect(bare).toContain('<a class="dd-back" href="/">');
        expect(bare).toContain('<nav class="dd-nav"');
    });
});

/* ── Landmarks a text extractor keys on ─────────────────────────────────── */

describe("page landmarks", () => {
    const pages = Object.entries(out).filter(([path]) => path.endsWith(".html"));
    const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0;

    it("gives every page exactly one <main> and exactly one <h1>", () => {
        expect(pages.length).toBeGreaterThan(2);
        for (const [path, html] of pages) {
            expect(count(html, /<main[\s>]/g), `${path} <main> count`).toBe(1);
            expect(count(html, /<h1[\s>]/g), `${path} <h1> count`).toBe(1);
        }
    });

    it("puts the content before the rail in the source", () => {
        // Extractors read in source order; the stylesheet puts the rail back
        // on the left for people.
        for (const [path, html] of pages) {
            const main = html.indexOf("<main");
            const rail = html.indexOf('<nav class="dd-nav"');
            expect(main, `${path} has no <main>`).toBeGreaterThan(-1);
            expect(rail, `${path} has no rail`).toBeGreaterThan(-1);
            expect(main, `${path} rail comes first`).toBeLessThan(rail);
        }
    });

    it("titles a section page with its own section, as the h1", () => {
        const html = out["docs/what-it-is/index.html"]!;
        expect(html).toContain('<h1 class="dd-section-title">What this is</h1>');
        expect(html).toContain('<main class="dd-page dd-page--section">');
    });

    it("gives a page in a group its own page, alone, with its title as the h1", () => {
        const html = out["docs/data/index.html"]!;
        expect(html).toContain('<h1 class="dd-section-title">Where it lives</h1>');
        // Its sibling is not carried along: a page stands on its own.
        expect(html).not.toContain('id="export"');
    });

    it("keeps the index titled by the document, with sections as h2", () => {
        const html = out["docs/index.html"]!;
        expect(html).toContain('<h1 class="dd-title">');
        expect(html).toContain('<h2 class="dd-section-title">What this is</h2>');
        expect(html).not.toContain("dd-page--section");
    });
});

/* ── The full-manual note ────────────────────────────────────────────────── */

describe("full-manual note", () => {
    const sectionPages = Object.entries(out).filter(
        ([path]) => path.endsWith("/index.html") && path !== "docs/index.html",
    );
    const index = out["docs/index.html"]!;

    it("tells every section page the complete manual is one page, and links it", () => {
        expect(sectionPages.length).toBeGreaterThan(1);
        for (const [path, html] of sectionPages) {
            expect(html, path).toContain(
                '<p class="dd-fullnote">This page is one part of How No Ceremony works. ' +
                    "The complete manual is a single page, short enough to read in one go: " +
                    '<a href="/docs/">noceremony.app/docs/</a></p>',
            );
            expect(html, path).toContain(
                '<link rel="alternate" type="text/html" ' +
                    'title="How No Ceremony works, complete on one page" ' +
                    'href="https://noceremony.app/docs/">',
            );
            expect(html, path).toContain('"isPartOf": {\n');
        }
    });

    it("puts the note above the page's title, inside <main>", () => {
        const html = out["docs/what-it-is/index.html"]!;
        const main = html.indexOf("<main");
        const note = html.indexOf('class="dd-fullnote"');
        const h1 = html.indexOf("<h1");
        expect(main).toBeLessThan(note);
        expect(note).toBeLessThan(h1);
    });

    it("says on the index that it is the complete manual, with a word count", () => {
        expect(index).toMatch(
            /<p class="dd-fullnote">This page is the whole of How No Ceremony works: every section, about [\d,]+ words\. It is short enough to read in one go\.<\/p>/,
        );
        // The index is the whole; it does not point at itself.
        expect(index).not.toContain('rel="alternate"');
    });

    it("takes wording from the option, and can be turned off", () => {
        const custom = buildStatic(docs, {
            now,
            fullManualNote: { section: "Part of {title}. All of it: {link}", index: "All {words} words of {title}." },
        });
        expect(custom["docs/data/index.html"]).toContain(
            '<p class="dd-fullnote">Part of How No Ceremony works. All of it: <a href="/docs/">noceremony.app/docs/</a></p>',
        );
        expect(custom["docs/index.html"]).toMatch(/<p class="dd-fullnote">All [\d,]+ words of How No Ceremony works\.<\/p>/);

        const off = buildStatic(docs, { now, fullManualNote: false });
        for (const [path, html] of Object.entries(off)) {
            if (path.endsWith(".html")) expect(html, path).not.toContain("dd-fullnote");
        }
    });

    it("escapes wording supplied by the consumer", () => {
        const evil = buildStatic(docs, { now, fullManualNote: { section: "<b>{title}</b>" } });
        expect(evil["docs/data/index.html"]).toContain("&lt;b&gt;How No Ceremony works&lt;/b&gt;");
    });
});

describe("link form", () => {
    const section = out["docs/what-it-is/index.html"]!;

    it("navigates by path so a local or preview build stays where it is", () => {
        // Every href a reader can follow is root-relative.
        const hrefs = [...section.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]!);
        expect(hrefs.length).toBeGreaterThan(4);
        for (const href of hrefs) expect(href.startsWith("/")).toBe(true);
    });

    it("keeps machine-read addresses absolute", () => {
        // Canonical, og:url and every JSON-LD id name one address unambiguously.
        expect(section).toContain(
            '<link rel="canonical" href="https://noceremony.app/docs/what-it-is/">',
        );
        expect(section).toContain(
            '<meta property="og:url" content="https://noceremony.app/docs/what-it-is/">',
        );
        expect(JSON.stringify(graphOf(section))).toContain(
            "https://noceremony.app/docs/what-it-is/#article",
        );
        expect(out["sitemap.xml"]).toContain(
            "<loc>https://noceremony.app/docs/what-it-is/</loc>",
        );
    });

    it("respects a site served under a subpath", () => {
        const nested = buildStatic(
            { ...docs, entity: { ...docs.entity, url: "https://example.test/product" } },
            { now },
        )["docs/data/index.html"]!;
        expect(nested).toContain('<a class="dd-back" href="/product/">');
        expect(nested).toContain('href="/product/docs/export/"');
        expect(nested).toContain(
            '<link rel="canonical" href="https://example.test/product/docs/data/">',
        );
    });
});

/* ── Crawler-file merging is idempotent (ENG-05) ─────────────────────────── */

describe("mergeCrawlerFile", () => {
    const theirRobots = "User-agent: Ahrefsbot\nDisallow: /\n";
    const theirSitemap =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        "  <url><loc>https://noceremony.app/pricing/</loc></url>\n" +
        "</urlset>\n";

    it("keeps a consumer's own robots rules and adds ours once", () => {
        const once = mergeCrawlerFile("robots.txt", theirRobots, out["robots.txt"]!);
        expect(once).toContain("User-agent: Ahrefsbot");
        expect(once).toContain("Googlebot");
        expect(once.match(/Googlebot/g)).toHaveLength(1);
    });

    it("merging robots into its own output changes nothing", () => {
        const once = mergeCrawlerFile("robots.txt", theirRobots, out["robots.txt"]!);
        const twice = mergeCrawlerFile("robots.txt", once, out["robots.txt"]!);
        expect(twice).toBe(once);
        // The regression this guards: stanzas accumulating one build at a time.
        expect(twice.match(/Googlebot/g)).toHaveLength(1);
        expect(twice).toContain("User-agent: Ahrefsbot");
    });

    it("survives many builds into a directory that is never emptied", () => {
        let file = theirRobots;
        for (let i = 0; i < 5; i++) file = mergeCrawlerFile("robots.txt", file, out["robots.txt"]!);
        expect(file.match(/Googlebot/g)).toHaveLength(1);
        expect(file.match(/User-agent: Ahrefsbot/g)).toHaveLength(1);
    });

    it("keeps a consumer's own sitemap entries and adds ours once", () => {
        const once = mergeCrawlerFile("sitemap.xml", theirSitemap, out["sitemap.xml"]!);
        expect(once).toContain("https://noceremony.app/pricing/");
        expect(once.match(/<loc>https:\/\/noceremony\.app\/docs\/data\/<\/loc>/g)).toHaveLength(1);
    });

    it("merging a sitemap into its own output changes nothing", () => {
        const once = mergeCrawlerFile("sitemap.xml", theirSitemap, out["sitemap.xml"]!);
        const twice = mergeCrawlerFile("sitemap.xml", once, out["sitemap.xml"]!);
        expect(twice).toBe(once);
        expect(twice.match(/<url>/g)).toHaveLength(once.match(/<url>/g)!.length);
        expect(twice).toContain("https://noceremony.app/pricing/");
        expect(twice.match(/<\/urlset>/g)).toHaveLength(1);
    });

    it("survives many sitemap builds without repeating an entry", () => {
        let file = theirSitemap;
        for (let i = 0; i < 5; i++) file = mergeCrawlerFile("sitemap.xml", file, out["sitemap.xml"]!);
        expect(file.match(/<loc>https:\/\/noceremony\.app\/docs\/data\/<\/loc>/g)).toHaveLength(1);
        expect(file.match(/<loc>https:\/\/noceremony\.app\/pricing\/<\/loc>/g)).toHaveLength(1);
    });
});
