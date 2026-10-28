/**
 * The authoring surface.
 *
 * Documentation is a TypeScript value, not a markup dialect. dopedocs
 * ships no parser, so `tsc` is the only front end and a malformed document
 * fails at the author's keyboard rather than in a reader's browser.
 *
 * `question` and `answer` are required on every section, because the
 * annotation that makes documentation answerable cannot be the part that is
 * easiest to skip.
 */

import { validateApi } from "./api.js";
import type { ApiMethod } from "./api.js";
import { plainText } from "./inline.js";
import type { FactMap } from "./facts.js";
import { referencedFacts } from "./facts.js";
import { linkTarget, referencedLinks } from "./links.js";

/* ── Blocks ──────────────────────────────────────────────────────────────── */

/**
 * One renderable unit. A discriminated union rather than open markup: the
 * renderer switches exhaustively over `kind`, so adding a variant here is a
 * compile error everywhere that must learn to draw it.
 *
 * Prose fields carry three inline marks — `code`, **strong** and
 * `[text](href)` — plus `{fact:key}` references. A link's href is an absolute
 * URL, a `mailto:`, or another section as `#id` or `section:id`. Anything richer becomes a new block kind; it never
 * becomes new syntax.
 */
export interface DocImage {
    src: string;
    /** A comma-separated responsive candidate list for the fallback image. */
    srcset?: string;
    /** The rendered slot size paired with `srcset`. */
    sizes?: string;
    /** Art-directed sources, evaluated in order before the fallback image. */
    sources?: { srcset: string; media?: string; type?: string }[];
    /** What the image says, for a reader who cannot see it. */
    alt: string;
    caption?: string;
    /** Rendered as attributes when given, so the page does not reflow. */
    width?: number;
    height?: number;
    loading?: "lazy" | "eager";
    fetchPriority?: "high" | "low" | "auto";
    position?: "center" | "top" | "bottom" | "left" | "right";
    /** Makes the image a link to a larger or original rendition. */
    href?: string;
    /** A drawing or diagram rather than a screenshot: shown without a frame. */
    drawing?: boolean;
}

/** Semantic highlighting data produced by the optional build-time adapter. */
export const CODE_TONES = ["keyword", "string", "number", "comment", "function", "type", "punctuation"] as const;
export type CodeTone = (typeof CODE_TONES)[number];
export interface CodeToken { text: string; tone?: CodeTone; }

export type DocBlock =
    | { kind: "code"; code: string; language?: string; caption?: string; tokens?: CodeToken[] }
    | { kind: "p"; text: string }
    | {
          kind: "heading";
          /** A subheading inside a page. Articles list them as "In this article". */
          text: string;
          /** The anchor. Defaults to a slug of the text. */
          id?: string;
      }
    | { kind: "list"; items: string[]; ordered?: boolean }
    | { kind: "callout"; text: string; tone?: "note" | "warn" }
    | {
          kind: "steps";
          /** Ordered instructions. Titles make the sequence scannable. */
          items: { title: string; text: string }[];
      }
    | {
          kind: "checklist";
          /** A static readiness or completion list, not application state. */
          items: { text: string; checked?: boolean }[];
      }
    | {
          kind: "details";
          summary: string;
          text: string;
          /** Native disclosure state; remains usable without JavaScript. */
          open?: boolean;
      }
    | {
          kind: "cards";
          /** Cards with an href render as links; the others are articles. */
          items: { title: string; text: string; href?: string; label?: string }[];
      }
    | {
          kind: "quote";
          text: string;
          attribution?: string;
          /** Optional source URL, applied to the semantic blockquote. */
          cite?: string;
      }
    | {
          kind: "metrics";
          items: { value: string; label: string; detail?: string }[];
      }
    | {
          kind: "compare";
          before: { title: string; text: string };
          after: { title: string; text: string };
      }
    | { kind: "keys"; rows: [keys: string, does: string][] }
    | { kind: "table"; head: string[]; rows: string[][] }
    | {
          kind: "facts";
          title?: string;
          /** A brandmark for the card: inline SVG, or the URL of an image. */
          mark?: string;
          /**
           * Where the card's subject lives on the web. The head (mark and
           * title) becomes a link there and shows the address; an absolute
           * http(s) URL opens in a new tab so an in-app reader keeps their place.
           */
          href?: string;
          rows: [label: string, value: string][];
      }
    | ({
          kind: "image";
          /** In an article, the figure spans wider than the text, for a diagram that needs room. */
          wide?: boolean;
      } & DocImage)
    | {
          kind: "gallery";
          images: DocImage[];
          columns?: 2 | 3;
          /** Optional accessible name for the group of figures. */
          label?: string;
      }
    | {
          kind: "video";
          src: string;
          /** A still shown before playback starts. */
          poster?: string;
          caption?: string;
      };

