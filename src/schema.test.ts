import { describe, expect, it } from "vitest";

import { defineFacts, resolveFact, referencedFacts } from "./facts.js";
import {
    MAX_ANSWER_LENGTH,
    defineDocs,
    hasFatal,
    validate,
    type DocBlock,
    type DocSection,
    type DocSet,
    type FindingCode,
} from "./schema.js";

/* ── A full authoring round trip ─────────────────────────────────────────────
   This module is the sample content a consumer writes: an entity, a facts
   registry, and sections that reference those facts rather than restating
   them. That it compiles at all is half the point of DEC-01. */

const facts = defineFacts({
    price: { value: "free", reviewed: "2026-09-02" },
    storage: { value: "your browser", reviewed: "2026-09-02" },
});

const sample = defineDocs({
    entity: {
        name: "Example",
        url: "https://example.com",
        notToBeConfusedWith: ["Exemplar", "Example Corp"],
    },
    title: "How Example works",
    lead: "Example does one thing, and this page is how.",
    facts,
    sections: [
        {
            id: "what-it-costs",
            title: "Cost",
            question: "How much does Example cost?",
            answer: "Example is {fact:price} to use, with no paid tier.",
            blocks: [
                { kind: "p", text: "Example is {fact:price}." },
                { kind: "callout", text: "Your list lives in {fact:storage}." },
            ],
        },
        {
            id: "data",
            title: "Your data",
            question: "Where does Example keep my data?",
            answer: "Example keeps your data in {fact:storage}.",
            blocks: [{ kind: "p", text: "Nothing leaves the device." }],
            children: [
                {
                    id: "export",
                    title: "Export",
                    question: "Can I export my data from Example?",
                    answer: "Example exports the whole list as JSON at any time.",
                    blocks: [{ kind: "list", items: ["Open settings", "Choose export"] }],
                },
            ],
        },
    ],
});

/** Codes reported for a document, for terse assertions. */
const codesOf = (docs: DocSet, today = new Date("2026-09-02")): FindingCode[] =>
    validate(docs, { today }).map((f) => f.code);

/** The sample with `sections` swapped out, so each case states only its subject. */
const withSections = (sections: DocSection[]): DocSet => ({ ...sample, sections });

const section = (over: Partial<DocSection> = {}): DocSection => ({
    id: "ok",
    title: "Ok",
    question: "Is this section valid?",
    answer: "Example treats this section as valid.",
    blocks: [],
    ...over,
});

describe("a well-formed document", () => {
    it("reports nothing", () => {
        expect(validate(sample, { today: new Date("2026-09-02") })).toEqual([]);
    });

    it("round-trips its facts by key", () => {
        expect(resolveFact(facts, "price")).toBe("free");
        expect(referencedFacts(sample.sections[0]!.answer)).toEqual(["price"]);
    });
});

