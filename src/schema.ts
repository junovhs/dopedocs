/**
 * The authoring surface.
 *
 * DEC-01: documentation is a TypeScript value, not a markup dialect. dopedocs
 * ships no parser, so `tsc` is the only front end and a malformed document
 * fails at the author's keyboard rather than in a reader's browser.
 *
 * DEC-02: `question` and `answer` are required on every section, because the
 * annotation that makes documentation answerable cannot be the part that is
 * easiest to skip.
 */

import type { FactMap } from "./facts.js";
import { referencedFacts } from "./facts.js";

/* ── Blocks ──────────────────────────────────────────────────────────────── */

/**
 * One renderable unit. A discriminated union rather than open markup: the
 * renderer switches exhaustively over `kind`, so adding a variant here is a
 * compile error everywhere that must learn to draw it.
 *
 * Prose fields carry two inline marks — `code` and **strong** — plus
 * `{fact:key}` references. Anything richer becomes a new block kind; it never
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
}

export type DocBlock =
    | { kind: "p"; text: string }
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
    | { kind: "table"; head: [string, string]; rows: [string, string][] }
    | {
          kind: "facts";
          title?: string;
          /** A brandmark for the card: inline SVG, or the URL of an image. */
          mark?: string;
          rows: [label: string, value: string][];
      }
    | ({ kind: "image" } & DocImage)
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
    blocks: DocBlock[];
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
    /** One level only: a group holds pages, never other groups. */
    children: DocPage[];
}

/** An entry at the top of the contents: a page, or a group of pages. */
export type DocSection = DocPage | DocGroup;

/** True for a chapter bucket rather than a page. */
export const isGroup = (section: DocSection): section is DocGroup =>
    Array.isArray((section as DocGroup).children);

/** Every page in reading order, each with the group it sits in, if any. */
export function pagesOf(sections: DocSection[]): { page: DocPage; group?: DocGroup }[] {
    return sections.flatMap((section) =>
        isGroup(section)
            ? section.children.map((page) => ({ page, group: section }))
            : [{ page: section }],
    );
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
}

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
}

/** Declares a documentation set, preserving literal fact keys for reference checking. */
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
    | "answer-opens-with-pronoun"
    | "answer-too-long"
    | "nesting-too-deep"
    | "empty-group"
    | "group-with-content"
    | "unknown-fact-reference"
    | "invalid-review-date"
    | "stale-fact"
    | "empty-image-alt"
    | "invalid-image-dimensions";

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

/**
 * Walks a section tree in reading order, reporting each entry's depth. Typed
 * loosely on purpose: `validate` must report a malformed document (a group
 * inside a group, a page with children) that the types would reject, because
 * documents also arrive from plain JavaScript.
 */
function* walk(
    sections: readonly unknown[],
    depth = 0,
): Generator<{ section: DocSection; depth: number }> {
    for (const section of sections as DocSection[]) {
        yield { section, depth };
        const children = (section as { children?: unknown }).children;
        if (Array.isArray(children)) yield* walk(children, depth + 1);
    }
}

/** Every string in a block that inline marks and fact references apply to. */
function proseOf(block: DocBlock): string[] {
    switch (block.kind) {
        case "p":
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

    for (const { section, depth } of walk(docs.sections)) {
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

        if (depth > 1 || (depth === 1 && isGroup(section))) {
            findings.push({
                code: "nesting-too-deep",
                severity: "fatal",
                sectionId: id,
                message: `Section "${id}" is nested too deep; a group holds pages only, and deeper nesting means the docs want splitting.`,
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

        if (!section.question.trim()) {
            findings.push({
                code: "empty-question",
                severity: "fatal",
                sectionId: id,
                message: `Section "${id}" has an empty question; it is the query this section is retrieved for.`,
            });
        }

        const opener = firstWord(section.answer);
        if (OUTWARD_OPENERS.has(opener)) {
            findings.push({
                code: "answer-opens-with-pronoun",
                severity: "fatal",
                sectionId: id,
                message: `The answer for "${id}" opens with "${opener}", which points outside itself; quoted alone it describes an unnamed subject. Name the subject.`,
            });
        }

        if (section.answer.length > MAX_ANSWER_LENGTH) {
            findings.push({
                code: "answer-too-long",
                severity: "fatal",
                sectionId: id,
                message: `The answer for "${id}" is ${section.answer.length} characters; over ${MAX_ANSWER_LENGTH} it stops being a quotable snippet. Move the detail into blocks.`,
            });
        }

        const prose = [
            section.question,
            section.answer,
            ...section.blocks.flatMap(proseOf),
        ];
        for (const text of prose) {
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

    for (const [key, fact] of Object.entries(docs.facts)) {
        if (!ISO_DATE.test(fact.reviewed)) {
            findings.push({
                code: "invalid-review-date",
                severity: "fatal",
                factKey: key,
                message: `Fact "${key}" has reviewed date "${fact.reviewed}"; it must be an ISO YYYY-MM-DD date.`,
            });
            continue;
        }
        const age =
            (today.getTime() - Date.parse(`${fact.reviewed}T00:00:00Z`)) / DAY_MS;
        if (age > staleAfterDays) {
            findings.push({
                code: "stale-fact",
                severity: "warning",
                factKey: key,
                message: `Fact "${key}" was last reviewed ${Math.floor(age)} days ago; confirm "${fact.value}" is still true.`,
            });
        }
    }

    return findings;
}

/** True when any finding would stop a release. */
export const hasFatal = (findings: Finding[]): boolean =>
    findings.some((f) => f.severity === "fatal");