/* ── Sections ────────────────────────────────────────────────────────────── */

/**
 * One page: a nav entry, a body, and the annotation that lets a machine quote
 * it. Pages are the only things with content and the only things with URLs.
 *
 * DEC-02: `question` and `answer` are required, so an unannotated page does
 * not compile.
 */
export interface DocPage {
    /** URL slug and anchor. Public per DEC-04 — renaming one breaks links. */
    id: string;
    /** Nav label. A noun phrase, not a sentence. */
    title: string;
    /** The natural-language query a person or a model actually asks. */
    question: string;
    /**
     * One or two sentences that answer `question` completely, standing alone
     * with no surrounding context — this is what gets quoted.
     */
    answer: string;
    /** Optional retrieval vocabulary; never rendered as prose. */
    keywords?: string[];
    /**
     * When the page was first published, as ISO `YYYY-MM-DD`. Machine-readable
     * dates come only from here and `updated`; an undated page claims none
     * (DEC-19).
     */
    published?: string;
    /** When the page's content last changed, as ISO `YYYY-MM-DD`. */
    updated?: string;
    blocks: DocBlock[];
}

/**
 * A dated, standalone answer page published at `/articles/<id>/`, outside the
 * manual's reading order (DEC-18). It is a page in every other respect: the
 * same question, quotable answer, blocks and facts.
 */
export interface DocArticle extends DocPage {
    /** Required: an article is found one at a time, and its date is part of the answer. */
    published: string;
    /** Who wrote it, shown as a byline and named in its structured data. */
    author?: string;
    /** The picture an article leads with, also its card image on the index. */
    cover?: DocImage;
}

/**
 * A chapter: a labelled, collapsible bucket of pages and nothing else.
 *
 * A group has no body, no answer and no page of its own. Anything a chapter
 * would say belongs on one of its pages, so a reader never has to read a
 * chapter "in concert" with the pages beneath it to get the whole story. The
 * rail folds it; its id keys the fold and is never a URL.
 */
export interface DocGroup {
    /** A slug identifying the group. Not a URL: groups have no page. */
    id: string;
    /** The chapter's label in the rail. */
    title: string;
    /** Up to three nested groups; canonical URLs still belong only to pages. */
    children: DocSection[];
}

/** An entry at the top of the contents: a page, or a group of pages. */
export type DocSection = DocPage | DocGroup;

/** True for a chapter bucket rather than a page. */
export const isGroup = (section: DocSection): section is DocGroup =>
    Array.isArray((section as DocGroup).children);

/** Every page in reading order, with its closest group and full chapter path. */
export function pagesOf(sections: DocSection[]): { page: DocPage; group?: DocGroup; ancestors: DocGroup[] }[] {
    const result: { page: DocPage; group?: DocGroup; ancestors: DocGroup[] }[] = [];
    function visit(items: DocSection[], ancestors: DocGroup[]): void {
        for (const item of items) {
            if (isGroup(item)) {
                if (ancestors.length < 4) visit(item.children, [...ancestors, item]);
            } else result.push({ page: item, group: ancestors.at(-1), ancestors });
        }
    }
    visit(sections, []);
    return result;
}

/* ── The entity ──────────────────────────────────────────────────────────── */

