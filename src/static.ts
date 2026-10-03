/**
 * The static build: what search engines and answer engines actually read.
 *
 * DEC-04 makes each section a real file at a real URL, complete without
 * JavaScript, so a crawler and a person arrive at the same address and find the
 * same document. `buildStatic` is pure — it returns a path-to-contents map and
 * writes nothing, so the Vite plugin and any other host merely persist what it
 * produced.
 */

import type { FactMap } from "./facts.js";
import { escapeHtml, inline, renderBody, renderLead, renderSection } from "./render.js";
import {
    hasFatal,
    validate,
    type DocPage,
    type DocSection,
    type DocSet,
    isGroup,
    pagesOf,
    type Finding,
    type SiteEntity,
} from "./schema.js";

/* ── Options ─────────────────────────────────────────────────────────────── */

/**
 * How crawlers are ruled. Search and training are separate decisions: allowing
 * a site to be cited in an answer is not the same as allowing it to be trained
 * on, and conflating them is how a policy ends up broader than intended.
 */
export interface RobotsPolicy {
    /** Crawlers that surface pages in search and answer results. */
    search?: string[];
    /** Crawlers that gather material for model training. */
    training?: string[];
    /** Allow the search crawlers. Default true. */
    allowSearch?: boolean;
    /** Allow the training crawlers. Default false. */
    allowTraining?: boolean;
}

export interface BuildStaticOptions {
    /** Where the docs are served. Defaults to the document's own, else `/docs`. */
    basePath?: string;
    /** Schema.org type for the entity. Default `Organization`. */
    entityType?: string;
    /**
     * Schema.org type of each section's page. Default `TechArticle`, which
     * suits software documentation; a business answering its customers'
     * questions wants `Article` or `WebPage`.
     */
    articleType?: string;
    /** Schema.org type of the index, the whole manual on one page. Default `CollectionPage`. */
    indexType?: string;
    /** Schema.org type of the site the docs belong to. Default `WebSite`. */
    siteType?: string;
    /** Crawler policy; the defaults allow search and refuse training. */
    robots?: RobotsPolicy;
    /**
     * Stylesheet href(s) to link from every page, e.g. `/assets/docs.css`.
     *
     * An array links each in order, so a consumer puts dopedocs' own sheet
     * first and their `--dd-*` token aliases after it. Without that the static
     * pages render in the fallback palette while the in-app panel — which picks
     * up aliases from the app bundle — does not, and the pages search engines
     * see are the ones that look nothing like the product.
     */
    stylesheet?: string | string[];
    /** Injected for deterministic output. Defaults to now. */
    now?: Date;
    /** Findings older than this many days mark a fact stale. Default 365. */
    staleAfterDays?: number;
    /**
     * The visible note telling a reader, and an AI assistant, that the complete
     * documentation is one page. Each string is plain text with placeholders:
     * `{title}` is the document title, `{link}` (section pages) becomes a link
     * to the index showing its address, and `{words}` (the index) is the
     * rounded word count of the whole document. `false` leaves the note out.
     */
    fullManualNote?: false | { section?: string; index?: string };
}

/** The default wording of the full-manual note. */
export const DEFAULT_FULL_MANUAL_NOTE = {
    section: "This page is one part of {title}. The complete manual is a single page, short enough to read in one go: {link}",
    index: "This page is the whole of {title}: every section, about {words} words. It is short enough to read in one go.",
};

/** Raised when a document has a fault that must not reach a published page. */
export class InvalidDocumentError extends Error {
    constructor(readonly findings: Finding[]) {
        const lines = findings.map((f) => `  ${f.code}: ${f.message}`).join("\n");
        super(`dopedocs refused to build ${findings.length} fatal finding(s):\n${lines}`);
        this.name = "InvalidDocumentError";
    }
}

/**
 * A word count rounded for prose: to the nearest hundred below 1,000 words,
 * else to the nearest thousand, with thousands separators.
 */
function roundWords(html: string): string {
    const text = html.replace(/<[^>]+>/g, " ");
    const count = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    const step = count < 1000 ? 100 : 1000;
    return (Math.max(step, Math.round(count / step) * step)).toLocaleString("en-US");
}

/** The crawlers ruled by default, named individually rather than by wildcard. */
export const DEFAULT_SEARCH_BOTS = [
    "Googlebot",
    "Bingbot",
    "OAI-SearchBot",
    "PerplexityBot",
    "Claude-SearchBot",
    "DuckDuckBot",
];