describe("validate", () => {
    it("reports two sections sharing an id", () => {
        const docs = withSections([section({ id: "same" }), section({ id: "same" })]);
        expect(codesOf(docs)).toContain("duplicate-section-id");
    });

    it("reports an id that is not a URL-safe slug", () => {
        expect(codesOf(withSections([section({ id: "Not A Slug" })]))).toContain(
            "invalid-section-id",
        );
    });

    it("reports an empty question", () => {
        expect(codesOf(withSections([section({ question: "   " })]))).toContain(
            "empty-question",
        );
    });

    it("reports an answer that opens with an outward-referring pronoun", () => {
        const docs = withSections([
            section({ answer: "It keeps your list in the browser." }),
        ]);
        expect(codesOf(docs)).toContain("answer-opens-with-pronoun");
    });

    it("accepts an answer that names its subject", () => {
        const docs = withSections([
            section({ answer: "Example keeps your list in the browser." }),
        ]);
        expect(codesOf(docs)).not.toContain("answer-opens-with-pronoun");
    });

    it("reports an answer too long to quote", () => {
        const docs = withSections([
            section({ answer: `Example ${"x".repeat(MAX_ANSWER_LENGTH)}` }),
        ]);
        expect(codesOf(docs)).toContain("answer-too-long");
    });

    it("reports nesting past one level of folders", () => {
        const docs = withSections([
            section({
                id: "top",
                children: [
                    section({ id: "mid", children: [section({ id: "deep" })] }),
                ],
            }),
        ]);
        expect(codesOf(docs)).toContain("nesting-too-deep");
    });

    it("accepts one level of folders", () => {
        const docs = withSections([
            section({ id: "top", children: [section({ id: "mid" })] }),
        ]);
        expect(codesOf(docs)).not.toContain("nesting-too-deep");
    });

    it("reports a fact reference that resolves to nothing, naming the key", () => {
        const docs = withSections([
            section({ blocks: [{ kind: "p", text: "Costs {fact:nope}." }] }),
        ]);
        const finding = validate(docs, { today: new Date("2026-09-02") }).find(
            (f) => f.code === "unknown-fact-reference",
        );
        expect(finding?.factKey).toBe("nope");
        expect(finding?.sectionId).toBe("ok");
    });

    it("finds fact references in every prose-carrying block kind", () => {
        const docs = withSections([
            section({
                blocks: [
                    { kind: "list", items: ["{fact:a}"] },
                    { kind: "keys", rows: [["Esc", "{fact:b}"]] },
                    { kind: "table", head: ["h", "{fact:c}"], rows: [["r", "{fact:d}"]] },
                    { kind: "facts", rows: [["Price", "{fact:e}"]] },
                ],
            }),
        ]);
        const keys = validate(docs, { today: new Date("2026-09-02") })
            .filter((f) => f.code === "unknown-fact-reference")
            .map((f) => f.factKey);
        expect(keys).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("reports a malformed review date instead of guessing at it", () => {
        const docs: DocSet = {
            ...sample,
            facts: { price: { value: "free", reviewed: "September 2026" } },
            sections: [section()],
        };
        expect(codesOf(docs)).toContain("invalid-review-date");
    });

    it("reports a fact nobody has confirmed within the staleness window", () => {
        const docs: DocSet = {
            ...sample,
            facts: { price: { value: "free", reviewed: "2024-01-01" } },
            sections: [section()],
        };
        const findings = validate(docs, { today: new Date("2026-09-02") });
        const stale = findings.find((f) => f.code === "stale-fact");
        expect(stale?.factKey).toBe("price");
        expect(stale?.severity).toBe("warning");
    });

    it("collects every problem in one pass rather than stopping at the first", () => {
        const docs = withSections([
            section({ id: "Bad Id", question: "", answer: "It is bad." }),
        ]);
        expect(codesOf(docs).length).toBeGreaterThanOrEqual(3);
    });
});

describe("hasFatal", () => {
    it("separates a release-stopping finding from an advisory one", () => {
        expect(hasFatal([{ code: "stale-fact", severity: "warning", message: "" }])).toBe(
            false,
        );
        expect(
            hasFatal([{ code: "invalid-section-id", severity: "fatal", message: "" }]),
        ).toBe(true);
    });
});

/* ── Type-level tests ────────────────────────────────────────────────────────
   These assert what DEC-02 makes binding: a section without its annotation is
   not a document with a gap, it is a document that does not compile. They are
   checked by `npm run check`, which typechecks this file. */

// @ts-expect-error - `answer` is required by DEC-02
export const missingAnswerIsATypeError: DocSection = {
    id: "no-answer",
    title: "No answer",
    question: "What happens when the answer is left out?",
    blocks: [],
};

// @ts-expect-error - `question` is required by DEC-02
export const missingQuestionIsATypeError: DocSection = {
    id: "no-question",
    title: "No question",
    answer: "Example refuses to compile this section.",
    blocks: [],
};

export const unknownBlockKindIsATypeError: DocSection = section({
    // @ts-expect-error - "carousel" is not a member of the DocBlock union
    blocks: [{ kind: "carousel", slides: [] }],
});

export const imageWithoutAltIsATypeError: DocSection = section({
    // @ts-expect-error - `alt` is required on an image
    blocks: [{ kind: "image", src: "/shot.png" }],
});

export const entityMustDisambiguate = () =>
    defineDocs({
        // @ts-expect-error - `notToBeConfusedWith` is required
        entity: { name: "Example", url: "https://example.com" },
        title: "t",
        lead: "l",
        facts: {},
        sections: [],
    });

/** A known key resolves; an unknown one is rejected at the call site. */
export const factKeysAreLiteral = () => {
    const registry = defineFacts({ price: { value: "free", reviewed: "2026-09-02" } });
    const known: string = resolveFact(registry, "price");
    // @ts-expect-error - "colour" is not a key of this registry
    resolveFact(registry, "colour");
    return known;
};

describe("image alt", () => {
    const withBlocks = (blocks: DocBlock[]) =>
        defineDocs({
            entity: {
                name: "Example",
                url: "https://example.test",
                notToBeConfusedWith: ["Example Co"],
            },
            title: "Doc",
            lead: "Example documents itself.",
            facts: {},
            sections: [
                {
                    id: "s",
                    title: "S",
                    question: "What is Example?",
                    answer: "Example is a product that documents itself.",
                    blocks,
                },
            ],
        });

    it("is a fatal finding when blank", () => {
        const findings = validate(
            withBlocks([{ kind: "image", src: "/a.png", alt: "   " }]),
        );
        const alt = findings.filter((f) => f.code === "empty-image-alt");
        expect(alt).toHaveLength(1);
        expect(alt[0]!.severity).toBe("fatal");
        expect(alt[0]!.sectionId).toBe("s");
    });

    it("passes when it says something", () => {
        const findings = validate(
            withBlocks([{ kind: "image", src: "/a.png", alt: "The order, top first" }]),
        );
        expect(findings.filter((f) => f.code === "empty-image-alt")).toHaveLength(0);
    });
});
