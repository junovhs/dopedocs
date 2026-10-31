import { expect, it } from "vitest";
import { defineDocs, validate, type DocSet, type ReferenceEntry } from "./schema.js";
import { buildStatic } from "./static.js";
import { validateReference } from "./reference.js";

const entry = (id: string, extra: Partial<ReferenceEntry> = {}): ReferenceEntry => ({
    id, title: id, question: `What does ${id} do?`, answer: `${id} loads keys.`, blocks: [], ...extra,
});

const fixture = (): DocSet => defineDocs({
    entity: { name: "Tool", url: "https://example.com", notToBeConfusedWith: [] },
    title: "Manual", lead: "Learn the tool.", facts: {},
    sections: [{ id: "guide", title: "Guide", question: "How do I start?", answer: "Start with [load](#load).", blocks: [] }],
    reference: {
        id: "reference", title: "Developer reference", question: "What can I call?", answer: "Tool's reference lists every call.", blocks: [],
        code: [{ title: "Quick start", samples: [{ label: "Python", language: "python", code: "load()" }] }],
        groups: [{ id: "loaders", title: "Loaders", entries: [
            entry("load", {
                badge: "fn", signature: "load(path=\".env\")", guide: "guide",
                fields: [{ title: "Parameters", fields: [{ name: "path", type: "str", default: "\".env\"", description: "The file <read>." }] }],
                errors: [{ code: "KeyError", description: "No such key." }],
                code: [{ title: "Example", samples: [{ label: "Python", code: "load()" }, { label: "Node.js", code: "await load()" }] }],
            }),
            { id: "reply", title: "reply", question: "What is the reply?", answer: "The reply is one line." },
        ] }],
    },
});

it("renders the reference as rows of prose beside code, linked from the manual and listed in machine outputs", () => {
    const docs = fixture();
    expect(validate(docs)).toEqual([]);
    const out = buildStatic(docs);
    const page = out["docs/reference/index.html"]!;
    expect(page).toBeDefined();
    // Rows: the overview, then each entry, with its doc and code columns.
    expect(page.match(/class="dd-ref-row[^"]*" id="(reference|load|reply)"/g)).toHaveLength(3);
    expect(page).toContain('<p class="dd-ref-signature"><span class="dd-ref-badge">fn</span><code>load(path=&quot;.env&quot;)</code></p>');
    expect(page).toContain('<span class="dd-ref-default">Default <code>&quot;.env&quot;</code></span>');
    expect(page).toContain("The file &lt;read&gt;.");
    // Several samples share one tab group, so a language choice follows the reader.
    expect(page).toContain('data-dd-tabs data-dd-tab-group="dd-ref-sample"');
    expect(page).toContain('data-dd-pane="node-js"');
    expect(out["docs/tabs.js"]).toBeDefined();
    expect(page).toContain('<script src="/docs/tabs.js" defer>');
    expect(page).toContain('<a href="/docs/guide/">Guide</a>');
    // The bar switches between the two; the rail lists entries with badges.
    expect(page).toContain('<a class="dd-bar-tab" href="/docs/reference/" aria-current="page">Developer reference</a>');
    expect(out["docs/guide/index.html"]).toContain('<a class="dd-bar-tab" href="/docs/" aria-current="page">Manual</a>');
    expect(page).toContain('<a class="dd-nav-link dd-ref-link" href="#load"><span class="dd-ref-badge">fn</span><span>load</span></a>');
    // A manual link to an entry lands on its anchor.
    expect(out["docs/guide/index.html"]).toContain('href="/docs/reference/#load"');
    const questions = JSON.parse(out["questions.json"]!).questions;
    expect(questions.find((q: { id: string }) => q.id === "load").url).toBe("https://example.com/docs/reference/#load");
    expect(out["llms.txt"]).toContain("## Developer reference");
    expect(out["sitemap.xml"]).toContain("https://example.com/docs/reference/</loc>");
    expect(out["sitemap.xml"]).not.toContain("#load");
});

it("checks reference entries like pages, and what they add", () => {
    const docs = fixture();
    const load = docs.reference!.groups[0]!.entries[0]!;
    load.guide = "nowhere";
    load.code![0]!.samples[1]!.label = "Python";
    docs.reference!.groups[0]!.entries[1]!.answer = "";
    docs.reference!.groups.push({ id: "empty", title: "Empty", entries: [] });
    const manual = new Set(["guide"]);
    const findings = [...validate(docs), ...validateReference(docs.reference!, manual)];
    const codes = findings.map((f) => f.code);
    expect(codes).toContain("unknown-reference-guide");
    expect(codes).toContain("invalid-reference");
    expect(codes).toContain("empty-answer");
    expect(() => buildStatic(docs)).toThrow(/nowhere/);
    expect(findings.filter((f) => f.code === "invalid-reference").map((f) => f.sectionId).sort()).toEqual(["empty", "load"]);
});

it("refuses a reference id that collides with a page", () => {
    const docs = fixture();
    docs.reference!.id = "guide";
    expect(validate(docs).map((f) => f.code)).toContain("duplicate-section-id");
});

it("colours reference samples from prepared tokens and adds a Copy button", async () => {
    const { prepareCode } = await import("./highlight.js");
    const docs = await prepareCode(fixture());
    const out = buildStatic(docs);
    const page = out["docs/reference/index.html"]!;
    // The Python quick start and the tabbed example are coloured.
    expect(page).toContain("<code>load<span class=\"dd-code-token--punctuation\">()</span></code>");
    expect(page).toContain('<button type="button" class="dd-ref-copy" hidden>');
    expect(page).toContain('<script src="/docs/reference.js" defer>');
    expect(out["docs/reference.js"]).toContain(".dd-ref-copy");
    // Stale tokens never replace the source.
    const sample = docs.reference!.code![0]!.samples[0]!;
    sample.code = "changed()";
    expect(buildStatic(docs)["docs/reference/index.html"]).toContain("<code>changed()</code>");
});
