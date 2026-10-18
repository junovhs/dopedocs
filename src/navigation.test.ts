import { expect, it } from "vitest";
import { defineDocs, pagesOf, validate } from "./schema.js";
import { buildStatic } from "./static.js";

it("publishes nested manual pages with chapter context, progress and flat canonical destinations", () => {
    const page = (id: string) => ({ id, title: id, question: `What is ${id}?`, answer: `${id} explains a task.`, blocks: [] });
    const docs = defineDocs({
        entity: { name: "Manual", url: "https://example.com", notToBeConfusedWith: [] },
        title: "Manual", lead: "Learn the product.", facts: {},
        sections: [{ id: "chapter", title: "Chapter", children: [
            page("first"), { id: "topic", title: "Topic", children: [page("second"), page("third")] },
        ] }],
    });
    expect(validate(docs)).toEqual([]);
    expect(pagesOf(docs.sections).map(({ page, ancestors }) => [page.id, ancestors.map((group) => group.id)])).toEqual([
        ["first", ["chapter"]], ["second", ["chapter", "topic"]], ["third", ["chapter", "topic"]],
    ]);
    const out = buildStatic(docs);
    expect(out["docs/chapter/index.html"]).toBeUndefined();
    const html = out["docs/second/index.html"]!;
    expect(html).toContain("Chapter / Topic / Page 2 of 3");
    expect(html).toContain('value="2" max="3" aria-label="Manual reading progress"');
    expect(html).toContain('rel="prev" href="/docs/first/"');
    expect(html).toContain('rel="next" href="/docs/third/"');
    expect(html.match(/<details class="dd-nav-group" open>/g)).toHaveLength(2);
    expect(html).toContain('href="/docs/second/" aria-current="page"');
    expect(out["docs/index.html"]).toContain('<h2 class="dd-section-title">second</h2>');
});
