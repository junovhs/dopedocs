import { generateApiSamples } from "./api.js";
import { createSearchIndex, renderSearch, searchScript } from "./search.js";
/**
 * The static build: what search engines and answer engines actually read.
 *
 * DEC-04 makes each section a real file at a real URL, complete without
 * JavaScript, so a crawler and a person arrive at the same address and find the
 * same document. `buildStatic` is pure — it returns a path-to-contents map and
 * writes nothing, so the Vite plugin and any other host merely persist what it
 * produced.
 */

import { icon } from "./icons.js";
import { headingId, plainText as plain } from "./inline.js";
import type { FactMap } from "./facts.js";
import { escapeHtml, inline, renderBlock, renderBody, renderLead, renderSection, type SectionHref } from "./render.js";
import {
    hasFatal,
    validate,
    type DocArticle,
    type DocBlock,
    type DocPage,
    type DocSection,
    type DocSet,
    isGroup,
    pagesOf,
    reservedEntityProperty,
    type JsonValue,
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

/** Whether the pages may appear in search results. */
export type Indexing = "index" | "noindex";

/** The robots meta each page carries, by indexing policy. */
const ROBOTS_META: Record<Indexing, string> = {
    index: "index,follow,max-image-preview:large,max-snippet:-1",
    noindex: "noindex, nofollow",
};

export interface BuildStaticOptions {
    /** Enable local search enhancement; true adds a self-hosted search script. Default false. */
    search?: boolean;
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
     * Whether search engines may index the pages. Default `"index"`.
     *
     * `"noindex"` is for a site that is not ready to be found: every page says
     * `noindex, nofollow`, and robots.txt stops advertising the sitemap,
     * because pointing a crawler at a list of pages it is told not to index
     * contradicts the policy. The files are still written, so turning
     * indexing on later is a rebuild, not a migration.
     */
    indexing?: Indexing;
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

/* ── Structured data ─────────────────────────────────────────────────────── */

/** `schemaProperties` without the keys dopedocs owns. */
const ownable = (properties: Record<string, JsonValue>) =>
    Object.fromEntries(
        Object.entries(properties).filter(
            ([key]) => !key.startsWith("@") && reservedEntityProperty(key) === undefined,
        ),
    );

/**
 * The entity, with one stable `@id` every page points at.
 *
 * `disambiguatingDescription` is generated from the required
 * `notToBeConfusedWith`, because a name collision is the ordinary way an answer
 * engine attributes the wrong product's facts to yours.
 *
 * `schemaProperties` pass through as written. A reserved key never gets this
 * far — validation refuses the build — but it is filtered here as well, so
 * dopedocs' own fields win even for a caller that skips validation.
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
        ...(entity.schemaProperties ? ownable(entity.schemaProperties) : {}),
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
    skipScriptPath: string;
    /** Marks a single section's page, whose own title is the page's h1. */
    section?: boolean;
    /** Marks an article or the articles index: one centred column, no rail. */
    article?: boolean;
    /** The whole document on one page, linked as the alternate reading. */
    whole?: { url: string; title: string };
    /** The articles feed, advertised so a feed reader finds it from the page. */
    feed?: { url: string; title: string };
    indexing: Indexing;
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
    // Authored section/block ids share the page's namespace.
    let contentId = "dd-content";
    while (body.includes(`id="${contentId}"`)) contentId += "-main";
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="${esc(input.skipScriptPath)}" defer></script>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${ROBOTS_META[input.indexing]}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(entity.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${input.whole ? `<link rel="alternate" type="text/html" title="${esc(input.whole.title)}" href="${esc(input.whole.url)}">\n` : ""}${input.feed ? `<link rel="alternate" type="application/rss+xml" title="${esc(input.feed.title)}" href="${esc(input.feed.url)}">\n` : ""}${entity.logo ? `<meta property="og:image" content="${esc(entity.logo)}">\n` : ""}<meta name="twitter:card" content="summary_large_image">
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
<a class="dd-skip" href="#${contentId}">Skip to content</a>
${chrome.bar}
<div class="dd-body">
<main id="${contentId}" tabindex="-1" class="dd-page${input.section ? " dd-page--section" : ""}${input.article ? " dd-page--article" : ""}">
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
const BACK_ARROW = icon("arrow-left");

/* ── Articles (DEC-18) ───────────────────────────────────────────────────── */

/** Articles sit at the site root, independent of the manual's base path. */
const ARTICLES_DIR = "articles";

interface ArticleEntry {
    article: DocArticle;
    url: string;
    question: string;
    answer: string;
    /** The date the article last changed: `updated`, else `published` (DEC-19). */
    modified: string;
    /** Minutes to read the body at an unhurried 230 words a minute. */
    minutes: number;
}

/** Every article with its resolved text, newest first; ties keep authoring order. */
function articleEntriesOf(docs: DocSet, origin: string): ArticleEntry[] {
    return (docs.articles ?? [])
        .map((article) => ({
            article,
            url: `${origin}/${ARTICLES_DIR}/${article.id}/`,
            question: plain(article.question, docs.facts, `article "${article.id}"`),
            answer: plain(article.answer, docs.facts, `article "${article.id}"`),
            modified: article.updated ?? article.published,
            minutes: readingMinutes(article, docs.facts),
        }))
        .sort((a, b) => b.article.published.localeCompare(a.article.published));
}

/** An ISO day as a reader writes it: "June 1, 2026". */
const readableDate = (day: string): string =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

/** Reading time from the rendered body, so facts count as the words they become. */
function readingMinutes(article: DocArticle, facts: FactMap): number {
    const html = article.blocks
        .map((block) => renderBlock(block, facts, `article "${article.id}"`))
        .join(" ");
    const words = html
        .replace(/<[^>]+>/g, " ")
        .split(/\s+/)
        .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
    return Math.max(1, Math.ceil(words / 230));
}

/** A cover's src as an absolute URL, for structured data a machine reads. */
const absoluteSrc = (src: string, origin: string): string =>
    /^https?:\/\//.test(src) ? src : `${origin}/${src.replace(/^\/+/, "")}`;

/** A day a reader can read and a machine can parse. */
const dateTime = (day: string): string =>
    `<time datetime="${escapeHtml(day)}">${escapeHtml(readableDate(day))}</time>`;

/** The date line shared by the byline and the cards: published, updated, minutes. */
function articleDates({ article, minutes }: ArticleEntry): string {
    const parts = [dateTime(article.published)];
    if (article.updated && article.updated !== article.published) {
        parts.push(`Updated ${dateTime(article.updated)}`);
    }
    parts.push(`${minutes} min read`);
    return parts.join(" · ");
}

/**
 * The byline: an initial in a circle stands in for a portrait, so an author
 * needs no photo and the page needs no extra request.
 */
function articleByline(entry: ArticleEntry): string {
    const { author } = entry.article;
    const avatar = author
        ? `<span class="dd-avatar" aria-hidden="true">${escapeHtml(author.trim().charAt(0).toUpperCase())}</span>`
        : "";
    const name = author ? `<span class="dd-byline-name">By ${escapeHtml(author)}</span>` : "";
    return (
        `<div class="dd-byline">${avatar}` +
        `<p class="dd-article-meta">${name}<span class="dd-byline-dates">${articleDates(entry)}</span></p>` +
        `</div>`
    );
}

/** A card on the articles index: the whole card is one link. */
function articleCard(entry: ArticleEntry, href: string, level: 2 | 3 = 2): string {
    const { cover } = entry.article;
    const img = cover
        ? `<img class="dd-article-card-image${cover.drawing ? " dd-article-card-image--drawing" : ""}" src="${escapeHtml(cover.src)}" alt=""` +
          (cover.width !== undefined ? ` width="${cover.width}"` : "") +
          (cover.height !== undefined ? ` height="${cover.height}"` : "") +
          ` loading="lazy" decoding="async">`
        : "";
    // The cover's art-directed sources carry over, so a dark rendition shows in dark mode.
    const image = cover?.sources?.length
        ? `<picture>${cover.sources
              .map(
                  (source) =>
                      `<source srcset="${escapeHtml(source.srcset)}"` +
                      (source.media ? ` media="${escapeHtml(source.media)}"` : "") +
                      (source.type ? ` type="${escapeHtml(source.type)}"` : "") +
                      `>`,
              )
              .join("")}${img}</picture>`
        : img;
    return (
        `<li class="dd-article-item${cover ? "" : " dd-article-item--text"}">` +
        `<a class="dd-article-card" href="${escapeHtml(href)}">` +
        image +
        `<span class="dd-article-card-text">` +
        `<span class="dd-article-meta">${articleDates(entry)}</span>` +
        `<h${level} class="dd-article-question">${escapeHtml(entry.question)}</h${level}>` +
        `<span class="dd-article-answer">${escapeHtml(entry.answer)}</span>` +
        `</span></a></li>`
    );
}

/** Where an article page links out: the index, and the other articles to read next. */
interface ArticleLinks {
    indexPath: string;
    more: { entry: ArticleEntry; href: string }[];
}

/**
 * "In this article": a link to each heading, so a long article can be
 * scanned and jumped through. It is a native disclosure, open by default, so
 * a reader can fold it away with no script. Fewer than two headings is not
 * worth a list.
 */
function articleContents(blocks: DocBlock[], facts: FactMap, where: string): string {
    const headings = blocks.filter((block) => block.kind === "heading");
    if (headings.length < 2) return "";
    const items = headings
        .map((h) => `<li><a href="#${escapeHtml(headingId(h))}">${inline(h.text, facts, where)}</a></li>`)
        .join("");
    return (
        `<details class="dd-article-toc" open>` +
        `<summary class="dd-article-toc-title">In this article</summary>` +
        `<ol>${items}</ol></details>`
    );
}

/**
 * An article page shows a reader exactly what an answer engine quotes: the
 * question is the heading and the answer is the opening line, before the date
 * and the body. Read with no stylesheet, the order alone says the same thing.
 *
 * It is set like a long-form essay rather than a manual page: a quiet header,
 * the cover as a wide illustration, the contents, then the writing in one
 * column with figures free to run wider, and more articles at the end.
 */
function articleBody(entry: ArticleEntry, facts: FactMap, sectionHref: SectionHref, links: ArticleLinks): string {
    const { article } = entry;
    const where = `article "${article.id}"`;
    const blocks = article.blocks
        .map((block) => renderBlock(block, facts, where, sectionHref))
        .join("");
    // The cover is the one image the reader sees first, so it loads eagerly.
    const cover = article.cover
        ? renderBlock({ kind: "image", ...article.cover, loading: "eager", fetchPriority: "high" }, facts, where, sectionHref)
        : "";
    const more = links.more.length
        ? `<section class="dd-article-more" aria-labelledby="dd-article-more-title">` +
          `<div class="dd-article-more-head">` +
          `<h2 class="dd-article-more-title" id="dd-article-more-title">More articles</h2>` +
          `<a class="dd-article-all" href="${escapeHtml(links.indexPath)}">All articles</a>` +
          `</div>` +
          `<ol class="dd-articles dd-articles--more">` +
          links.more.map(({ entry: other, href }) => articleCard(other, href, 3)).join("") +
          `</ol></section>`
        : `<nav class="dd-article-more" aria-label="More articles">` +
          `<a class="dd-article-all" href="${escapeHtml(links.indexPath)}">All articles</a></nav>`;
    return (
        `<div class="dd-article" id="${escapeHtml(article.id)}">` +
        `<header class="dd-article-head">` +
        `<p class="dd-article-crumbs"><a href="${escapeHtml(links.indexPath)}">Articles</a></p>` +
        `<h1 class="dd-article-question">${inline(article.question, facts, where, sectionHref)}</h1>` +
        `<p class="dd-article-lede">${inline(article.answer, facts, where, sectionHref)}</p>` +
        articleByline(entry) +
        `</header>` +
        (cover ? `<div class="dd-article-cover">${cover}</div>` : "") +
        `<div class="dd-article-body">` +
        articleContents(article.blocks, facts, where) +
        blocks +
        `</div>` +
        more +
        `</div>`
    );
}

/**
 * An RSS 2.0 feed of every article, newest first. Each item is dated by its
 * publication; the channel carries no build date (DEC-19).
 */
function rssFeed(
    feed: { url: string; title: string },
    indexUrl: string,
    entries: ArticleEntry[],
): string {
    const esc = escapeHtml;
    const items = entries
        .map(({ article, url, answer }) =>
            `<item>\n` +
            `<title>${esc(article.title)}</title>\n` +
            `<link>${esc(url)}</link>\n` +
            `<guid isPermaLink="true">${esc(url)}</guid>\n` +
            `<pubDate>${new Date(`${article.published}T00:00:00Z`).toUTCString()}</pubDate>\n` +
            `<description>${esc(answer)}</description>\n` +
            `</item>\n`,
        )
        .join("");
    return (
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
        `<channel>\n` +
        `<title>${esc(feed.title)}</title>\n` +
        `<link>${esc(indexUrl)}</link>\n` +
        `<description>${esc(feed.title)}, newest first.</description>\n` +
        `<atom:link href="${esc(feed.url)}" rel="self" type="application/rss+xml"/>\n` +
        items +
        `</channel>\n</rss>\n`
    );
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
        articleType = "TechArticle",
        indexType = "CollectionPage",
        siteType = "WebSite",
        now = new Date(),
        robots = {},
        indexing = "index",
    } = options;

    const basePath = trimSlashes(options.basePath ?? docs.basePath ?? "docs");
    /** The base as a path prefix: empty at the site root, so no URL gains a double slash. */
    const prefix = basePath ? `${basePath}/` : "";
    const origin = docs.entity.url.replace(/\/+$/, "");
    const entityId = `${origin}/#entity`;
    const indexUrl = `${origin}/${prefix}`;
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
    const indexPath = `${homePath}${prefix}`;
    /** A section's in-site path, for links a reader follows. */
    const pathFor = (id: string) => `${homePath}${prefix}${id}/`;
    /** The one canonical URL a section owns (DEC-04). */
    const urlFor = (id: string) => `${origin}/${prefix}${id}/`;
    /**
     * The build date. It dates only the generated data files, which really
     * were generated now; a page's dates come from its author (DEC-19).
     */
    const generated = now.toISOString().slice(0, 10);
    const facts = docs.facts;

    const all = flatten(docs.sections);
    const entries = all.map(({ section }) => ({
        id: section.id,
        title: section.title,
        url: urlFor(section.id),
        question: plain(section.question, facts, `section "${section.id}"`),
        answer: plain(section.answer, facts, `section "${section.id}"`),
        modified: section.updated ?? section.published,
    }));
    /** The index changes when any page does, so it carries the newest page date. */
    const newest = entries
        .map((e) => e.modified)
        .filter((date): date is string => date !== undefined)
        .sort()
        .at(-1);

    /* --- chrome (DEC-07) ------------------------------------------------
       The bar and rail are derived, never configured: the site root comes from
       the entity's own URL, the labels from its name and the document title,
       and the rail from the section tree. A consumer rebuilds and has chrome. */

    const bar =
        `<div class="dd-bar">` +
        (basePath
            ? `<a class="dd-back" href="${escapeHtml(homePath)}">` +
              `${BACK_ARROW}${escapeHtml(docs.entity.name)}</a>` +
              `<span class="dd-bar-page">${escapeHtml(docs.title)}</span>`
            : `<a class="dd-bar-page" href="${escapeHtml(homePath)}">${escapeHtml(docs.entity.name)}</a>`) +
        `</div>`;

    /** One rail link, marked when it is the page being read. */
    const navLink = (s: DocPage, currentId?: string): string =>
        `<a class="dd-nav-link${s.id === currentId ? " is-active" : ""}"` +
        ` href="${escapeHtml(pathFor(s.id))}"` +
        (s.id === currentId ? ` aria-current="page"` : "") +
        `>${escapeHtml(s.title)}</a>`;

    /** Native disclosures work without script; a landing links the chapter label. */
    const railItem = (s: DocSection, currentId?: string): string =>
        isGroup(s)
            ? `<li><details class="dd-nav-group" open>` +
              `<summary>${icon("chevron-right")}${s.landing ? navLink({ ...s.landing, title: s.title }, currentId) : escapeHtml(s.title)}</summary>` +
              `<ul class="dd-nav-list">` +
              s.children.map((child) => railItem(child, currentId)).join("") +
              `</ul></details></li>`
            : `<li>${navLink(s, currentId)}</li>`;

    /** The whole rail; `currentId` is absent on the index, which is nobody's section. */
    const railFor = (currentId?: string): string =>
        `<nav class="dd-nav" aria-label="Contents">` +
        `<p class="dd-nav-label">Contents</p>` +
        (options.search !== true ? "" : renderSearch(createSearchIndex(docs, pathFor)) + `<script src="${escapeHtml(indexPath)}search.js" defer></script>`) +
        `<ul class="dd-nav-list">` +
        docs.sections.map((s) => railItem(s, currentId)).join("") +
        `</ul></nav>`;

    const out: Record<string, string> = {};
    // Native fragment navigation remains available without this enhancement.
    out[`${prefix}skip.js`] = `document.querySelector('.dd-skip').addEventListener('click', function(event) { event.preventDefault(); document.getElementById(this.hash.slice(1)).focus(); });`;
    if (options.search === true) out[`${prefix}search.js`] = searchScript();
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
    /** Section references in prose lead to that section's own page. */
    const links = { sectionHref: pathFor };
    const indexBody = renderLead(docs, links) + renderBody(docs, links);
    const indexNote = noteText
        ? `<p class="dd-fullnote">${fill(noteText.index, {
              title: escapeHtml(docs.title),
              words: roundWords(indexBody),
          })}</p>`
        : "";

    /* --- index --------------------------------------------------------- */

    out[`${prefix}index.html`] = page({
        title: docs.title,
        description: plain(docs.lead, facts, "the document lead"),
        canonical: indexUrl,
        entity: docs.entity,
        stylesheet: options.stylesheet,
        indexing,
        chrome: { bar, rail: railFor() },
        skipScriptPath: `${indexPath}skip.js`,
        body: renderLead(docs, links) + indexNote + renderBody(docs, links),
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
        const chapter = pagesOf(docs.sections)[index]!.ancestors.map((group) => group.title).join(" / ");
        const context = `<p class="dd-reading-context">${chapter ? `${escapeHtml(chapter)} / ` : ""}Page ${index + 1} of ${all.length}</p>` +
            `<progress class="dd-progress" value="${index + 1}" max="${all.length}" aria-label="Manual reading progress"></progress>`;
        const prev = all[index - 1]?.section;
        const next = all[index + 1]?.section;

        const destination = (direction: "prev" | "next", page: DocPage) =>
            `<a rel="${direction}" href="${escapeHtml(pathFor(page.id))}">` +
            `<span class="dd-pager-label">${icon(direction === "prev" ? "arrow-left" : "arrow-right")}` +
            `${direction === "prev" ? "Previous" : "Next"}</span>` +
            `<span class="dd-pager-title">${escapeHtml(page.title)}</span></a>`;
        const nav =
            `<nav class="dd-pager" aria-label="Continue reading">` +
            (prev ? destination("prev", prev) : "") +
            `<a class="dd-pager-all" href="${escapeHtml(indexPath)}">Complete manual (one page)</a>` +
            (next ? destination("next", next) : "") +
            `</nav>`;

        // Only chapters with a real landing destination become breadcrumbs.
        const crumbs = [
            { name: docs.title, item: indexUrl },
            ...pagesOf(docs.sections)[index]!.ancestors
                .filter((group) => group.landing && group.landing.id !== section.id)
                .map((group) => ({ name: group.title, item: urlFor(group.landing!.id) })),
            { name: section.title, item: url },
        ];

        out[`${prefix}${section.id}/index.html`] = page({
            title: `${section.title} - ${docs.entity.name}`,
            description: entry.answer,
            canonical: url,
            entity: docs.entity,
            stylesheet: options.stylesheet,
            indexing,
            chrome: { bar, rail: railFor(section.id) },
            skipScriptPath: `${indexPath}skip.js`,
            section: true,
            whole: { url: indexUrl, title: `${docs.title}, complete on one page` },
            // The section is the page, so its title is the page's one h1 — the
            // heading a text extractor takes as the topic.
            body: context + sectionNote + renderSection(section, facts, { headingLevel: 1, ...links }) + nav,
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
                        ...(section.published ? { datePublished: section.published } : {}),
                        ...(entry.modified ? { dateModified: entry.modified } : {}),
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

    /* --- articles (DEC-18) ----------------------------------------------
       Dated answer pages at the site root's /articles/, beside the manual
       rather than inside it: no rail, no pager, no reading order. A build
       without articles emits nothing here and is byte-identical to before. */

    const articleEntries = articleEntriesOf(docs, origin);
    if (articleEntries.length) {
        const articlesIndexUrl = `${origin}/${ARTICLES_DIR}/`;
        const articlesIndexPath = `${homePath}${ARTICLES_DIR}/`;
        const feedUrl = `${articlesIndexUrl}feed.xml`;
        const feed = { url: feedUrl, title: `${docs.entity.name} articles` };
        const articlesBar =
            `<div class="dd-bar">` +
            `<a class="dd-back" href="${escapeHtml(homePath)}">` +
            `${BACK_ARROW}${escapeHtml(docs.entity.name)}</a>` +
            `<span class="dd-bar-page">Articles</span>` +
            `</div>`;
        const write = (path: string, contents: string) => {
            // A section or base path named "articles" would be silently overwritten.
            if (path in out) {
                throw new Error(`dopedocs: articles would overwrite "${path}"; rename the section or base path that uses it.`);
            }
            out[path] = contents;
        };

        for (const entry of articleEntries) {
            const { article, url } = entry;
            const crumbs = [
                { name: "Articles", item: articlesIndexUrl },
                { name: article.title, item: url },
            ];
            write(`${ARTICLES_DIR}/${article.id}/index.html`, page({
                title: `${article.title} - ${docs.entity.name}`,
                description: entry.answer,
                canonical: url,
                entity: docs.entity,
                stylesheet: options.stylesheet,
                indexing,
                feed,
                chrome: { bar: articlesBar, rail: "" },
                skipScriptPath: `${indexPath}skip.js`,
                section: true,
                article: true,
                body: articleBody(entry, facts, pathFor, {
                    indexPath: articlesIndexPath,
                    // The newest others: the index's order, not a guess at relevance (DEC-18).
                    more: articleEntries
                        .filter((other) => other !== entry)
                        .slice(0, 3)
                        .map((other) => ({ entry: other, href: `${articlesIndexPath}${other.article.id}/` })),
                }),
                graph: {
                    "@context": "https://schema.org",
                    "@graph": [
                        entityJson,
                        {
                            "@type": "Article",
                            "@id": `${url}#article`,
                            url,
                            headline: article.title,
                            description: entry.answer,
                            datePublished: article.published,
                            dateModified: entry.modified,
                            ...(article.author ? { author: { "@type": "Person", name: article.author } } : {}),
                            ...(article.cover ? { image: absoluteSrc(article.cover.src, origin) } : {}),
                            about: { "@id": entityId },
                            publisher: { "@id": entityId },
                            isPartOf: { "@id": `${articlesIndexUrl}#page` },
                            ...(article.keywords?.length
                                ? { keywords: article.keywords.join(", ") }
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
            }));
        }

        const list = articleEntries
            .map((entry) => articleCard(entry, `${articlesIndexPath}${entry.article.id}/`))
            .join("");
        write(`${ARTICLES_DIR}/index.html`, page({
            title: `Articles - ${docs.entity.name}`,
            description: `Articles from ${docs.entity.name}, newest first.`,
            canonical: articlesIndexUrl,
            entity: docs.entity,
            stylesheet: options.stylesheet,
            indexing,
            feed,
            chrome: { bar: articlesBar, rail: "" },
            skipScriptPath: `${indexPath}skip.js`,
            article: true,
            body:
                `<header class="dd-articles-head"><h1 class="dd-title">Articles</h1>` +
                (docs.entity.tagline ? `<p class="dd-lead">${escapeHtml(docs.entity.tagline)}</p>` : "") +
                `</header><ol class="dd-articles dd-articles--index">${list}</ol>`,
            graph: {
                "@context": "https://schema.org",
                "@graph": [
                    entityJson,
                    {
                        "@type": "CollectionPage",
                        "@id": `${articlesIndexUrl}#page`,
                        url: articlesIndexUrl,
                        name: `${docs.entity.name} articles`,
                        about: { "@id": entityId },
                        mainEntity: {
                            "@type": "ItemList",
                            itemListOrder: "https://schema.org/ItemListOrderDescending",
                            itemListElement: articleEntries.map((entry, i) => ({
                                "@type": "ListItem",
                                position: i + 1,
                                url: entry.url,
                                name: entry.article.title,
                            })),
                        },
                    },
                ],
            },
        }));

        write(`${ARTICLES_DIR}/feed.xml`, rssFeed(feed, articlesIndexUrl, articleEntries));
    }

    /* --- sitemap -------------------------------------------------------- */

    out["sitemap.xml"] =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        [
            { url: indexUrl, modified: newest },
            ...entries,
            ...(articleEntries.length
                ? [{ url: `${origin}/${ARTICLES_DIR}/`, modified: articleEntries.map((e) => e.modified).sort().at(-1) }]
                : []),
            ...articleEntries,
        ]
            .map(
                ({ url, modified }) =>
                    `  <url>\n    <loc>${escapeHtml(url)}</loc>\n` +
                    (modified ? `    <lastmod>${modified}</lastmod>\n` : "") +
                    `  </url>`,
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
        `User-agent: *\nAllow: /\n` +
        // A sitemap of pages marked noindex invites the crawl the policy refuses.
        (indexing === "noindex" ? "" : `\nSitemap: ${origin}/sitemap.xml\n`);

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
        (articleEntries.length
            ? `\n## Articles\n\n` +
              articleEntries
                  .map((e) =>
                      `### ${e.article.title}\n\n${e.question}\n\n${e.answer}\n\n` +
                      `Published ${e.article.published}` +
                      (e.article.updated ? `, updated ${e.article.updated}` : "") +
                      `\n\n${e.url}\n`,
                  )
                  .join("\n")
            : "") +
        "\n";

    /* --- questions.json ------------------------------------------------- */

    out["questions.json"] =
        JSON.stringify(
            {
                entity: docs.entity.name,
                generated,
                questions: [
                    ...entries.map((e) => ({
                        id: e.id,
                        question: e.question,
                        answer: e.answer,
                        url: e.url,
                    })),
                    ...articleEntries.map((e) => ({
                        id: e.article.id,
                        question: e.question,
                        answer: e.answer,
                        url: e.url,
                        published: e.article.published,
                        ...(e.article.updated ? { updated: e.article.updated } : {}),
                    })),
                ],
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
                generated,
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

    if (docs.api) out["api-samples.json"] = JSON.stringify(generateApiSamples(docs.api), null, 2) + "\n";
    return out;
}
