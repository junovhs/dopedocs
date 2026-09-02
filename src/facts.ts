/**
 * The facts registry.
 *
 * DEC-03: a claim a reader could act on — a price, a limit, a guarantee, an
 * availability window — is defined here once and referenced from prose and from
 * structured data by key. Typing the document shape does not prevent a site
 * disagreeing with itself, because two different string literals in two
 * sections are both perfectly valid; holding the value in one place does.
 */

/** One canonical claim, with the date a human last confirmed it is still true. */
export interface FactDef {
    /** The claim itself, exactly as it should read to a person. */
    value: string;
    /** ISO `YYYY-MM-DD` date this value was last confirmed correct. */
    reviewed: string;
    /** Optional context for whoever reviews it next; never rendered. */
    note?: string;
}

/** A registry of claims, keyed by the names prose refers to them by. */
export type FactMap = Record<string, FactDef>;

/**
 * Declares a set of facts, preserving the literal key names so a reference to a
 * key that does not exist is a type error rather than a runtime surprise.
 */
export function defineFacts<const T extends FactMap>(facts: T): T {
    return facts;
}

/** Every key in a registry, as a union of string literals. */
export type FactKey<T extends FactMap> = Extract<keyof T, string>;

/**
 * Reads one fact's value. The key is constrained to the registry, so a typo is
 * caught by the compiler at the call site.
 */
export function resolveFact<T extends FactMap>(facts: T, key: FactKey<T>): string {
    return facts[key].value;
}

/** Matches a `{fact:key}` reference in prose, capturing the key. */
export const FACT_REFERENCE = /\{fact:([a-zA-Z0-9_-]+)\}/g;

/**
 * Every fact key referenced by a string, in order of appearance. Substitution
 * itself belongs to the renderer; this is only the reading of the syntax, which
 * validation needs in order to report a reference that resolves to nothing.
 */
export function referencedFacts(text: string): string[] {
    return [...text.matchAll(FACT_REFERENCE)].map((m) => m[1]!);
}
