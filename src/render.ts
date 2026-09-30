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
import { isGroup, type DocBlock, type DocIdentity, type DocImage, type DocPage, type DocSection, type DocSet } from "./schema.js";

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

        case "steps":
            return `<ol class="dd-steps">${block.items
                .map(
                    ({ title, text: body }) =>
                        `<li class="dd-step"><div class="dd-step-body">` +
                        `<p class="dd-step-title">${text(title)}</p>` +
                        `<p class="dd-step-text">${text(body)}</p></div></li>`,
                )
                .join("")}</ol>`;

        case "checklist":
            return `<ul class="dd-checklist">${block.items
                .map(({ text: item, checked = false }) => {
                    const state = checked ? "Complete" : "Not complete";
                    return (
                        `<li class="dd-check${checked ? " is-checked" : ""}">` +
                        `<span class="dd-check-icon" aria-hidden="true">${checked ? "&#10003;" : ""}</span>` +
                        `<span><span class="dd-visually-hidden">${state}: </span>${text(item)}</span></li>`
                    );
                })
                .join("")}</ul>`;

        case "details": {
            // Closed native details content is not exposed to print by older
            // engines. A plain-text attribute lets the stylesheet provide a
            // print-only fallback without duplicating content on screen.
            const printable = text(block.text).replace(/<\/?(?:code|strong)>/g, "");
            return (
                `<details class="dd-details" data-dd-print="${printable}"${block.open ? " open" : ""}>` +
                `<summary>${text(block.summary)}</summary>` +
                `<div class="dd-details-body"><p>${text(block.text)}</p></div></details>`
            );
        }

        case "cards":
            return `<div class="dd-cards">${block.items
                .map(({ title, text: body, href, label }) => {
                    const tag = href ? "a" : "article";
                    const target = href ? ` href="${escapeHtml(href)}"` : "";
                    const action = label
                        ? `<span class="dd-card-label">${text(label)}${href ? '<span aria-hidden="true"> &rarr;</span>' : ""}</span>`
                        : "";
                    return (
                        `<${tag} class="dd-card"${target}>` +
                        `<span class="dd-card-title">${text(title)}</span>` +
                        `<span class="dd-card-text">${text(body)}</span>${action}</${tag}>`
                    );
                })
                .join("")}</div>`;

        case "quote":
            return (
                `<figure class="dd-quote"><blockquote${
                    block.cite ? ` cite="${escapeHtml(block.cite)}"` : ""
                }><p>${text(block.text)}</p></blockquote>` +
                (block.attribution
                    ? `<figcaption>${text(block.attribution)}</figcaption>`
                    : "") +
                `</figure>`
            );

        case "metrics":
            return `<dl class="dd-metrics">${block.items
                .map(
                    ({ value, label, detail }) =>
                        `<div class="dd-metric"><dt>${text(label)}</dt>` +
                        `<dd><span class="dd-metric-value">${text(value)}</span>` +
                        (detail ? `<span class="dd-metric-detail">${text(detail)}</span>` : "") +
                        `</dd></div>`,
                )
                .join("")}</dl>`;

        case "compare":
            return `<div class="dd-compare">${(
                [
                    ["before", block.before],
                    ["after", block.after],
                ] as const
            )
                .map(
                    ([side, item]) =>
                        `<article class="dd-compare-item dd-compare-item--${side}">` +
                        `<p class="dd-compare-title">${text(item.title)}</p>` +
                        `<p class="dd-compare-text">${text(item.text)}</p></article>`,
                )
                .join("")}</div>`;

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
            // A card with a mark or a link gets a head to lay them out side by
            // side; one with neither emits exactly what it always has.
            const mark = block.mark ? renderMark(block.mark, "dd-facts-mark") : "";
            const external = /^https?:\/\//i.test(block.href ?? "");
            const head = block.href
                ? `<a class="dd-facts-head dd-facts-link" href="${escapeHtml(block.href)}"` +
                  (external ? ` target="_blank" rel="noopener"` : "") +
                  `>${mark}${title}<span class="dd-facts-url">${escapeHtml(
                      block.href.replace(/^https?:\/\//i, "").replace(/\/$/, ""),
                  )}${external ? '<span aria-hidden="true"> ↗</span>' : ""}</span></a>`
                : block.mark
                  ? `<div class="dd-facts-head">${mark}${title}</div>`
                  : title;
            const rows = block.rows
                .map(([label, value]) => `<dt>${text(label)}</dt><dd>${text(value)}</dd>`)
                .join("");
            return `<div class="dd-facts">${head}<dl class="dd-facts-rows">${rows}</dl></div>`;
        }

        case "image":
            return imageFigure(block, text);

        case "gallery":
            return (
                `<div class="dd-gallery dd-gallery--${block.columns ?? 2}"${
                    block.label
                        ? ` role="group" aria-label="${escapeHtml(block.label)}"`
                        : ""
                }>` +
                block.images
                    .map((image) => imageFigure(image, text, "dd-gallery-item"))
                    .join("") +
                `</div>`
            );

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
    /**
     * Heading level for this page. A static page passes 1, because there the
     * section is the page. Pages inside a group keep this level: the group is
     * a label above them, not a heading they sit under.
     */
    headingLevel?: 1 | 2 | 3 | 4;
    /**
     * Renders the section's `answer` as a lead paragraph. On by default: it is
     * the sentence a machine quotes, and a claim shown to machines but hidden
     * from people is the drift this project exists to prevent.
     */
    showAnswer?: boolean;
}