/**
 * Who publishes this. A name collision is the ordinary way an answer engine
 * gets a product wrong, so `notToBeConfusedWith` is required input rather than
 * an optimisation.
 */
export interface SiteEntity {
    name: string;
    url: string;
    /** Registered legal name, when it differs from the trading name. */
    legalName?: string;
    tagline?: string;
    logo?: string;
    /** Products or companies a reader could mistake this for. */
    notToBeConfusedWith: string[];
    /** Authoritative profiles elsewhere, for `sameAs`. */
    sameAs?: string[];
    contactEmail?: string;
    /**
     * Extra schema.org properties merged into the entity node as written —
     * `telephone`, `address`, `areaServed`, `openingHours`, whatever your kind
     * of entity needs.
     *
     * This is the one escape hatch from the typed model, and its cost is
     * plain: a misspelt property or a wrongly shaped value is not caught here,
     * because dopedocs does not model or validate schema.org. It guarantees
     * the fields above; this carries the vocabulary your entity happens to
     * need. A key dopedocs already owns (see `RESERVED_ENTITY_PROPERTIES`) is
     * refused at build time rather than silently overriding or being dropped.
     */
    schemaProperties?: Record<string, JsonValue>;
}

/** A value that survives JSON serialisation unchanged. */
export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

/**
 * Entity properties dopedocs writes itself, mapped to the field that sets
 * each one. `schemaProperties` may not set them, so the guarantees behind
 * them — the stable id, the generated disambiguation — cannot be overwritten
 * by accident. Any `@`-prefixed key is reserved too.
 */
export const RESERVED_ENTITY_PROPERTIES: Readonly<Record<string, string>> = {
    name: "entity.name",
    url: "entity.url",
    legalName: "entity.legalName",
    description: "entity.tagline",
    logo: "entity.logo",
    sameAs: "entity.sameAs",
    email: "entity.contactEmail",
    disambiguatingDescription: "entity.notToBeConfusedWith",
    softwareVersion: "identity.version",
};

/**
 * The field that owns an entity property, or `undefined` when the property is
 * free for `schemaProperties`. An own-key lookup, so `constructor` and the
 * other prototype names are not mistaken for reserved ones.
 */
export const reservedEntityProperty = (key: string): string | undefined =>
    Object.prototype.hasOwnProperty.call(RESERVED_ENTITY_PROPERTIES, key)
        ? RESERVED_ENTITY_PROPERTIES[key]
        : undefined;

/**
 * What the documentation is documentation *for*: the product, its version, and
 * who makes it. Optional — omit it and nothing renders.
 */
export interface DocIdentity {
    name: string;
    version?: string;
    /** Release channel, e.g. "Preview", "Beta". */
    channel?: string;
    /** Who makes it, optionally linking to the section that explains them. */
    maker?: { name: string; href?: string };
    /**
     * A brandmark: either the URL of an image file, or raw inline SVG.
     *
     * A URL — `.png`, `.jpg`, `.webp`, `.svg` — is the form that always works,
     * because it needs no stylesheet.
     *
     * Inline SVG must be **self-contained**: give it presentation attributes or
     * `currentColor`, never class names styled from your app's CSS. The static
     * page links dopedocs' stylesheet, not your bundle, so a mark drawn by your
     * own classes silently falls back to SVG's defaults there — a `<circle>`
     * meant as a ring renders as a filled disc, with no error to warn you.
     *
     * Inline SVG is the one value rendered without escaping, because it is
     * markup. It is trusted author input from the content module — never put
     * user input here.
     */
    mark?: string;
}

/* ── Optional API reference (DEC-01: typed author data, never a markup parser) ── */

