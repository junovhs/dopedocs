import { describe, expect, it } from "vitest";
import { renderBlock } from "./render.js";
import { validate, type DocBlock, type DocSet } from "./schema.js";
import { createSearchIndex } from "./search.js";

export const containers: DocBlock[] = [{
    kind: "tabs", label: "Package manager", group: "package-manager",
    panes: [
        { key: "npm", label: "npm", blocks: [{ kind: "code", code: "npm install example", language: "sh" }] },
        { key: "pnpm", label: "pnpm", blocks: [{ kind: "disclosure", summary: "More {fact:version}", blocks: [
            { kind: "p", text: "Nested searchable [guide](#guide) {fact:version}" },
        ] }] },
    ],
}];
const docs: DocSet = {
    title: "Manual", lead: "Read.", entity: { name: "Example", url: "https://example.com", notToBeConfusedWith: [] },
    facts: { version: { value: "Version 4", reviewed: "2026-10-18" } },
    sections: [{ id: "chapter", title: "Chapter", landing: { id: "guide", title: "Guide", question: "How?", answer: "Example works.", blocks: containers }, children: [] }],
};
describe("container blocks", () => {
    it("renders labelled sequential panes and native nested disclosure without hidden content", () => {
        const html = renderBlock(containers[0]!, docs.facts, "test");
        expect(html).toContain('data-dd-tabs');
        expect(html).toContain('data-dd-pane="pnpm"');
        expect(html).toContain('<details class="dd-disclosure"');
        expect(html).toContain('<summary>More Version 4</summary>');
        expect(html).toContain('Nested searchable <a');
        expect(html).not.toMatch(/hidden|role="tab/);
    });
    it("validates and searches nested content on group landings", () => {
        expect(validate(docs, { today: new Date("2026-10-18") })).toEqual([]);
        expect(createSearchIndex(docs, id => `/docs/${id}/`)[0]!.text).toContain("Nested searchable guide Version 4");
        const invalid = structuredClone(docs);
        invalid.facts = {};
        expect(validate(invalid).filter(f => f.code === "unknown-fact-reference")).toHaveLength(2);
    });
});

it("reports nested block errors and invalid choices", () => {
    const invalid = structuredClone(docs);
    const page = (invalid.sections[0] as import("./schema.js").DocGroup).landing!;
    page.blocks = [{ kind: "tabs", label: "", panes: [
        { key: "same", label: "", blocks: [{ kind: "image", src: "/x.png", alt: "", width: -1 }] },
        { key: "same", label: "Other", blocks: [{ kind: "disclosure", summary: "", blocks: [
            { kind: "table", head: ["one"], rows: [[]] },
            { kind: "p", text: "[missing](#absent)" }, { kind: "math", tex: " " },
        ] }] },
    ] }];
    expect(validate(invalid).map(f => f.code)).toEqual(expect.arrayContaining([
        "invalid-tabs", "empty-disclosure-summary", "empty-image-alt", "invalid-image-dimensions",
        "table-row-width", "unknown-section-link", "empty-math",
    ]));
});

it("prepares nested code and math in group landings and articles without mutating the source", async () => {
    const { prepareCode } = await import("./highlight.js");
    const { prepareMath } = await import("./math.js");
    const { walkBlocks } = await import("./blocks.js");
    const source = structuredClone(docs);
    const landing = (source.sections[0] as import("./schema.js").DocGroup).landing!;
    landing.blocks.push({ kind: "disclosure", summary: "Equation", blocks: [{ kind: "math", tex: "x^2" }] });
    source.articles = [{ ...landing, id: "article", published: "2026-10-18" }];
    const prepared = prepareMath(await prepareCode(source));
    for (const page of [(prepared.sections[0] as import("./schema.js").DocGroup).landing!, prepared.articles![0]!]) {
        const blocks = [...walkBlocks(page.blocks)];
        expect(blocks.find(block => block.kind === "code")).toHaveProperty("tokens");
        expect(blocks.find(block => block.kind === "math")).toHaveProperty("prepared.mathml", expect.stringContaining("<math"));
    }
    expect(JSON.stringify(source)).not.toMatch(/"tokens"|"prepared"/);
});