/** Crawlers that gather training material; refused by default. */
export const DEFAULT_TRAINING_BOTS = ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"];

/* ── Small helpers ───────────────────────────────────────────────────────── */

const trimSlashes = (s: string) => s.replace(/^\/+|\/+$/g, "");

/** `</script>` inside JSON would close the tag early; `<` is the only escape needed. */
const jsonLd = (value: unknown): string =>
    JSON.stringify(value, null, 2).replace(/</g, "\\u003c");

/** Every page in reading order. Groups are labels and get no page of their own. */
function flatten(sections: DocSection[]): { section: DocPage }[] {
    return pagesOf(sections).map(({ page }) => ({ section: page }));
}

/** Strips marks and fills facts, for values that must be plain text. */
const plain = (raw: string, facts: FactMap, where: string): string =>
    inline(raw, facts, where)
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .trim();

/* ── Structured data ─────────────────────────────────────────────────────── */

/**
 * The entity, with one stable `@id` every page points at.
 *
 * `disambiguatingDescription` is generated from the required
 * `notToBeConfusedWith`, because a name collision is the ordinary way an answer
 * engine attributes the wrong product's facts to yours.
 */
function entityNode(entity: SiteEntity, entityType: string, id: string) {
    const collisions = entity.notToBeConfusedWith;
    return {
        "@type": entityType,
        "@id": id,
        name: entity.name,
        url: entity.url,
        ...(entity.legalName ? { legalName: entity.legalName } : {}),
        ...(entity.tagline ? { description: entity.tagline } : {}),
        ...(entity.logo ? { logo: entity.logo } : {}),
        ...(entity.sameAs?.length ? { sameAs: entity.sameAs } : {}),
        ...(entity.contactEmail ? { email: entity.contactEmail } : {}),
        ...(collisions.length
            ? {
                  disambiguatingDescription: `${entity.name} is not affiliated with ${collisions.join(
                      ", ",
                  )}.`,
              }
            : {}),
    };
}

const faqNode = (
    entries: { question: string; answer: string; url: string }[],
    id: string,
) => ({
    "@type": "FAQPage",
    "@id": id,
    mainEntity: entries.map((e) => ({
        "@type": "Question",
        name: e.question,
        url: e.url,
        acceptedAnswer: { "@type": "Answer", text: e.answer },
    })),
});

/* ── Page shell ──────────────────────────────────────────────────────────── */

interface PageInput {
    title: string;
    description: string;
    canonical: string;
    body: string;
    graph: unknown;
    entity: SiteEntity;
    stylesheet?: string | string[];
    /** The bar and rail wrapped around the article (DEC-07). */
    chrome: { bar: string; rail: string };
    /** Marks a single section's page, whose own title is the page's h1. */
    section?: boolean;
    /** The whole document on one page, linked as the alternate reading. */
    whole?: { url: string; title: string };
}

/**
 * The content is emitted before the rail. A text extractor reads in source
 * order, and with the rail first every page opened with the same list of every
 * section title before a word of its own. The stylesheet places the rail back
 * on the left (above, when narrow), so a person sees no difference.
 */