/** A typed request parameter. Examples are JSON values; absent optional examples are omitted from samples. */
export interface ApiParameter {
    name: string;
    type: "string" | "number" | "integer" | "boolean" | "object" | "array";
    required: boolean;
    location: "path" | "query" | "header" | "body";
    description: string;
    example?: JsonValue;
}
/** A documented example response; its body is already JSON data. */
export interface ApiResponse { status: number; description?: string; body: JsonValue; }
/** An endpoint links to a real guide page without replacing its required question/answer (DEC-02). */
export interface ApiEndpoint {
    id: string;
    method: ApiMethod;
    path: string;
    title: string;
    description: string;
    parameters?: ApiParameter[];
    exampleResponse: ApiResponse;
    /** A DocPage id, not a group id or external URL. */
    guide?: string;
}
/** A named group of endpoints; ids are unique across API groups and endpoints. */
export interface ApiResourceGroup { id: string; title: string; description?: string; endpoints: ApiEndpoint[]; }
/** One row in the shared API error table. */
export interface ApiError { status: number; code?: string; description: string; }
/** Optional reference data; existing documentation needs no API section or consumer migration. */
export interface DocApi {
    baseUrl: string;
    authentication?: string;
    groups: ApiResourceGroup[];
    errors?: ApiError[];
}

/* ── The document ────────────────────────────────────────────────────────── */

/** A whole documentation set: who publishes it, what it claims, what it says. */
export interface DocSet<F extends FactMap = FactMap> {
    entity: SiteEntity;
    /** Optional release card shown above the title. */
    identity?: DocIdentity;
    /** Where the docs are served. Defaults to `/docs` at render time. */
    basePath?: string;
    title: string;
    lead: string;
    facts: F;
    sections: DocSection[];
    /** Dated answer pages outside the manual, published at `/articles/` (DEC-18). */
    articles?: DocArticle[];
    /** Optional API metadata and build-time request samples; guide annotation stays unchanged. */
    api?: DocApi;
}

/**
 * Declares a documentation set, preserving literal fact keys for reference checking.
 *
 * DEC-01: the document is a TypeScript value; dopedocs ships no parser.
 */
export function defineDocs<const F extends FactMap>(docs: DocSet<F>): DocSet<F> {
    return docs;
}

/* ── Validation ──────────────────────────────────────────────────────────── */

/**
 * The closed set of problems `validate` reports. Callers branch on the code
 * rather than on message text, so wording can change without breaking them.
 */
export type FindingCode =
    | "duplicate-section-id"
    | "invalid-section-id"
    | "empty-question"
    | "empty-answer"
    | "answer-opens-with-pronoun"
    | "answer-too-long"
    | "nesting-too-deep"
    | "empty-group"
    | "group-with-content"
    | "unknown-fact-reference"
    | "invalid-review-date"
    | "invalid-page-date"
    | "updated-before-published"
    | "article-without-date"
    | "stale-fact"
    | "empty-image-alt"
    | "invalid-image-dimensions"
    | "table-row-width"
    | "reserved-schema-property"
    | "unknown-section-link"
    | "unsupported-link"
    | "duplicate-api-id"
    | "invalid-api-id"
    | "unknown-api-method"
    | "unknown-api-guide"
    | "invalid-api-parameter"
    | "invalid-api-url"
    | "invalid-api-response";

/**
 * One problem found in a document. Findings are returned, never thrown: the
 * caller decides what is fatal, because a stale review date should stop a
 * release without stopping a developer's dev server.
 */
export interface Finding {
    code: FindingCode;
    severity: "fatal" | "warning";
    message: string;
    sectionId?: string;
    factKey?: string;
    endpointId?: string;
}

/** Tuning for a `validate` run; every field has a working default. */
export interface ValidateOptions {
    /** A fact reviewed longer ago than this is reported stale. Default 365. */
    staleAfterDays?: number;
    /** Injected for deterministic tests. Defaults to now. */
    today?: Date;
}

/** The longest answer that still reads as a quotable snippet. */
export const MAX_ANSWER_LENGTH = 320;

/** A slug: lowercase words joined by single hyphens. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Openers that point at something outside the answer. An answer beginning with
 * one of these is not self-contained, so a machine quoting it produces a
 * sentence about an unnamed subject.
 */
const OUTWARD_OPENERS = new Set([
    "it",
    "this",
    "that",
    "these",
    "those",
    "they",
    "them",
    "he",
    "she",
    "there",
    "here",
    "such",
]);

