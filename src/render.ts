/**
 * Blocks to HTML.
 *
 * Pure string production with no DOM dependency, so the same code runs in the
 * browser panel and in the static build — one renderer means the page a crawler
 * reads and the page a person reads cannot disagree about anything.
 *
 * Class names are prefixed `dd-` and are public API per DEC-05: a consumer
 * overrides any rule with ordinary CSS, so renaming one is a breaking change.
 */

import type { FactMap } from "./facts.js";
import { FACT_REFERENCE } from "./facts.js";
import type { DocBlock, DocIdentity, DocSection, DocSet } from "./schema.js";

/**
 * Thrown when prose references a fact the registry does not hold. Shipping a
 * literal `{fact:price}` to a reader is worse than failing the build, so this
 * is a throw rather than a finding.
 */
export class UnknownFactError extends Error {
    constructor(
        readonly key: string,
        readonly where: string,
    ) {
        super(
            `Unknown fact "${key}" referenced in ${where}. Add it to the registry or correct the reference.`,
        );
        this.name = "UnknownFactError";
    }
}

/** Escapes the four characters that could otherwise close or open markup. */
export const escapeHtml = (raw: string): string =>
    raw.replace(
        /[&<>"]/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
    );

/**
 * Renders one authored string.
 *
 * The order is deliberate and load-bearing:
 *
 * 1. **Escape.** Authored prose is data. Running this first means no content —
 *    and no fact value — can introduce markup.
 * 2. **Inline marks.** The only two we accept, applied to text that is already
 *    safe, so the tags we emit are the only tags present.
 * 3. **Substitute facts.** Last, and each value escaped as it lands, so a fact
 *    holding a backtick or a pair of asterisks stays a literal claim instead of
 *    being re-read as markup. Substituting earlier would let the value's own
 *    characters change the shape of the document that quotes it.
 *
 * A reference inside a mark still works — `**{fact:price}**` marks the
 * placeholder, then fills it.
 */
export function inline(raw: string, facts: FactMap, where: string): string {
    const marked = escapeHtml(raw)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    return marked.replace(FACT_REFERENCE, (_match, key: string) => {
        const fact = facts[key];
        if (!fact) throw new UnknownFactError(key, where);
        return escapeHtml(fact.value);
    });
}

/** Reports a block kind that the union gained and this module never learned. */
function assertNever(value: never): never {
    throw new Error(`Unhandled block kind: ${JSON.stringify(value)}`);
}

/**
 * Renders one block.
 *
 * The switch is exhaustive over `DocBlock` and its `default` arm narrows to
 * `never`, so a new member of the union is a compile error here rather than a
 * block that silently renders as nothing.
 */
export function renderBlock(block: DocBlock, facts: FactMap, where: string): string {
    /** Renders one authored string of this block, bound to its registry and origin. */
    const text = (raw: string) => inline(raw, facts, where);

    switch (block.kind) {
        case "p":
            return `<p class="dd-p">${text(block.text)}</p>`;

        case "list": {
            const tag = block.ordered ? "ol" : "ul";
            const items = block.items.map((i) => `<li>${text(i)}</li>`).join("");
            return `<${tag} class="dd-list">${items}</${tag}>`;
        }

        case "callout":
            return `<div class="dd-callout dd-callout--${block.tone ?? "note"}"><p>${text(
                block.text,
            )}</p></div>`;

        case "keys":
            return `<div class="dd-keys">${block.rows
                .map(([keys, does]) => `<kbd>${text(keys)}</kbd><span>${text(does)}</span>`)
                .join("")}</div>`;

        case "table":
            return `<div class="dd-table-scroll"><table class="dd-table"><thead><tr>${block.head
                .map((h) => `<th>${text(h)}</th>`)
                .join("")}</tr></thead><tbody>${block.rows
                .map(([a, b]) => `<tr><td>${text(a)}</td><td>${text(b)}</td></tr>`)
                .join("")}</tbody></table></div>`;

        case "facts": {
            const title = block.title
                ? `<p class="dd-facts-title">${text(block.title)}</p>`
                : "";
            // A card with a mark gets a head to lay the two out side by side;
            // one without emits exactly what it always has.
            const head = block.mark
                ? `<div class="dd-facts-head">${renderMark(
                      block.mark,
                      "dd-facts-mark",
                  )}${title}</div>`
                : title;
            const rows = block.rows
                .map(([label, value]) => `<dt>${text(label)}</dt><dd>${text(value)}</dd>`)
                .join("");
            return `<div class="dd-facts">${head}<dl class="dd-facts-rows">${rows}</dl></div>`;
        }

        case "image": {
            // Dimensions are attributes rather than CSS so the browser can
            // reserve the space before the file arrives; a page that reflows as
            // its images load is a worse page than one that waits.
            const dims =
                (block.width ? ` width="${block.width}"` : "") +
                (block.height ? ` height="${block.height}"` : "");
            return figure(
                `<img class="dd-media" src="${escapeHtml(block.src)}" alt="${escapeHtml(
                    block.alt,
                )}"${dims} loading="lazy" decoding="async">`,
                block.caption,
                text,
            );
        }

        case "video":
            // `controls` and nothing else: no autoplay, no script, no embed.
            // `preload="metadata"` fetches the duration, not the video.
            return figure(
                `<video class="dd-media" src="${escapeHtml(block.src)}"${
                    block.poster ? ` poster="${escapeHtml(block.poster)}"` : ""
                } controls preload="metadata"></video>`,
                block.caption,
                text,
            );

        default:
            // Reached only if `DocBlock` gains a member this switch does not
            // handle — and then `block` is no longer `never`, so this line
            // fails to compile rather than rendering the block as nothing.
            return assertNever(block);
    }
}

/** How a section is drawn; every field has a working default. */
export interface SectionRenderOptions {
    /** Heading level for this section; children render one level deeper. */
    headingLevel?: 2 | 3 | 4;
    /**
     * Renders the section's `answer` as a lead paragraph. On by default: it is
     * the sentence a machine quotes, and a claim shown to machines but hidden
     * from people is the drift this project exists to prevent.
     */
    showAnswer?: boolean;
}

/** Renders one section and, beneath it, any folder children it carries. */
export function renderSection(
    section: DocSection,
    facts: FactMap,
    options: SectionRenderOptions = {},
): string {
    const { headingLevel = 2, showAnswer = true } = options;
    const where = `section "${section.id}"`;
    const h = `h${headingLevel}`;

    const answer = showAnswer
        ? `<p class="dd-answer">${inline(section.answer, facts, where)}</p>`
        : "";

    const body = section.blocks
        .map((block) => renderBlock(block, facts, where))
        .join("");

    const children = (section.children ?? [])
        .map((child) =>
            renderSection(child, facts, {
                ...options,
                headingLevel: Math.min(headingLevel + 1, 4) as 3 | 4,
            }),
        )
        .join("");

    return (
        `<section class="dd-section" id="${escapeHtml(section.id)}">` +
        `<${h} class="dd-section-title">${escapeHtml(section.title)}</${h}>` +
        answer +
        body +
        `</section>` +
        children
    );
}

/** Renders every section of a document in reading order. */
export function renderBody(docs: DocSet, options: SectionRenderOptions = {}): string {
    return docs.sections
        .map((section) => renderSection(section, docs.facts, options))
        .join("");
}

/**
 * A brandmark, given either as the URL of an image or as inline SVG.
 *
 * A value that opens with `<` is markup and is emitted unescaped — trusted
 * author input, never user input. Anything else is a URL and becomes an
 * `<img>`, which is the form that needs no stylesheet at all: inline SVG that
 * draws itself with the author's own class names renders wrong on a static
 * page, because that page links dopedocs' stylesheet and not the app's bundle.
 *
 * Decorative in both forms — the card states the name in text beside it — so
 * it is hidden from assistive technology rather than given invented alt text.
 */
export function renderMark(mark: string, className: string): string {
    const markup = mark.trimStart().startsWith("<");
    return (
        `<span class="${className}" aria-hidden="true">` +
        (markup ? mark : `<img src="${escapeHtml(mark)}" alt="">`) +
        `</span>`
    );
}

/** Wraps a picture or a video with its caption, if it has one. */
function figure(media: string, caption: string | undefined, text: (s: string) => string): string {
    return (
        `<figure class="dd-figure">${media}` +
        (caption ? `<figcaption class="dd-figcaption">${text(caption)}</figcaption>` : "") +
        `</figure>`
    );
}

/**
 * Renders the release card: which product, which version, made by whom.
 *
 * Every text field is escaped. A `mark` is not, when it is inline SVG — see
 * the warning on `DocIdentity.mark`.
 */
export function renderIdentity(identity: DocIdentity): string {
    const meta = [
        identity.version ? `<span>Version ${escapeHtml(identity.version)}</span>` : "",
        identity.channel ? `<span>${escapeHtml(identity.channel)}</span>` : "",
        identity.maker
            ? identity.maker.href
                ? `<a class="dd-identity-maker" href="${escapeHtml(identity.maker.href)}" data-dd-link="${escapeHtml(
                      identity.maker.href.replace(/^#/, ""),
                  )}">by ${escapeHtml(identity.maker.name)}</a>`
                : `<span>by ${escapeHtml(identity.maker.name)}</span>`
            : "",
    ].filter(Boolean);

    return (
        `<section class="dd-identity">` +
        (identity.mark ? renderMark(identity.mark, "dd-identity-mark") : "") +
        `<div class="dd-identity-text">` +
        `<p class="dd-identity-name">${escapeHtml(identity.name)}</p>` +
        // Separators are joined between present fields only, so an absent
        // version never leaves a dangling dot.
        (meta.length
            ? `<p class="dd-identity-meta">${meta.join(
                  '<span class="dd-identity-dot">·</span>',
              )}</p>`
            : "") +
        `</div></section>`
    );
}

/** Renders the document's identity, title and lead, above the sections. */
export function renderLead(docs: DocSet): string {
    return (
        (docs.identity ? renderIdentity(docs.identity) : "") +
        `<header class="dd-header">` +
        `<h1 class="dd-title">${escapeHtml(docs.title)}</h1>` +
        `<p class="dd-lead">${inline(docs.lead, docs.facts, "the document lead")}</p>` +
        `</header>`
    );
}
