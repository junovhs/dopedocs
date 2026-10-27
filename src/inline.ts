/** Pure inline rendering and plain-text derivation, with no schema dependency. */
import type { FactMap } from "./facts.js";
import { FACT_REFERENCE } from "./facts.js";
import { LINK_MARK, linkTarget, stripLinks } from "./links.js";

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
 * 2. **Inline marks.** The only three we accept — `code`, **strong** and
 *    `[text](href)` — applied to text that is already safe, so the tags we
 *    emit are the only tags present. A link inside a code span stays literal:
 *    code shows syntax, it does not follow it.
 * 3. **Substitute facts.** Last, and each value escaped as it lands, so a fact
 *    holding a backtick or a pair of asterisks stays a literal claim instead of
 *    being re-read as markup. Substituting earlier would let the value's own
 *    characters change the shape of the document that quotes it.
 *
 * A reference inside a mark still works — `**{fact:price}**` marks the
 * placeholder, then fills it, and `[mail us](mailto:{fact:email})` links to
 * the registry's address.
 *
 * `sectionHref` decides where a section reference points: the panel's own
 * anchor by default, the section's page on a static build.
 */
export function inline(
    raw: string,
    facts: FactMap,
    where: string,
    sectionHref: SectionHref = anchorHref,
): string {
    const marked = escapeHtml(raw)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .split(/(<code>[\s\S]*?<\/code>)/)
        .map((part, i) => (i % 2 ? part : linkMarks(part, sectionHref)))
        .join("");

    return marked.replace(FACT_REFERENCE, (_match, key: string) => {
        const fact = facts[key];
        if (!fact) throw new UnknownFactError(key, where);
        return escapeHtml(fact.value);
    });
}

/** Where a section reference points, given the section's id. */
export type SectionHref = (id: string) => string;

/** The panel's reading: a section is an anchor on the same page. */
export const anchorHref: SectionHref = (id) => `#${id}`;

/**
 * Turns link marks in already-escaped text into anchors. An href dopedocs does
 * not accept is left as literal text — validation refuses it before any page
 * is published, and literal text is the one rendering that cannot be unsafe.
 */
function linkMarks(escaped: string, sectionHref: SectionHref): string {
    return escaped.replace(LINK_MARK, (match, text: string, href: string) => {
        const target = linkTarget(href);
        if (!target) return match;
        if (target.kind === "section") {
            // `data-dd-link` is the hook the panel scrolls by, the same one
            // the identity card's maker link uses.
            return (
                `<a class="dd-link" href="${escapeHtml(sectionHref(target.id))}"` +
                ` data-dd-link="${target.id}">${text}</a>`
            );
        }
        return (
            `<a class="dd-link" href="${target.href}"` +
            (target.kind === "url" ? ` rel="noopener"` : "") +
            `>${text}</a>`
        );
    });
}

/** Resolved reader-visible words, shared by validation and structured output. */
export const plainText = (raw: string, facts: FactMap, where: string): string =>
    inline(raw, facts, where)
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '\"')
        .replace(/&amp;/g, "&")
        .trim();

/** A heading block's anchor: its own id, else a slug of its words. */
export function headingId(block: { text: string; id?: string }): string {
    return block.id ?? stripLinks(block.text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