const firstWord = (text: string): string =>
    (text.trim().match(/^[a-zA-Z]+/)?.[0] ?? "").toLowerCase();

const DAY_MS = 86_400_000;

/** True for an ISO `YYYY-MM-DD` string naming a real calendar day. */
function isCalendarDate(value: string): boolean {
    const time = Date.parse(`${value}T00:00:00Z`);
    return ISO_DATE.test(value) && Number.isFinite(time) &&
        new Date(time).toISOString().slice(0, 10) === value;
}

/**
 * Walks a section tree in reading order, reporting each entry's depth. Typed
 * loosely on purpose: `validate` must report a malformed document (excessive
 * nesting, a page with children) that the types would reject, because
 * documents also arrive from plain JavaScript.
 */
function* walk(
    sections: readonly unknown[],
    depth = 0,
): Generator<{ section: DocSection; depth: number }> {
    for (const section of sections as DocSection[]) {
        yield { section, depth };
        const children = (section as { children?: unknown }).children;
        if (Array.isArray(children) && depth < 4) yield* walk(children, depth + 1);
    }
}

/** Every string in a block that inline marks and fact references apply to. */
function proseOf(block: DocBlock): string[] {
    switch (block.kind) {
        case "p":
        case "heading":
            return [block.text];
        case "list":
            return block.items;
        case "callout":
            return [block.text];
        case "steps":
            return block.items.flatMap(({ title, text }) => [title, text]);
        case "checklist":
            return block.items.map(({ text }) => text);
        case "details":
            return [block.summary, block.text];
        case "cards":
            return block.items.flatMap(({ title, text, label }) => [
                title,
                text,
                ...(label ? [label] : []),
            ]);
        case "quote":
            return [block.text, ...(block.attribution ? [block.attribution] : [])];
        case "metrics":
            return block.items.flatMap(({ value, label, detail }) => [
                value,
                label,
                ...(detail ? [detail] : []),
            ]);
        case "compare":
            return [
                block.before.title,
                block.before.text,
                block.after.title,
                block.after.text,
            ];
        case "keys":
            return block.rows.flat();
        case "table":
            return [...block.head, ...block.rows.flat()];
        case "facts":
            return [...(block.title ? [block.title] : []), ...block.rows.flat()];
        // `alt` is deliberately absent: it renders into an attribute, where a
        // <code> element from an inline mark would be markup in a text slot.
        case "code":
        case "image":
            return block.caption ? [block.caption] : [];
        case "gallery":
            return block.images.flatMap((image) =>
                image.caption ? [image.caption] : [],
            );
        case "video":
            return block.caption ? [block.caption] : [];
    }
}

/**
 * Checks a document against the rules the ADRs make binding, plus the freshness
 * of its facts. Returns every finding rather than stopping at the first, so an
 * author fixes a document in one pass.
 */