/** Renders one page: its heading, its answer and its blocks. */
export function renderPage(
    page: DocPage,
    facts: FactMap,
    options: SectionRenderOptions = {},
): string {
    const { headingLevel = 2, showAnswer = true } = options;
    const where = `section "${page.id}"`;
    const h = `h${headingLevel}`;

    const answer = showAnswer
        ? `<p class="dd-answer">${inline(page.answer, facts, where)}</p>`
        : "";

    const body = page.blocks
        .map((block) => renderBlock(block, facts, where))
        .join("");

    return (
        `<section class="dd-section" id="${escapeHtml(page.id)}">` +
        `<${h} class="dd-section-title">${escapeHtml(page.title)}</${h}>` +
        answer +
        body +
        `</section>`
    );
}

/**
 * Renders a page, or a group as a quiet chapter label followed by its pages.
 * The label is not a section: it has no id to scroll to, no answer, no body,
 * and nothing in it needs reading before the pages below it make sense.
 */
export function renderSection(
    section: DocSection,
    facts: FactMap,
    options: SectionRenderOptions = {},
): string {
    if (!isGroup(section)) return renderPage(section, facts, options);
    return (
        `<div class="dd-group" data-dd-group-label="${escapeHtml(section.id)}">` +
        `<p class="dd-group-label">${escapeHtml(section.title)}</p>` +
        section.children.map((page) => renderPage(page, facts, options)).join("") +
        `</div>`
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
function figure(
    media: string,
    caption: string | undefined,
    text: (s: string) => string,
    className = "dd-figure",
): string {
    return (
        `<figure class="${className}">${media}` +
        (caption ? `<figcaption class="dd-figcaption">${text(caption)}</figcaption>` : "") +
        `</figure>`
    );
}

/** Renders one responsive image, shared by standalone figures and galleries. */
function imageFigure(
    image: DocImage,
    text: (s: string) => string,
    className?: string,
): string {
    // Dimensions are attributes rather than CSS so the browser reserves space
    // before the file arrives. Source order is preserved for art direction.
    const attrs =
        (image.srcset ? ` srcset="${escapeHtml(image.srcset)}"` : "") +
        (image.sizes ? ` sizes="${escapeHtml(image.sizes)}"` : "") +
        (image.width !== undefined ? ` width="${image.width}"` : "") +
        (image.height !== undefined ? ` height="${image.height}"` : "") +
        ` loading="${image.loading ?? "lazy"}"` +
        (image.fetchPriority ? ` fetchpriority="${image.fetchPriority}"` : "") +
        ` decoding="async"`;
    const img = `<img class="dd-media dd-media--${image.position ?? "center"}" src="${escapeHtml(
        image.src,
    )}" alt="${escapeHtml(image.alt)}"${attrs}>`;
    const picture = image.sources?.length
        ? `<picture>${image.sources
              .map(
                  (source) =>
                      `<source srcset="${escapeHtml(source.srcset)}"` +
                      (source.media ? ` media="${escapeHtml(source.media)}"` : "") +
                      (source.type ? ` type="${escapeHtml(source.type)}"` : "") +
                      `>`,
              )
              .join("")}${img}</picture>`
        : img;
    const linked = image.href
        ? `<a class="dd-media-link" href="${escapeHtml(image.href)}">${picture}</a>`
        : picture;
    return figure(linked, image.caption, text, className);
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