function page(input: PageInput): string {
    const { title, description, canonical, body, graph, entity, chrome } = input;
    const esc = escapeHtml;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(entity.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${input.whole ? `<link rel="alternate" type="text/html" title="${esc(input.whole.title)}" href="${esc(input.whole.url)}">\n` : ""}${entity.logo ? `<meta property="og:image" content="${esc(entity.logo)}">\n` : ""}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${[input.stylesheet ?? []]
    .flat()
    .map((href) => `<link rel="stylesheet" href="${esc(href)}">\n`)
    .join("")}<script type="application/ld+json">
${jsonLd(graph)}
</script>
</head>
<body class="dd-static">
${chrome.bar}
<div class="dd-body">
<main class="dd-page${input.section ? " dd-page--section" : ""}">
<article>
${body}
</article>
</main>
${chrome.rail}
</div>
</body>
</html>
`;
}

/* ── Chrome (DEC-07) ─────────────────────────────────────────────────────── */

/** The back arrow. Inline and self-contained so it needs no stylesheet. */
const BACK_ARROW =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `<path d="M15 18l-6-6 6-6"/></svg>`;

/* ── The build ───────────────────────────────────────────────────────────── */

/**
 * Renders a whole documentation set to static files.
 *
 * Returns a map of output path to contents; nothing is written. Refuses to
 * produce anything when the document carries a fatal finding, because a
 * structural fault that reaches a published page is read by machines and cached
 * long after it is fixed.
 */
export function buildStatic(
    docs: DocSet,
    options: BuildStaticOptions = {},
): Record<string, string> {
    const findings = validate(docs, {
        today: options.now,
        staleAfterDays: options.staleAfterDays,
    });
    if (hasFatal(findings)) {
        throw new InvalidDocumentError(findings.filter((f) => f.severity === "fatal"));
    }

    const {
        entityType = "Organization",
        articleType = "TechArticle",
        indexType = "CollectionPage",
        siteType = "WebSite",
        now = new Date(),
        robots = {},
    } = options;

    const basePath = trimSlashes(options.basePath ?? docs.basePath ?? "docs");
    const origin = docs.entity.url.replace(/\/+$/, "");
    const entityId = `${origin}/#entity`;
    const indexUrl = `${origin}/${basePath}/`;
    /**
     * Where the site sits on its host, from the entity's own URL — `/` for a
     * site at the domain root, `/product/` for one under a subpath.
     *
     * Links a reader follows are paths, not absolute URLs. An absolute link
     * would send someone browsing a local build or a preview deployment
     * straight to production, which is the one place a developer checking a
     * change does not want to land. Metadata a machine reads — canonical,
     * og:url, the JSON-LD ids, sitemap and llms.txt — stays absolute, because
     * there the whole point is naming one address unambiguously.
     */
    const homePath = (() => {
        try {
            const { pathname } = new URL(docs.entity.url);
            return pathname.endsWith("/") ? pathname : `${pathname}/`;
        } catch {
            return "/";
        }
    })();
    const indexPath = `${homePath}${basePath}/`;
    /** A section's in-site path, for links a reader follows. */
    const pathFor = (id: string) => `${homePath}${basePath}/${id}/`;
    /** The one canonical URL a section owns (DEC-04). */
    const urlFor = (id: string) => `${origin}/${basePath}/${id}/`;
    const lastmod = now.toISOString().slice(0, 10);
    const facts = docs.facts;

    const all = flatten(docs.sections);
    const entries = all.map(({ section }) => ({
        id: section.id,
        title: section.title,
        url: urlFor(section.id),
        question: plain(section.question, facts, `section "${section.id}"`),
        answer: plain(section.answer, facts, `section "${section.id}"`),
    }));

    /* --- chrome (DEC-07) ------------------------------------------------
       The bar and rail are derived, never configured: the site root comes from
       the entity's own URL, the labels from its name and the document title,
       and the rail from the section tree. A consumer rebuilds and has chrome. */

    const bar =
        `<div class="dd-bar">` +
        `<a class="dd-back" href="${escapeHtml(homePath)}">` +
        `${BACK_ARROW}${escapeHtml(docs.entity.name)}</a>` +
        `<span class="dd-bar-page">${escapeHtml(docs.title)}</span>` +
        `</div>`;

    /** One rail link, marked when it is the page being read. */
    const navLink = (s: DocPage, currentId?: string): string =>
        `<a class="dd-nav-link${s.id === currentId ? " is-active" : ""}"` +
        ` href="${escapeHtml(pathFor(s.id))}"` +
        (s.id === currentId ? ` aria-current="page"` : "") +
        `>${escapeHtml(s.title)}</a>`;

    // A group is a native <details>, open by default: it folds without any
    // script, and nothing is hidden from a crawler, which reads closed
    // <details> content anyway. Its summary is a label, not a link: a group
    // has no page.
    /** A rail entry: a page link, or a group label with its pages beneath. */
    const railItem = (s: DocSection, currentId?: string): string =>
        isGroup(s)
            ? `<li><details class="dd-nav-group" open>` +
              `<summary>${escapeHtml(s.title)}</summary>` +
              `<ul class="dd-nav-list">` +
              s.children.map((page) => `<li>${navLink(page, currentId)}</li>`).join("") +
              `</ul></details></li>`
            : `<li>${navLink(s, currentId)}</li>`;

    /** The whole rail; `currentId` is absent on the index, which is nobody's section. */
    const railFor = (currentId?: string): string =>
        `<nav class="dd-nav" aria-label="Contents">` +
        `<p class="dd-nav-label">Contents</p>` +
        `<ul class="dd-nav-list">` +
        docs.sections.map((s) => railItem(s, currentId)).join("") +
        `</ul></nav>`;

    const out: Record<string, string> = {};
    const entityJson = {
        ...entityNode(docs.entity, entityType, entityId),
        // A version is only meaningful on a software entity; on an Organization
        // it would be a nonsense property.
        ...(docs.identity?.version && /software|application|webapp/i.test(entityType)
            ? { softwareVersion: docs.identity.version }
            : {}),
    };

    /* --- the full-manual note -------------------------------------------
       The index already carries every section back to back. Saying so on
       every page, in text people see too, is how an AI assistant that lands
       on one section learns the whole manual is one read away. */

    const noteText = options.fullManualNote === false
        ? undefined
        : { ...DEFAULT_FULL_MANUAL_NOTE, ...options.fullManualNote };
    const fill = (template: string, values: Record<string, string>): string =>
        escapeHtml(template).replace(/\{(title|words|link)\}/g, (m, key: string) =>
            values[key] ?? m,
        );
    const indexLink =
        `<a href="${escapeHtml(indexPath)}">` +
        `${escapeHtml(indexUrl.replace(/^https?:\/\//, ""))}</a>`;
    const sectionNote = noteText
        ? `<p class="dd-fullnote">${fill(noteText.section, {
              title: escapeHtml(docs.title),
              link: indexLink,
          })}</p>`
        : "";
    const indexBody = renderLead(docs) + renderBody(docs);
    const indexNote = noteText
        ? `<p class="dd-fullnote">${fill(noteText.index, {
              title: escapeHtml(docs.title),
              words: roundWords(indexBody),
          })}</p>`
        : "";

    /* --- index --------------------------------------------------------- */

    const contentsLink = (page: DocPage) =>
        `<li><a href="${escapeHtml(pathFor(page.id))}">${escapeHtml(page.title)}</a></li>`;
    const contentsList =
        `<nav class="dd-contents"><h2>Contents</h2><ul class="dd-list">` +
        docs.sections
            .map((section) =>
                isGroup(section)
                    ? `<li>${escapeHtml(section.title)}<ul class="dd-list">` +
                      section.children.map(contentsLink).join("") +
                      `</ul></li>`
                    : contentsLink(section),
            )
            .join("") +
        `</ul></nav>`;

    out[`${basePath}/index.html`] = page({
        title: docs.title,
        description: plain(docs.lead, facts, "the document lead"),
        canonical: indexUrl,
        entity: docs.entity,
        stylesheet: options.stylesheet,
        chrome: { bar, rail: railFor() },
        body: renderLead(docs) + indexNote + contentsList + renderBody(docs),
        graph: {
            "@context": "https://schema.org",
            "@graph": [
                entityJson,
                {
                    "@type": siteType,
                    "@id": `${origin}/#website`,
                    url: origin,
                    name: docs.entity.name,
                    publisher: { "@id": entityId },
                },
                {
                    "@type": indexType,
                    "@id": `${indexUrl}#page`,
                    url: indexUrl,
                    name: docs.title,
                    isPartOf: { "@id": `${origin}/#website` },
                    about: { "@id": entityId },
                },
                faqNode(entries, `${indexUrl}#faq`),
            ],
        },
    });

    /* --- one page per section ------------------------------------------ */

    for (const [index, { section }] of all.entries()) {
        const url = urlFor(section.id);
        const entry = entries[index]!;
        const prev = all[index - 1]?.section;
        const next = all[index + 1]?.section;

        const nav =
            `<nav class="dd-pager">` +
            (prev
                ? `<a rel="prev" href="${escapeHtml(pathFor(prev.id))}">${escapeHtml(
                      prev.title,
                  )}</a>`
                : "") +
            `<a href="${escapeHtml(indexPath)}">Complete manual (one page)</a>` +
            (next
                ? `<a rel="next" href="${escapeHtml(pathFor(next.id))}">${escapeHtml(
                      next.title,
                  )}</a>`
                : "") +
            `</nav>`;

        // A group has no URL, so it is not a crumb: a breadcrumb step must
        // lead somewhere.
        const crumbs = [
            { name: docs.title, item: indexUrl },
            { name: section.title, item: url },
        ];

        out[`${basePath}/${section.id}/index.html`] = page({
            title: `${section.title} - ${docs.entity.name}`,
            description: entry.answer,
            canonical: url,
            entity: docs.entity,
            stylesheet: options.stylesheet,
            chrome: { bar, rail: railFor(section.id) },
            section: true,
            whole: { url: indexUrl, title: `${docs.title}, complete on one page` },
            // The section is the page, so its title is the page's one h1 — the
            // heading a text extractor takes as the topic.
            body: sectionNote + renderSection(section, facts, { headingLevel: 1 }) + nav,
            graph: {
                "@context": "https://schema.org",
                "@graph": [
                    entityJson,
                    {
                        "@type": articleType,
                        "@id": `${url}#article`,
                        url,
                        headline: section.title,
                        description: entry.answer,
                        dateModified: lastmod,
                        about: { "@id": entityId },
                        publisher: { "@id": entityId },
                        isPartOf: { "@id": `${indexUrl}#page` },
                        ...(section.keywords?.length
                            ? { keywords: section.keywords.join(", ") }
                            : {}),
                    },
                    faqNode([entry], `${url}#faq`),
                    {
                        "@type": "BreadcrumbList",
                        "@id": `${url}#breadcrumbs`,
                        itemListElement: crumbs.map((c, i) => ({
                            "@type": "ListItem",
                            position: i + 1,
                            name: c.name,
                            item: c.item,
                        })),
                    },
                ],
            },
        });
    }

    /* --- sitemap -------------------------------------------------------- */

    out["sitemap.xml"] =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        [indexUrl, ...entries.map((e) => e.url)]
            .map(
                (loc) =>
                    `  <url>\n    <loc>${escapeHtml(loc)}</loc>\n` +
                    `    <lastmod>${lastmod}</lastmod>\n  </url>`,
            )
            .join("\n") +
        `\n</urlset>\n`;

    /* --- robots --------------------------------------------------------- */

    const {
        search = DEFAULT_SEARCH_BOTS,
        training = DEFAULT_TRAINING_BOTS,
        allowSearch = true,
        allowTraining = false,
    } = robots;

    /** One robots stanza per named agent, rather than a wildcard group. */
    const rule = (agents: string[], allow: boolean) =>
        agents
            .map((a) => `User-agent: ${a}\n${allow ? "Allow: /" : "Disallow: /"}`)
            .join("\n\n");

    out["robots.txt"] =
        `# Search and answer-engine crawlers\n${rule(search, allowSearch)}\n\n` +
        `# Model-training crawlers — a separate decision from search\n` +
        `${rule(training, allowTraining)}\n\n` +
        `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;

    /* --- llms.txt ------------------------------------------------------- */

    out["llms.txt"] =
        `# ${docs.entity.name}\n\n` +
        `> ${plain(docs.lead, facts, "the document lead")}\n\n` +
        (docs.entity.notToBeConfusedWith.length
            ? `Not to be confused with: ${docs.entity.notToBeConfusedWith.join(", ")}.\n\n`
            : "") +
        `## Documentation\n\n` +
        entries
            .map((e) => `### ${e.title}\n\n${e.question}\n\n${e.answer}\n\n${e.url}\n`)
            .join("\n") +
        "\n";

    /* --- questions.json ------------------------------------------------- */

    out["questions.json"] =
        JSON.stringify(
            {
                entity: docs.entity.name,
                generated: lastmod,
                questions: entries.map((e) => ({
                    id: e.id,
                    question: e.question,
                    answer: e.answer,
                    url: e.url,
                })),
            },
            null,
            2,
        ) + "\n";

    /* --- facts.json -----------------------------------------------------
       The registry as data, for surfaces outside the build — a template on
       another platform can fetch the same values the pages interpolate. Only
       `value` and `reviewed` are published; `note` is reviewer context and
       is never rendered anywhere, so it stays out of this file too. */

    out["facts.json"] =
        JSON.stringify(
            {
                entity: docs.entity.name,
                generated: lastmod,
                facts: Object.fromEntries(
                    Object.entries(facts).map(([key, fact]) => [
                        key,
                        { value: fact.value, reviewed: fact.reviewed },
                    ]),
                ),
            },
            null,
            2,
        ) + "\n";

    return out;
}
