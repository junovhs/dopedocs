import { expect, it } from "vitest";
import { defineDocs, pagesOf, validate, type DocGroup, type DocSet } from "./schema.js";
import { buildStatic } from "./static.js";
import { renderBody } from "./render.js";
import { createSearchIndex } from "./search.js";
import { prepareMath } from "./math.js";
import { prepareCode } from "./highlight.js";

const page = (id: string) => ({ id, title: id, question: `What is ${id}?`, answer: `${id} explains a task.`, blocks: [] });
const fixture = (): DocSet => defineDocs({
    entity: { name: "Manual", url: "https://example.com", notToBeConfusedWith: [] },
    title: "Manual", lead: "Learn the product.", facts: {},
    sections: [page("before"), { id: "chapter", title: "Chapter label", landing: page("overview"), children: [
        page("first"), { id: "topic", title: "Topic label", landing: page("topic-overview"), children: [page("last")] },
    ] }],
});

it("publishes group landings once, before children, with linked labels, pager, breadcrumbs and machine outputs", () => {
    const docs = fixture();
    expect(validate(docs)).toEqual([]);
    expect(pagesOf(docs.sections).map(({ page }) => page.id)).toEqual(["before", "overview", "first", "topic-overview", "last"]);
    const out = buildStatic(docs, { search: true });
    const overview = out["docs/overview/index.html"]!;
    expect(overview).toBeDefined();
    expect(overview).toMatch(/<summary>[\s\S]*?<a class="dd-nav-link is-active" href="\/docs\/overview\/" aria-current="page">Chapter label<\/a><\/summary>/);
    expect(overview.match(/href="\/docs\/overview\/"/g)).toHaveLength(1);
    expect(overview).toContain('rel="prev" href="/docs/before/"');
    expect(overview).toContain('rel="next" href="/docs/first/"');
    expect(out["docs/first/index.html"]).toContain('rel="prev" href="/docs/overview/"');
    const last = out["docs/last/index.html"]!;
    const graph = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]!)['@graph'];
    const crumbs = (html: string) => graph(html).find((node: { '@type': string }) => node['@type'] === 'BreadcrumbList').itemListElement;
    expect(crumbs(last).map(({ name, item }: { name: string; item: string }) => [name, item])).toEqual([
        ['Manual', 'https://example.com/docs/'], ['Chapter label', 'https://example.com/docs/overview/'],
        ['Topic label', 'https://example.com/docs/topic-overview/'], ['last', 'https://example.com/docs/last/'],
    ]);
    expect(crumbs(overview)).toHaveLength(2);
    expect(out["sitemap.xml"]).toContain('https://example.com/docs/overview/');
    expect(out["llms.txt"]).toContain('https://example.com/docs/overview/');
    expect(JSON.parse(out["questions.json"]!).questions.filter((q: { id: string }) => q.id === "overview")).toHaveLength(1);
    expect(createSearchIndex(docs, id => `/docs/${id}/`).map(p => p.id)).toEqual(["before", "overview", "first", "topic-overview", "last"]);
    expect(renderBody(docs).match(/id="overview"/g)).toHaveLength(1);
    expect(out["docs/index.html"]!.match(/id="overview"/g)).toHaveLength(1);
});

it("validates landing content, links and globally unique ids, allowing a chapter with only its landing", () => {
    const docs = fixture();
    const chapter = docs.sections[1] as DocGroup;
    chapter.children = [];
    expect(validate(docs)).toEqual([]);
    chapter.landing!.answer = "";
    expect(validate(docs).map(f => f.code)).toContain("empty-answer");
    chapter.landing = page("before");
    expect(validate(docs).map(f => f.code)).toContain("duplicate-section-id");
    chapter.landing = { ...page("overview"), blocks: [{ kind: "p", text: "[Overview](section:overview) [Missing](section:missing) {fact:missing}" }] };
    expect(validate(docs).map(f => f.code)).toEqual(expect.arrayContaining(["unknown-section-link", "unknown-fact-reference"]));
});

it("prepares optional math and code blocks in landings without mutating authors' data", async () => {
    const docs = fixture();
    const chapter = docs.sections[1] as DocGroup;
    chapter.landing!.blocks = [{ kind: "math", tex: "x^2" }, { kind: "code", language: "js", code: "const x = 1;" }];
    const math = prepareMath(docs);
    expect(buildStatic(math)["docs/overview/index.html"]).toContain("<msup>");
    const code = await prepareCode(math);
    expect(buildStatic(code)["docs/overview/index.html"]).toContain('class="dd-code-token');
    expect(chapter.landing!.blocks[0]).not.toHaveProperty("prepared");
    expect(chapter.landing!.blocks[1]).not.toHaveProperty("tokens");
});