export function validate(docs: DocSet, options: ValidateOptions = {}): Finding[] {
    const { staleAfterDays = 365, today = new Date() } = options;
    const findings: Finding[] = [];
    const seen = new Set<string>();
    const factKeys = new Set(Object.keys(docs.facts));
    // Only pages can be linked to: a group has no anchor and no page.
    const pageIds = new Set(pagesOf(docs.sections).map(({ page }) => page.id));

    /** Reports each link in `text` that leads nowhere, or somewhere it must not. */
    const checkLinks = (text: string, where: string, sectionId?: string) => {
        for (const { href } of referencedLinks(text)) {
            const target = linkTarget(href);
            if (!target) {
                findings.push({
                    code: "unsupported-link",
                    severity: "fatal",
                    sectionId,
                    message: `${where} links to "${href}"; a link must be an http(s) URL, a mailto:, or a section as #id or section:id.`,
                });
            } else if (target.kind === "section" && !pageIds.has(target.id)) {
                findings.push({
                    code: "unknown-section-link",
                    severity: "fatal",
                    sectionId,
                    message: `${where} links to the section "${target.id}", which does not exist.`,
                });
            }
        }
    };
    checkLinks(docs.lead, "The document lead");

    // DEC-18: an article is checked by every page rule below. Ids stay unique
    // across both, so no id means two different pages.
    const articles = (docs.articles ?? []).map((section) => ({ section, depth: 0 }));
    for (const { section } of articles) {
        if (section.cover && !section.cover.alt.trim()) {
            findings.push({
                code: "empty-image-alt",
                severity: "fatal",
                sectionId: section.id,
                message: `The cover of article "${section.id}" has a blank alt; say what it shows.`,
            });
        }
        if (!section.published) {
            findings.push({
                code: "article-without-date",
                severity: "fatal",
                sectionId: section.id,
                message: `Article "${section.id}" has no published date; an article's date is part of its answer.`,
            });
        }
    }

    for (const { section, depth } of [...walk(docs.sections), ...articles]) {
        const { id } = section;

        if (seen.has(id)) {
            findings.push({
                code: "duplicate-section-id",
                severity: "fatal",
                sectionId: id,
                message: `Two sections share the id "${id}"; ids are URLs, so they must be unique.`,
            });
        }
        seen.add(id);

        if (!SLUG.test(id)) {
            findings.push({
                code: "invalid-section-id",
                severity: "fatal",
                sectionId: id,
                message: `Section id "${id}" is not a URL-safe slug (lowercase words joined by hyphens).`,
            });
        }

        if (depth > 3 || (depth === 3 && isGroup(section))) {
            findings.push({
                code: "nesting-too-deep",
                severity: "fatal",
                sectionId: id,
                message: `Section "${id}" is nested too deep; at most three nested groups are supported.`,
            });
        }

        if (isGroup(section)) {
            if (section.children.length === 0) {
                findings.push({
                    code: "empty-group",
                    severity: "fatal",
                    sectionId: id,
                    message: `Group "${id}" has no pages; a chapter with nothing in it is a dead end in the rail.`,
                });
            }
            const extra = ["question", "answer", "blocks"].filter((key) => key in section);
            if (extra.length) {
                findings.push({
                    code: "group-with-content",
                    severity: "fatal",
                    sectionId: id,
                    message: `Group "${id}" carries ${extra.join(", ")}; a group is only a label for its pages. Move that content onto a page inside it.`,
                });
            }
            continue;
        }

        for (const block of section.blocks ?? []) {
            if (block.kind === "table") {
                block.rows.forEach((row, index) => {
                    if (row.length !== block.head.length) {
                        findings.push({
                            code: "table-row-width",
                            severity: "fatal",
                            sectionId: id,
                            message: `Table row ${index + 1} in "${id}" has ${row.length} cells; its head has ${block.head.length}. Every row must match the head's cell count.`,
                        });
                    }
                });
            }
            const images =
                block.kind === "image"
                    ? [block]
                    : block.kind === "gallery"
                      ? block.images
                      : [];
            for (const image of images) {
                if (!image.alt.trim()) {
                    findings.push({
                        code: "empty-image-alt",
                        severity: "fatal",
                        sectionId: id,
                        message: `An image in "${id}" has a blank alt; an unlabelled image is invisible to a screen reader and to an answer engine alike. Say what it shows.`,
                    });
                }
                const invalid = [image.width, image.height].some(
                    (dimension) =>
                        dimension !== undefined &&
                        (!Number.isInteger(dimension) || dimension <= 0),
                );
                if (invalid) {
                    findings.push({
                        code: "invalid-image-dimensions",
                        severity: "fatal",
                        sectionId: id,
                        message: `An image in "${id}" has a non-positive or fractional width or height; image dimensions must be positive whole pixels.`,
                    });
                }
            }
        }

        // DEC-19: these dates are published to machines as-is, so a wrong
        // one is a false claim, not a typo.
        const dates = [["published", section.published], ["updated", section.updated]] as const;
        for (const [field, value] of dates) {
            if (value !== undefined && !isCalendarDate(value)) {
                findings.push({
                    code: "invalid-page-date",
                    severity: "fatal",
                    sectionId: id,
                    message: `Section "${id}" has ${field} date "${value}"; it must be a real ISO YYYY-MM-DD calendar date.`,
                });
            }
        }
        if (section.published && section.updated && section.updated < section.published) {
            findings.push({
                code: "updated-before-published",
                severity: "fatal",
                sectionId: id,
                message: `Section "${id}" was updated on ${section.updated}, before it was published on ${section.published}.`,
            });
        }

        if (!section.question.trim()) {
            findings.push({
                code: "empty-question",
                severity: "fatal",
                sectionId: id,
                message: `Section "${id}" has an empty question; it is the query this section is retrieved for.`,
            });
        }

        // Wait for valid references rather than throwing while collecting
        // findings. The renderer and machine-readable answers use this same
        // plain-text derivation, including mark stripping and fact resolution.
        const answerText = referencedFacts(section.answer).every((key) => factKeys.has(key))
            ? plainText(section.answer, docs.facts, `section "${id}"`)
            : undefined;
        if (answerText !== undefined && !answerText) {
            findings.push({
                code: "empty-answer", severity: "fatal", sectionId: id,
                message: `Section "${id}" has an empty resolved answer; write an answer before publishing this page.`,
            });
        }
        const opener = firstWord(answerText ?? "");
        if (OUTWARD_OPENERS.has(opener)) {
            findings.push({
                code: "answer-opens-with-pronoun",
                severity: "fatal",
                sectionId: id,
                message: `The answer for "${id}" opens with "${opener}", which points outside itself; quoted alone it describes an unnamed subject. Name the subject.`,
            });
        }

        if (answerText !== undefined && answerText.length > MAX_ANSWER_LENGTH) {
            findings.push({
                code: "answer-too-long",
                severity: "fatal",
                sectionId: id,
                message: `The answer for "${id}" is ${answerText.length} characters; over ${MAX_ANSWER_LENGTH} it stops being a quotable snippet. Move the detail into blocks.`,
            });
        }

        const prose = [
            section.question,
            section.answer,
            ...section.blocks.flatMap(proseOf),
        ];
        for (const text of prose) {
            checkLinks(text, `Section "${id}"`, id);
            for (const key of referencedFacts(text)) {
                if (factKeys.has(key)) continue;
                findings.push({
                    code: "unknown-fact-reference",
                    severity: "fatal",
                    sectionId: id,
                    factKey: key,
                    message: `Section "${id}" references the fact "${key}", which is not in the registry.`,
                });
            }
        }
    }

    for (const key of Object.keys(docs.entity.schemaProperties ?? {})) {
        const owner = key.startsWith("@") ? "dopedocs" : reservedEntityProperty(key);
        if (owner) {
            findings.push({
                code: "reserved-schema-property",
                severity: "fatal",
                message:
                    `entity.schemaProperties sets "${key}", which dopedocs writes itself ` +
                    `(from ${owner}); set it there instead, or remove it.`,
            });
        }
    }

    for (const [key, fact] of Object.entries(docs.facts)) {
        const reviewedTime = Date.parse(`${fact.reviewed}T00:00:00Z`);
        if (!isCalendarDate(fact.reviewed)) {
            findings.push({
                code: "invalid-review-date",
                severity: "fatal",
                factKey: key,
                message: `Fact "${key}" has reviewed date "${fact.reviewed}"; it must be a real ISO YYYY-MM-DD calendar date.`,
            });
            continue;
        }
        const age =
            (today.getTime() - reviewedTime) / DAY_MS;
        if (age > staleAfterDays) {
            findings.push({
                code: "stale-fact",
                severity: "warning",
                factKey: key,
                message: `Fact "${key}" was last reviewed ${Math.floor(age)} days ago; confirm "${fact.value}" is still true.`,
            });
        }
    }

    if (docs.api) findings.push(...validateApi(docs.api, pageIds));
    return findings;
}

/** True when any finding would stop a release. */
export const hasFatal = (findings: Finding[]): boolean =>
    findings.some((f) => f.severity === "fatal");
