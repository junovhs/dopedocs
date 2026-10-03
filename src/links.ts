/**
 * The one inline link mark: `[text](href)`.
 *
 * Reading the syntax lives here, apart from the renderer, because validation
 * needs it too — to refuse a link that points at a section that does not exist,
 * or at a scheme that has no business in documentation — and the schema module
 * cannot import the renderer without a cycle.
 */

/**
 * Matches a link mark, capturing its text and its href. The href holds no
 * whitespace and no `)`, so a sentence that merely has brackets in it is left
 * alone.
 */
export const LINK_MARK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/** What an href points at. */
export type LinkTarget =
    | { kind: "url"; href: string }
    | { kind: "mailto"; href: string }
    /** Another section, by id; where it lives depends on where it is drawn. */
    | { kind: "section"; id: string };

/**
 * Classifies an href, or returns `undefined` for one dopedocs does not accept.
 *
 * Three forms only: an absolute `http(s)` URL, a `mailto:`, and a section
 * reference written `#id` or `section:id`. A relative path would mean different
 * things on the panel and on a static page, and any other scheme
 * (`javascript:`, `data:`) is not something documentation links to.
 */
export function linkTarget(href: string): LinkTarget | undefined {
    if (/^https?:\/\/\S+$/i.test(href)) return { kind: "url", href };
    if (/^mailto:\S+$/i.test(href)) return { kind: "mailto", href };
    const section = href.match(/^(?:#|section:)([^\s#/]+)$/);
    if (section) return { kind: "section", id: section[1]! };
    return undefined;
}

/** Every link mark in a string, in order of appearance. */
export function referencedLinks(text: string): { text: string; href: string }[] {
    return [...text.matchAll(LINK_MARK)].map((m) => ({ text: m[1]!, href: m[2]! }));
}

/** A string with each link mark reduced to its text, for plain-text slots. */
export const stripLinks = (text: string): string => text.replace(LINK_MARK, "$1");
