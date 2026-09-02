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
    type DocSection,
    type DocSet,
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
}

/** Raised when a document has a fault that must not reach a published page. */
export class InvalidDocumentError extends Error {
    constructor(readonly findings: Finding[]) {
        const lines = findings.map((f) => `  ${f.code}: ${f.message}`).join("\n");
        super(`dopedocs refused to build ${findings.length} fatal finding(s):\n${lines}`);
        this.name = "InvalidDocumentError";
    }
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

/** Flattens a section tree into reading order, keeping parentage for breadcrumbs. */
function flatten(
    sections: DocSection[],
    parent?: DocSection,
): { section: DocSection; parent?: DocSection }[] {
    return sections.flatMap((section) => [
        { section, parent },
        ...flatten(section.children ?? [], section),
    ]);
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
}

function page(input: PageInput): string {
    const { title, description, canonical, body, graph, entity } = input;
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
${entity.logo ? `<meta property="og:image" content="${esc(entity.logo)}">\n` : ""}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${[input.stylesheet ?? []]
    .flat()
    .map((href) => `<link rel="stylesheet" href="${esc(href)}">\n`)
    .join("")}<script type="application/ld+json">
${jsonLd(graph)}
</script>
</head>
<body>
<article class="dd-page">
${body}
</article>
</body>
</html>
`;
}

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
        now = new Date(),
        robots = {},
    } = options;

    const basePath = trimSlashes(options.basePath ?? docs.basePath ?? "docs");
    const origin = docs.entity.url.replace(/\/+$/, "");
    const entityId = `${origin}/#entity`;
    const indexUrl = `${origin}/${basePath}/`;
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

    const out: Record<string, string> = {};
    const entityJson = {
        ...entityNode(docs.entity, entityType, entityId),
        // A version is only meaningful on a software entity; on an Organization
        // it would be a nonsense property.
        ...(docs.identity?.version && /software|application|webapp/i.test(entityType)
            ? { softwareVersion: docs.identity.version }
            : {}),
    };

    /* --- index --------------------------------------------------------- */

    const contentsList =
        `<nav class="dd-contents"><h2>Contents</h2><ul class="dd-list">` +
        all
            .map(
                ({ section }) =>
                    `<li><a href="${escapeHtml(urlFor(section.id))}">${escapeHtml(
                        section.title,
                    )}</a></li>`,
            )
            .join("") +
        `</ul></nav>`;

    out[`${basePath}/index.html`] = page({
        title: docs.title,
        description: plain(docs.lead, facts, "the document lead"),
        canonical: indexUrl,
        entity: docs.entity,
        stylesheet: options.stylesheet,
        body: renderLead(docs) + contentsList + renderBody(docs),
        graph: {
            "@context": "https://schema.org",
            "@graph": [
                entityJson,
                {
                    "@type": "WebSite",
                    "@id": `${origin}/#website`,
                    url: origin,
                    name: docs.entity.name,
                    publisher: { "@id": entityId },
                },
                {
                    "@type": "CollectionPage",
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

    for (const [index, { section, parent }] of all.entries()) {
        const url = urlFor(section.id);
        const entry = entries[index]!;
        const prev = all[index - 1]?.section;
        const next = all[index + 1]?.section;

        const nav =
            `<nav class="dd-pager">` +
            (prev
                ? `<a rel="prev" href="${escapeHtml(urlFor(prev.id))}">${escapeHtml(
                      prev.title,
                  )}</a>`
                : "") +
            `<a href="${escapeHtml(indexUrl)}">All documentation</a>` +
            (next
                ? `<a rel="next" href="${escapeHtml(urlFor(next.id))}">${escapeHtml(
                      next.title,
                  )}</a>`
                : "") +
            `</nav>`;

        const crumbs = [
            { name: docs.title, item: indexUrl },
            ...(parent ? [{ name: parent.title, item: urlFor(parent.id) }] : []),
            { name: section.title, item: url },
        ];

        out[`${basePath}/${section.id}/index.html`] = page({
            title: `${section.title} - ${docs.entity.name}`,
            description: entry.answer,
            canonical: url,
            entity: docs.entity,
            stylesheet: options.stylesheet,
            // Children are rendered by renderSection as sibling sections, so a
            // parent's page carries its folder in full while each child keeps
            // its own address.
            body: renderSection(section, facts) + nav,
            graph: {
                "@context": "https://schema.org",
                "@graph": [
                    entityJson,
                    {
                        "@type": "TechArticle",
                        "@id": `${url}#article`,
                        url,
                        headline: section.title,
                        description: entry.answer,
                        dateModified: lastmod,
                        about: { "@id": entityId },
                        publisher: { "@id": entityId },
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

    return out;
}
