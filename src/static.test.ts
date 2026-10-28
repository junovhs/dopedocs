import { describe, expect, it } from "vitest";

import { defineFacts } from "./facts.js";
import { defineDocs, validate, type DocSet } from "./schema.js";
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
            "facts.json",
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

    it("serves the docs at the site root without double slashes", () => {
        for (const basePath of ["/", ""]) {
            const root = buildStatic(docs, { now, basePath, search: true });
            expect(Object.keys(root)).toContain("index.html");
            expect(Object.keys(root)).toContain("what-it-is/index.html");
            expect(Object.keys(root)).toContain("search.js");
            expect(Object.keys(root).some((path) => path.startsWith("/"))).toBe(false);
            const page = root["what-it-is/index.html"]!;
            expect(page).toContain('href="/what-it-is/"');
            expect(page).toContain('<link rel="canonical" href="https://noceremony.app/what-it-is/">');
            for (const [path, body] of Object.entries(root)) {
                expect(body, path).not.toMatch(/(?:href|src)="\/\/|https:\/\/noceremony\.app\/\//);
            }
        }
    });
});

describe("complete manual navigation", () => {
    it("uses the sidebar as its only contents list and keeps the complete content", () => {
        const html = out["docs/index.html"]!;
        expect(html.match(/<nav class="dd-nav" aria-label="Contents">/g)).toHaveLength(1);
        expect(html).not.toContain('class="dd-contents"');
        expect(html).not.toContain('<h2>Contents</h2>');
        for (const id of ["what-it-is", "data", "export"]) {
            expect(html).toContain(`id="${id}"`);
            expect(html).toContain(`href="/docs/${id}/"`);
        }
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

    it("types the pages TechArticle, CollectionPage and WebSite by default", () => {
        const types = (html: string) => nodesOf(html).map((n) => n["@type"]);
        expect(types(out["docs/index.html"]!)).toEqual([
            "Organization",
            "WebSite",
            "CollectionPage",
            "FAQPage",
        ]);
        expect(types(out["docs/export/index.html"]!)).toEqual([
            "Organization",
            "TechArticle",
            "FAQPage",
            "BreadcrumbList",
        ]);
    });

    it("takes the article, index and site types as options, changing nothing else", () => {
        const typed = buildStatic(docs, {
            now,
            articleType: "Article",
            indexType: "WebPage",
            siteType: "WebSite",
        });
        expect(nodeOf(typed["docs/export/index.html"]!, "Article")["headline"]).toBe("Export");
        expect(nodeOf(typed["docs/index.html"]!, "WebPage")["@id"]).toBe(
            "https://noceremony.app/docs/#page",
        );
        // Only the type strings differ from the default build.
        for (const [path, html] of Object.entries(typed)) {
            expect(
                html
                    .replace('"@type": "Article"', '"@type": "TechArticle"')
                    .replace('"@type": "WebPage"', '"@type": "CollectionPage"'),
            ).toBe(out[path]);
        }
    });

    it("describes a service business as one entity every page points at", () => {
        const agency = buildStatic(docs, { now, entityType: "TravelAgency", articleType: "Article" });
        const pages = Object.keys(agency).filter((p) => p.endsWith(".html"));
        const id = "https://noceremony.app/#entity";
        for (const path of pages) {
            const nodes = nodesOf(agency[path]!);
            expect(nodes[0]).toMatchObject({ "@type": "TravelAgency", "@id": id });
            expect(nodes.some((n) => n["@type"] === "TechArticle")).toBe(false);
            expect(JSON.stringify(nodes.slice(1))).toContain(`{"@id":"${id}"}`);
        }
        expect(nodeOf(agency["docs/data/index.html"]!, "Article")).toMatchObject({
            about: { "@id": id },
            publisher: { "@id": id },
        });
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

describe("entity schemaProperties", () => {
    const agencyEntity = {
        ...docs.entity,
        schemaProperties: {
            telephone: "+1-555-0100",
            address: {
                "@type": "PostalAddress",
                streetAddress: "1 Harbour Road",
                addressLocality: "Portland",
                addressCountry: "US",
            },
            areaServed: ["Oregon", "Washington"],
        },
    };

    it("merges extra properties into the entity node beside dopedocs' own", () => {
        const agency = buildStatic({ ...docs, entity: agencyEntity }, { now, entityType: "TravelAgency" });
        const id = "https://noceremony.app/#entity";
        for (const [path, html] of Object.entries(agency)) {
            if (!path.endsWith(".html")) continue;
            const entity = nodeOf(html, "TravelAgency");
            expect(entity).toMatchObject({
                "@id": id,
                name: "No Ceremony",
                legalName: "Strange Systems",
                telephone: "+1-555-0100",
                address: { "@type": "PostalAddress", addressLocality: "Portland" },
                areaServed: ["Oregon", "Washington"],
                disambiguatingDescription:
                    "No Ceremony is not affiliated with No Ceremony (band), Ceremony.",
            });
            expect(JSON.stringify(nodesOf(html).slice(1))).toContain(`{"@id":"${id}"}`);
        }
    });

    it("refuses a property dopedocs owns, naming the field that sets it", () => {
        const clash = {
            ...docs,
            entity: { ...agencyEntity, schemaProperties: { name: "Someone Else", "@id": "x", telephone: "1" } },
        };
        expect(() => buildStatic(clash, { now })).toThrow(InvalidDocumentError);
        const findings = validate(clash, { today: now }).filter(
            (f) => f.code === "reserved-schema-property",
        );
        expect(findings.map((f) => f.severity)).toEqual(["fatal", "fatal"]);
        expect(findings[0]!.message).toContain('"name"');
        expect(findings[0]!.message).toContain("entity.name");
        expect(findings[1]!.message).toContain('"@id"');
    });

    it("does not mistake a prototype name for a reserved one", () => {
        const odd = { ...docs, entity: { ...docs.entity, schemaProperties: { constructor: "ok" } } };
        expect(validate(odd, { today: now }).some((f) => f.code === "reserved-schema-property")).toBe(false);
        expect(nodeOf(buildStatic(odd, { now })["docs/index.html"]!, "Organization")["constructor"]).toBe("ok");
    });

    it("leaves the output unchanged when there are none", () => {
        const empty = buildStatic({ ...docs, entity: { ...docs.entity, schemaProperties: {} } }, { now });
        expect(empty).toEqual(out);
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

describe("indexing", () => {
    const pages = (tree: Record<string, string>) =>
        Object.entries(tree).filter(([path]) => path.endsWith(".html"));

    it("lets every page be indexed by default", () => {
        for (const [, html] of pages(out)) {
            expect(html).toContain(
                '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">',
            );
        }
        expect(out["robots.txt"]).toMatch(/Sitemap: https:\/\/noceremony\.app\/sitemap\.xml\n$/);
    });

    it("marks every page noindex, nofollow and stops advertising the sitemap", () => {
        const tree = buildStatic(docs, { now, indexing: "noindex" });
        expect(pages(tree).length).toBeGreaterThan(1);
        for (const [, html] of pages(tree)) {
            expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
            expect(html).not.toContain("index,follow");
        }
        expect(tree["robots.txt"]).not.toContain("Sitemap:");
        // The crawler rules themselves are unchanged.
        expect(tree["robots.txt"]).toContain("User-agent: GPTBot\nDisallow: /");
        // The files are still written, so turning indexing on is only a rebuild.
        expect(tree["sitemap.xml"]).toBeDefined();
        expect(tree["llms.txt"]).toBeDefined();
    });

    it("leaves the default output unchanged when indexing is set explicitly", () => {
        expect(buildStatic(docs, { now, indexing: "index" })).toEqual(out);
    });
});

describe("links on static pages", () => {
    const linked: DocSet = {
        ...docs,
        lead: "No Ceremony orders your work; see [What this is](#what-it-is).",
        sections: docs.sections.map((s) =>
            s.id === "what-it-is" && !("children" in s)
                ? {
                      ...s,
                      answer: "No Ceremony is a day organiser; see [Export](section:export) and [the site](https://noceremony.app).",
                      blocks: [
                          {
                              kind: "p",
                              text: "Questions? [Mail us](mailto:hi@noceremony.app) or read [Export](#export).",
                          },
                      ],
                  }
                : s,
        ),
    };
    const tree = buildStatic(linked, { now });
    const sectionPage = tree["docs/what-it-is/index.html"]!;

    it("points a section reference at that section's page", () => {
        expect(sectionPage).toContain(
            '<a class="dd-link" href="/docs/export/" data-dd-link="export">Export</a>',
        );
        expect(tree["docs/index.html"]).toContain(
            '<a class="dd-link" href="/docs/what-it-is/" data-dd-link="what-it-is">What this is</a>',
        );
    });

    it("renders URL and mailto links as anchors", () => {
        expect(sectionPage).toContain(
            '<a class="dd-link" href="https://noceremony.app" rel="noopener">the site</a>',
        );
        expect(sectionPage).toContain(
            '<a class="dd-link" href="mailto:hi@noceremony.app">Mail us</a>',
        );
    });

    it("reduces links to their text in every plain-text derivation", () => {
        const plainAnswer = "No Ceremony is a day organiser; see Export and the site.";
        expect(sectionPage).toContain(`"text": "${plainAnswer}"`);
        expect(sectionPage).toContain(`<meta name="description" content="${plainAnswer}">`);
        expect(tree["llms.txt"]).toContain(plainAnswer);
        expect(tree["llms.txt"]).toContain("> No Ceremony orders your work; see What this is.");
        expect(tree["llms.txt"]).not.toContain("](");
        expect(JSON.parse(tree["questions.json"]!).questions[0].answer).toBe(plainAnswer);
    });

    it("refuses to build a link to a section that does not exist", () => {
        const broken: DocSet = { ...docs, lead: "Read [Troubleshooting](#troubleshooting)." };
        expect(() => buildStatic(broken, { now })).toThrow(/unknown-section-link/);
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

describe("facts.json", () => {
    const registry = defineFacts({
        fee: { value: "$25 & up, <48h notice>", reviewed: "2026-08-01", note: "internal: ask finance" },
        hours: { value: "9am to 5pm", reviewed: "2026-09-01" },
    });
    const withFacts = buildStatic(
        {
            ...docs,
            lead: "Cancelling costs {fact:fee}.",
            facts: registry,
            sections: [
                {
                    id: "fees",
                    title: "Fees",
                    question: "What does cancelling cost?",
                    answer: "Cancelling costs {fact:fee}, and support is open {fact:hours}.",
                    blocks: [{ kind: "p", text: "Support hours are {fact:hours}." }],
                },
            ],
        },
        { now },
    );
    const parsed = JSON.parse(withFacts["facts.json"]!);

    it("carries every registry key with its value and reviewed date, and nothing else", () => {
        expect(parsed).toEqual({
            entity: "No Ceremony",
            generated: "2026-09-02",
            facts: {
                fee: { value: "$25 & up, <48h notice>", reviewed: "2026-08-01" },
                hours: { value: "9am to 5pm", reviewed: "2026-09-01" },
            },
        });
    });

    it("never publishes a fact's reviewer note", () => {
        expect(withFacts["facts.json"]).not.toContain("internal: ask finance");
    });

    it("holds the same values the built pages interpolate", () => {
        const html = withFacts["docs/fees/index.html"]!;
        for (const { value } of Object.values(parsed.facts) as { value: string }[]) {
            const escaped = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            expect(html).toContain(escaped);
        }
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

    it("shows one entity home link when the docs are the site", () => {
        for (const basePath of ["/", ""]) {
            for (const url of ["https://docs.example", "https://docs.example/product/"]) {
                const rootDocs = { ...docs, basePath, entity: { ...docs.entity, url } };
                const pages = buildStatic(rootDocs, { now });
                const home = new URL(url).pathname;
                for (const path of ["index.html", "what-it-is/index.html", "data/index.html"]) {
                    const bar = pages[path]!.match(/<div class="dd-bar">([\s\S]*?)<\/div>/)![1]!;
                    expect(bar.match(/No Ceremony/g), path).toHaveLength(1);
                    expect(bar, path).toContain(`<a class="dd-bar-page" href="${home}">No Ceremony</a>`);
                    expect(bar, path).not.toContain("dd-back");
                    expect(bar, path).not.toContain("<svg");
                }
            }
        }
    });

    it("lists every page in the rail, a group as a foldable label over its pages", () => {
        for (const id of ["what-it-is", "data", "export"]) {
            expect(section).toContain(`href="/docs/${id}/"`);
        }
        // The group is a native, open <details> whose summary is a label, not a link.
        expect(section).toMatch(
            /<details class="dd-nav-group" open><summary>[\s\S]*?Your data<\/summary><ul class="dd-nav-list"><li><a[^>]*\/docs\/data\/"/,
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

    it("does not add a second wildcard group beside the consumer's", () => {
        const wildcard = "User-agent: *\nAllow: /\n";
        const once = mergeCrawlerFile("robots.txt", wildcard, out["robots.txt"]!);
        expect(once.match(/^User-agent: \*$/gm)).toHaveLength(1);
        // Named search and training groups are still ours to state.
        expect(once).toContain("User-agent: Googlebot\nAllow: /");
        expect(once).toContain("User-agent: GPTBot\nDisallow: /");
        // With no Sitemap line of their own, ours is still advertised.
        expect(once.match(/^Sitemap:/gm)).toHaveLength(1);
        expect(mergeCrawlerFile("robots.txt", once, out["robots.txt"]!)).toBe(once);
    });

    it("recognises a wildcard group however it is spelled", () => {
        const wildcard = "user-agent:*   # everyone\nDisallow: /private/\n";
        const once = mergeCrawlerFile("robots.txt", wildcard, out["robots.txt"]!);
        expect(once.match(/^\s*user-agent\s*:\s*\*/gim)).toHaveLength(1);
        expect(once).toContain("Disallow: /private/");
    });

    it("does not add a Sitemap line when the consumer's file names one", () => {
        const theirs = "User-agent: *\nAllow: /\n\nSitemap: https://noceremony.app/sitemap.xml\n";
        const once = mergeCrawlerFile("robots.txt", theirs, out["robots.txt"]!);
        expect(once.match(/^Sitemap:/gm)).toHaveLength(1);
        expect(once.match(/^User-agent: \*$/gm)).toHaveLength(1);
        const twice = mergeCrawlerFile("robots.txt", once, out["robots.txt"]!);
        expect(twice).toBe(once);
        expect(twice.endsWith("\n")).toBe(true);
    });

    it("keeps our wildcard group and sitemap beside a file that has neither", () => {
        const once = mergeCrawlerFile("robots.txt", theirRobots, out["robots.txt"]!);
        expect(once.match(/^User-agent: \*$/gm)).toHaveLength(1);
        expect(once.match(/^Sitemap:/gm)).toHaveLength(1);
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

describe("actual fact review dates", () => {
    it.each(["2026-02-29", "2026-02-30", "2026-99-99", "2026-00-01", "2026-10-00"])("refuses impossible date %s before publishing", (reviewed) => {
        expect(() => buildStatic({ ...docs, facts: { price: { value: "free", reviewed } } }, { now })).toThrow(/invalid-review-date/);
    });
    it("accepts a real leap day and future valid dates", () => {
        for (const reviewed of ["2024-02-29", "2028-02-29"]) {
            expect(() => buildStatic({ ...docs, facts: { price: { value: "free", reviewed } } }, { now })).not.toThrow();
        }
    });
});

describe("resolved answer conventions", () => {
    const answerDocs = (answer: string, value: string): DocSet => ({
        ...docs, facts: { ...docs.facts, snippet: { value, reviewed: "2026-10-18" } },
        sections: [{ id: "snippet", title: "Snippet", question: "What is the answer?", answer, blocks: [] }],
    });
    it("rejects an outward opener introduced by a fact or inline mark", () => {
        expect(() => buildStatic(answerDocs("{fact:snippet}", "It works."), { now })).toThrow(/answer-opens-with-pronoun/);
        expect(() => buildStatic(answerDocs("**It** works.", "unused"), { now })).toThrow(/answer-opens-with-pronoun/);
    });
    it("rejects an overlong fact-resolved answer", () => {
        expect(() => buildStatic(answerDocs("{fact:snippet}", "Example " + "x".repeat(400)), { now })).toThrow(/answer-too-long/);
    });
    it("measures visible words rather than link markup", () => {
        const tree = buildStatic(answerDocs("Example links to [a guide](https://example.test/" + "x".repeat(400) + ").", "unused"), { now });
        expect(JSON.parse(tree["questions.json"]!).questions[0].answer).toBe("Example links to a guide.");
        expect(tree["docs/snippet/index.html"]).toContain('>a guide</a>');
    });
    it("reports missing facts through findings rather than throwing from validate", () => {
        const findings = validate(answerDocs("Example uses {fact:missing}.", "unused"));
        expect(findings.some(f => f.code === "unknown-fact-reference")).toBe(true);
    });
});

describe("nonblank published answers", () => {
    it.each(["", " \n\t", "** **", "{fact:blank}"])("refuses blank answer %j", (answer) => {
        const blank: DocSet = { ...docs, facts: { ...docs.facts, blank: { value: " \n", reviewed: "2026-10-18" } }, sections: [{ id: "blank", title: "Blank", question: "Where is the answer?", answer, blocks: [] }] };
        expect(validate(blank, { today: now })).toEqual(expect.arrayContaining([expect.objectContaining({ code: "empty-answer", severity: "fatal", sectionId: "blank" })]));
        expect(() => buildStatic(blank, { now })).toThrow(/empty-answer/);
    });
});

describe("literal link examples in inline code", () => {
    const example = (text: string): DocSet => ({ ...docs, sections: [{ id: "examples", title: "Examples", question: "How are links written?", answer: "Example shows literal link syntax.", blocks: [{ kind: "p", text }] }] });
    it("publishes nonexistent-section and unsupported-scheme syntax as literal code", () => {
        const input = example('Write `[example](#missing)` or `[x](javascript:bad)` literally.');
        expect(validate(input, { today: now })).toEqual([]);
        const html = buildStatic(input, { now })["docs/examples/index.html"]!;
        expect(html).toContain('<code>[example](#missing)</code>');
        expect(html).toContain('<code>[x](javascript:bad)</code>');
        expect(html).not.toContain('data-dd-link="missing"');
    });
    it.each(['[example](#missing)', '[x](javascript:bad)', '`unclosed [example](#missing)'])("still refuses a real link in %s", (text) => {
        expect(() => buildStatic(example(text), { now })).toThrow(/unknown-section-link|unsupported-link/);
    });
});

describe("dates (DEC-19)", () => {
    const dated = defineDocs({
        ...docs,
        sections: [
            { ...docs.sections[0]!, published: "2026-01-02", updated: "2026-03-04" } as DocSet["sections"][number],
            ...docs.sections.slice(1),
        ],
    });
    // A build date nobody wrote, so any page claiming it is lying.
    const later = buildStatic(dated, { now: new Date("2030-01-01T00:00:00Z") });
    const articleOf = (path: string) => nodeOf(later[path]!, "TechArticle");
    const urlsOf = (sitemap: string) =>
        sitemap.split("<url>").slice(1).map((block) => ({
            loc: block.match(/<loc>([^<]+)<\/loc>/)![1],
            lastmod: block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1],
        }));

    it("publishes a dated page's own dates, not the build date", () => {
        const article = articleOf("docs/what-it-is/index.html");
        expect(article.datePublished).toBe("2026-01-02");
        expect(article.dateModified).toBe("2026-03-04");
    });

    it("claims no date for an undated page", () => {
        const article = articleOf("docs/data/index.html");
        expect(article).not.toHaveProperty("dateModified");
        expect(article).not.toHaveProperty("datePublished");
    });

    it("gives the sitemap real lastmods, the index the newest, and undated pages none", () => {
        expect(urlsOf(later["sitemap.xml"]!)).toEqual([
            { loc: "https://noceremony.app/docs/", lastmod: "2026-03-04" },
            { loc: "https://noceremony.app/docs/what-it-is/", lastmod: "2026-03-04" },
            { loc: "https://noceremony.app/docs/data/", lastmod: undefined },
            { loc: "https://noceremony.app/docs/export/", lastmod: undefined },
        ]);
        expect(urlsOf(out["sitemap.xml"]!).every((u) => u.lastmod === undefined)).toBe(true);
    });

    it("keeps the build date only on the generated data files", () => {
        for (const [path, body] of Object.entries(later)) {
            if (path === "questions.json" || path === "facts.json") {
                expect(body, path).toContain("2030-01-01");
            } else {
                expect(body, path).not.toContain("2030-01-01");
            }
        }
    });

    it("refuses a date that is not a real day, and an update before publication", () => {
        const withDates = (published?: string, updated?: string) =>
            validate(defineDocs({
                ...docs,
                sections: [{ ...docs.sections[0]!, published, updated } as DocSet["sections"][number]],
            })).map((f) => f.code);
        expect(withDates("2026-02-30")).toContain("invalid-page-date");
        expect(withDates("2026-01-02", "26-3-4")).toContain("invalid-page-date");
        expect(withDates("2026-03-04", "2026-01-02")).toContain("updated-before-published");
        expect(withDates("2026-01-02", "2026-01-02")).not.toContain("updated-before-published");
    });
});

describe("articles (DEC-18)", () => {
    const withArticles = defineDocs({
        ...docs,
        articles: [
            {
                id: "older",
                title: "Exporting & keeping a backup",
                question: "How do I keep a backup of my No Ceremony list?",
                answer: "No Ceremony exports the whole list as JSON, and it is {fact:price}.",
                published: "2026-05-01",
                blocks: [{ kind: "p", text: "See [Export](section:export) for the steps." }],
            },
            {
                id: "newer",
                title: "Why the order matters",
                question: "Why does No Ceremony decide the order of my work?",
                answer: "No Ceremony picks the next task so you spend no willpower choosing.",
                published: "2026-06-01",
                updated: "2026-07-01",
                author: "Spencer Nunamaker",
                blocks: [{ kind: "p", text: "Choosing is the expensive part." }],
            },
        ],
    });
    const built = buildStatic(withArticles, { now: new Date("2030-01-01T00:00:00Z") });
    const articleNode = (id: string) => nodeOf(built[`articles/${id}/index.html`]!, "Article");

    it("emits a page per article, an index and a feed beside the manual", () => {
        expect(Object.keys(built)).toEqual(expect.arrayContaining([
            "articles/index.html",
            "articles/older/index.html",
            "articles/newer/index.html",
            "articles/feed.xml",
        ]));
        expect(built["docs/what-it-is/index.html"]).toBe(buildStatic(docs, { now: new Date("2030-01-01T00:00:00Z") })["docs/what-it-is/index.html"]);
    });

    it("lists the articles newest first on the index", () => {
        const index = built["articles/index.html"]!;
        expect(index.indexOf('href="/articles/newer/"')).toBeGreaterThan(-1);
        expect(index.indexOf('href="/articles/newer/"')).toBeLessThan(index.indexOf('href="/articles/older/"'));
        const list = nodeOf(index, "CollectionPage").mainEntity as { itemListElement: { url: string }[] };
        expect(list.itemListElement.map((item) => item.url)).toEqual([
            "https://noceremony.app/articles/newer/",
            "https://noceremony.app/articles/older/",
        ]);
    });

    it("marks each article up as an Article with its real dates and author", () => {
        expect(articleNode("newer")).toMatchObject({
            "@type": "Article",
            datePublished: "2026-06-01",
            dateModified: "2026-07-01",
            author: { "@type": "Person", name: "Spencer Nunamaker" },
        });
        expect(articleNode("older")).toMatchObject({ datePublished: "2026-05-01", dateModified: "2026-05-01" });
        expect(articleNode("older")).not.toHaveProperty("author");
    });

    it("renders the article as its own page: its h1, dates, facts and links into the manual", () => {
        const html = built["articles/older/index.html"]!;
        expect(html).toContain('<link rel="canonical" href="https://noceremony.app/articles/older/">');
        expect(html).toContain('<time datetime="2026-05-01">May 1, 2026</time>');
        expect(html).toContain("it is free");
        expect(html).toContain('href="/docs/export/"');
        expect(html).not.toContain('class="dd-nav"');
        const newer = built["articles/newer/index.html"]!;
        expect(newer).toContain('<span class="dd-byline-name">By Spencer Nunamaker</span>');
        expect(newer).toContain("Updated <time datetime=\"2026-07-01\">July 1, 2026</time> · 1 min read");
        expect(newer).toContain('<span class="dd-avatar" aria-hidden="true">S</span>');
        // The question is the headline and the answer is the standfirst, in that order.
        expect(html.indexOf('<h1 class="dd-article-question">')).toBeLessThan(html.indexOf('class="dd-article-lede"'));
    });

    it("leads with a cover, card and structured-data image when one is given", () => {
        const covered = buildStatic(defineDocs({
            ...withArticles,
            articles: [{ ...withArticles.articles![1]!, cover: { src: "/shots/plans.webp", alt: "The plans view", width: 1800, height: 1175 } }],
        }), { now });
        const page = covered["articles/newer/index.html"]!;
        expect(page).toContain('<div class="dd-article-cover">');
        expect(page).toContain('src="/shots/plans.webp" alt="The plans view" width="1800" height="1175" loading="eager" fetchpriority="high"');
        expect(nodeOf(page, "Article").image).toBe("https://noceremony.app/shots/plans.webp");
        expect(covered["articles/index.html"]).toContain('<img class="dd-article-card-image" src="/shots/plans.webp" alt="" width="1800" height="1175" loading="lazy"');
        const blankAlt = { ...withArticles.articles![1]!, cover: { src: "/x.webp", alt: " " } };
        expect(validate(defineDocs({ ...docs, articles: [blankAlt] })).map((f) => f.code)).toContain("empty-image-alt");
    });

    it("lists two or more headings as \"In this article\" ahead of the body", () => {
        const sectioned = {
            ...withArticles.articles![0]!,
            blocks: [
                { kind: "heading" as const, text: "Why it **breaks**" },
                { kind: "p" as const, text: "Because." },
                { kind: "heading" as const, text: "The fix", id: "fix" },
            ],
        };
        const html = buildStatic(defineDocs({ ...docs, articles: [sectioned] }), { now })["articles/older/index.html"]!;
        expect(html).toContain('<h2 class="dd-heading" id="why-it-breaks">');
        expect(html).toContain('<h2 class="dd-heading" id="fix">The fix<a class="dd-heading-link" href="#fix" aria-label="Link to this section">#</a></h2>');
        expect(html).toContain('<li><a href="#why-it-breaks">Why it <strong>breaks</strong></a></li><li><a href="#fix">The fix</a></li>');
        // An open native disclosure: foldable with no script, and readable with none.
        expect(html).toContain('<details class="dd-article-toc" open><summary class="dd-article-toc-title">In this article</summary>');
        expect(html.indexOf('class="dd-article-toc"')).toBeLessThan(html.indexOf('<h2 class="dd-heading"'));
        expect(built["articles/older/index.html"]).not.toContain("dd-article-toc");
    });

    it("lets an article figure run wider than the text", () => {
        const wide = {
            ...withArticles.articles![0]!,
            blocks: [{ kind: "image" as const, wide: true, src: "/d.svg", alt: "A diagram", width: 920, height: 400 }],
        };
        const html = buildStatic(defineDocs({ ...docs, articles: [wide] }), { now })["articles/older/index.html"]!;
        expect(html).toContain('<figure class="dd-figure dd-figure--wide"><img class="dd-media dd-media--center" src="/d.svg" alt="A diagram" width="920" height="400"');
    });

    it("shows a drawing without a frame and keeps a cover's dark rendition on its card", () => {
        const cover = {
            src: "/art/hero-light.webp",
            sources: [{ srcset: "/art/hero-dark.webp", media: "(prefers-color-scheme: dark)", type: "image/webp" }],
            alt: "An animated diagram",
            width: 920,
            height: 400,
            drawing: true,
        };
        const built = buildStatic(defineDocs({ ...docs, articles: [{ ...withArticles.articles![0]!, cover }] }), { now });
        expect(built["articles/older/index.html"]).toContain('<img class="dd-media dd-media--center dd-media--drawing" src="/art/hero-light.webp"');
        expect(built["articles/index.html"]).toContain(
            '<picture><source srcset="/art/hero-dark.webp" media="(prefers-color-scheme: dark)" type="image/webp">' +
            '<img class="dd-article-card-image dd-article-card-image--drawing" src="/art/hero-light.webp" alt=""',
        );
    });

    it("ends each article with the other articles, newest first, and a link to all", () => {
        const older = built["articles/older/index.html"]!;
        expect(older).toContain('<h2 class="dd-article-more-title" id="dd-article-more-title">More articles</h2>');
        expect(older).toContain('<a class="dd-article-all" href="/articles/">All articles</a>');
        expect(older).toContain('<a class="dd-article-card" href="/articles/newer/">');
        expect(older).toContain('<h3 class="dd-article-question">');
        expect(older).not.toContain('href="/articles/older/"');
        const alone = buildStatic(defineDocs({ ...docs, articles: [withArticles.articles![0]!] }), { now })["articles/older/index.html"]!;
        expect(alone).not.toContain("dd-article-more-title");
        expect(alone).toContain('<a class="dd-article-all" href="/articles/">All articles</a>');
    });

    it("rounds reading time up from the rendered words", () => {
        const long = { ...withArticles.articles![0]!, blocks: [{ kind: "p" as const, text: "word ".repeat(231) }] };
        expect(buildStatic(defineDocs({ ...docs, articles: [long] }), { now })["articles/older/index.html"]).toContain("2 min read");
    });

    it("publishes an RSS feed, newest first, dated by publication", () => {
        const feed = built["articles/feed.xml"]!;
        expect(feed.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"')).toBe(true);
        expect(feed.match(/<item>/g)).toHaveLength(2);
        expect([...feed.matchAll(/<link>([^<]+)<\/link>/g)].map((m) => m[1])).toEqual([
            "https://noceremony.app/articles/",
            "https://noceremony.app/articles/newer/",
            "https://noceremony.app/articles/older/",
        ]);
        expect(feed).toContain("<pubDate>Mon, 01 Jun 2026 00:00:00 GMT</pubDate>");
        expect(feed).toContain("Exporting &amp; keeping a backup");
        expect(built["articles/index.html"]).toContain('type="application/rss+xml"');
    });

    it("lists the articles in the sitemap, llms.txt and questions.json with real dates", () => {
        const sitemap = built["sitemap.xml"]!;
        expect(sitemap).toContain("<loc>https://noceremony.app/articles/</loc>\n    <lastmod>2026-07-01</lastmod>");
        expect(sitemap).toContain("<loc>https://noceremony.app/articles/newer/</loc>\n    <lastmod>2026-07-01</lastmod>");
        expect(sitemap).toContain("<loc>https://noceremony.app/articles/older/</loc>\n    <lastmod>2026-05-01</lastmod>");
        expect(built["llms.txt"]).toContain("## Articles");
        expect(built["llms.txt"]).toContain("Published 2026-06-01, updated 2026-07-01");
        const questions = JSON.parse(built["questions.json"]!).questions;
        expect(questions.at(-2)).toMatchObject({ id: "newer", published: "2026-06-01", updated: "2026-07-01" });
        for (const [path, body] of Object.entries(built)) {
            if (path !== "questions.json" && path !== "facts.json") expect(body, path).not.toContain("2030-01-01");
        }
    });

    it("changes nothing for a document without articles", () => {
        const plainBuild = buildStatic(docs, { now });
        expect(plainBuild).toEqual(buildStatic({ ...docs, articles: [] }, { now }));
        expect(Object.keys(plainBuild).some((path) => path.startsWith("articles/"))).toBe(false);
    });

    it("refuses an undated article and an id shared with a section", () => {
        const codes = (articles: unknown[]) =>
            validate(defineDocs({ ...docs, articles: articles as never })).map((f) => f.code);
        const article = withArticles.articles![0]!;
        expect(codes([{ ...article, published: undefined }])).toContain("article-without-date");
        expect(codes([{ ...article, id: "export" }])).toContain("duplicate-section-id");
        expect(codes([{ ...article, answer: "It is great." }])).toContain("answer-opens-with-pronoun");
    });

    it("refuses to overwrite a manual page that already uses the articles path", () => {
        expect(() => buildStatic(withArticles, { now, basePath: "articles" })).toThrow(/articles would overwrite/);
    });
});


describe("arbitrary-column tables on public static pages", () => {
    const tableDocs = (rows: string[][]): DocSet => defineDocs({
        ...docs,
        sections: [{ id: "table", title: "Table", question: "What is listed?",
            answer: "Example lists three columns.",
            blocks: [{ kind: "table", head: ["First", "Second", "Third"], rows }],
        }],
    });

    it("renders every cell on the full document and section page", () => {
        const output = buildStatic(tableDocs([["one", "two", "**three**"], ["a", "b", "<c>"]]), { now });
        for (const path of ["docs/index.html", "docs/table/index.html"]) {
            expect(output[path]).toContain('<thead><tr><th>First</th><th>Second</th><th>Third</th></tr></thead><tbody><tr><td>one</td><td>two</td><td><strong>three</strong></td></tr><tr><td>a</td><td>b</td><td>&lt;c&gt;</td></tr></tbody>');
        }
    });

    it("rejects a document with a row whose width differs from its head", () => {
        expect(() => buildStatic(tableDocs([["one", "two"]]), { now })).toThrow(InvalidDocumentError);
    });
});
