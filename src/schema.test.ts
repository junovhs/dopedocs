import { describe, expect, it } from "vitest";

import { defineFacts, resolveFact, referencedFacts } from "./facts.js";
import {
    MAX_ANSWER_LENGTH,
    defineDocs,
    hasFatal,
    validate,
    type DocBlock,
    type DocGroup,
    type DocPage,
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
            id: "your-data",
            title: "Your data",
            children: [
                {
                    id: "data",
                    title: "Where it lives",
                    question: "Where does Example keep my data?",
                    answer: "Example keeps your data in {fact:storage}.",
                    blocks: [{ kind: "p", text: "Nothing leaves the device." }],
                },
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

const section = (over: Partial<DocPage> = {}): DocPage => ({
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
        expect(referencedFacts((sample.sections[0] as DocPage).answer)).toEqual(["price"]);
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

    const group = (id: string, children: DocPage[]): DocGroup => ({ id, title: id, children });

    it("reports a group inside a group", () => {
        const inner = group("mid", [section({ id: "deep" })]) as unknown as DocPage;
        expect(codesOf(withSections([group("top", [inner])]))).toContain("nesting-too-deep");
    });

    it("accepts one level of groups", () => {
        const codes = codesOf(withSections([group("top", [section({ id: "mid" })])]));
        expect(codes).toEqual([]);
    });

    it("reports a group with no pages in it", () => {
        expect(codesOf(withSections([group("empty", [])]))).toContain("empty-group");
    });

    it("reports a group that carries content of its own, or a page with children", () => {
        const chapter = { ...group("top", [section({ id: "mid" })]), answer: "Top says things.", blocks: [] };
        expect(codesOf(withSections([chapter as DocSection]))).toContain("group-with-content");
        const oldStyle = { ...section({ id: "parent" }), children: [section({ id: "child" })] };
        expect(codesOf(withSections([oldStyle as DocSection]))).toContain("group-with-content");
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
                    { kind: "steps", items: [{ title: "{fact:b}", text: "{fact:c}" }] },
                    { kind: "checklist", items: [{ text: "{fact:d}" }] },
                    { kind: "details", summary: "{fact:e}", text: "{fact:f}" },
                    {
                        kind: "cards",
                        items: [{ title: "{fact:g}", text: "{fact:h}", label: "{fact:i}" }],
                    },
                    { kind: "quote", text: "{fact:j}", attribution: "{fact:k}" },
                    {
                        kind: "metrics",
                        items: [{ value: "{fact:l}", label: "{fact:m}", detail: "{fact:n}" }],
                    },
                    {
                        kind: "compare",
                        before: { title: "{fact:o}", text: "{fact:p}" },
                        after: { title: "{fact:q}", text: "{fact:r}" },
                    },
                    { kind: "keys", rows: [["Esc", "{fact:s}"]] },
                    { kind: "table", head: ["h", "{fact:t}"], rows: [["r", "{fact:u}"]] },
                    { kind: "facts", rows: [["Price", "{fact:v}"]] },
                    {
                        kind: "gallery",
                        label: "A gallery",
                        images: [{ src: "/shot.png", alt: "A shot", caption: "{fact:w}" }],
                    },
                ],
            }),
        ]);
        const keys = validate(docs, { today: new Date("2026-09-02") })
            .filter((f) => f.code === "unknown-fact-reference")
            .map((f) => f.factKey);
        expect(keys).toEqual("abcdefghijklmnopqrstuvw".split(""));
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

describe("links", () => {
    it("accepts a link to a page, a URL and a mailto", () => {
        const docs = withSections([
            section({ id: "target" }),
            section({
                id: "source",
                blocks: [
                    {
                        kind: "p",
                        text: "See [it](#target), [this](section:target), [the site](https://example.com) or [mail](mailto:a@b.co).",
                    },
                ],
            }),
        ]);
        expect(codesOf(docs)).toEqual([]);
    });

    it("reports a link to a section that does not exist, naming it", () => {
        const docs = withSections([
            section({ blocks: [{ kind: "p", text: "See [Troubleshooting](#troubleshooting)." }] }),
        ]);
        const finding = validate(docs, { today: new Date("2026-09-02") }).find(
            (f) => f.code === "unknown-section-link",
        );
        expect(finding?.severity).toBe("fatal");
        expect(finding?.sectionId).toBe("ok");
        expect(finding?.message).toContain('"troubleshooting"');
    });

    it("reports a link to a group, which has no page", () => {
        const docs = withSections([
            { id: "chapter", title: "Chapter", children: [section({ id: "inside" })] },
            section({ answer: "Example links to [the chapter](#chapter).", id: "outside" }),
        ]);
        expect(codesOf(docs)).toContain("unknown-section-link");
    });

    it("reports an href in a form dopedocs does not accept", () => {
        const docs = withSections([
            section({ blocks: [{ kind: "p", text: "[x](javascript:void) and [y](docs/page)" }] }),
        ]);
        expect(codesOf(docs).filter((c) => c === "unsupported-link")).toHaveLength(2);
    });

    it("checks the document lead too", () => {
        expect(codesOf({ ...sample, lead: "Start at [nowhere](#nowhere)." })).toContain(
            "unknown-section-link",
        );
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

    it("checks every image in a gallery", () => {
        const findings = validate(
            withBlocks([
                {
                    kind: "gallery",
                    images: [
                        { src: "/a.png", alt: "First view" },
                        { src: "/b.png", alt: " " },
                    ],
                },
            ]),
        );
        expect(findings.filter((f) => f.code === "empty-image-alt")).toHaveLength(1);
    });

    it("rejects non-positive and fractional dimensions", () => {
        const findings = validate(
            withBlocks([
                { kind: "image", src: "/a.png", alt: "A", width: 0 },
                { kind: "image", src: "/b.png", alt: "B", height: 12.5 },
            ]),
        );
        expect(findings.filter((f) => f.code === "invalid-image-dimensions")).toHaveLength(2);
    });
});
