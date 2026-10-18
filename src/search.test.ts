import { expect, it } from "vitest";
import { createHost } from "./host.js";
import { createSearchIndex, renderSearch } from "./search.js";
import { defineDocs } from "./schema.js";
import { buildStatic } from "./static.js";

const docs = defineDocs({
    entity: { name: "Example", url: "https://example.com/product", notToBeConfusedWith: [] },
    title: "Manual", lead: "Read the manual.", facts: { cost: { value: "twenty", reviewed: "2026-10-18" } },
    sections: [{ id: "getting-ready", title: "Getting ready", children: [{
        id: "setup", title: "Setup", question: "How does setup work?", answer: "Setup takes {fact:cost} minutes.",
        keywords: ["configuration"], blocks: [
            { kind: "steps", items: [{ title: "Café", text: "Connect the violet cable." }] },
            { kind: "checklist", items: [{ text: "Power ready" }] },
            { kind: "details", summary: "Troubleshooting", text: "Check the amber lamp." },
            { kind: "table", head: ["Setting", "Value"], rows: [["Brightness", "Low"]] },
            { kind: "code", code: 'const unsafe = "</script>";' },
        ],
    }] }],
});

it("indexes resolved facts and widget text with chapter context", () => {
    const [entry] = createSearchIndex(docs, (id) => `/manual/${id}/`);
    expect(entry!.href).toBe("/manual/setup/");
    for (const text of ["Getting ready", "twenty", "configuration", "Café", "violet cable", "Power ready", "amber lamp", "Brightness", "const unsafe"]) expect(entry!.text).toContain(text);
    expect(entry!.text).not.toContain("{fact:");
});

it("escapes script-closing content inside the JSON index", () => {
    const html = renderSearch(createSearchIndex(docs, (id) => `/manual/${id}/`));
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).toContain('\\u003c/script>');
});

it("emits a standalone local script at the configured site path and supports no-script builds", () => {
    const out = buildStatic(docs, { basePath: "/guide", search: true });
    expect(out["guide/search.js"]).toContain("function mountSearch");
    expect(out["guide/setup/index.html"]).toContain('src="/product/guide/search.js" defer');
    expect(out["guide/setup/index.html"]).toContain('"href":"/product/guide/setup/"');
    const plain = buildStatic(docs, { search: false });
    expect(plain["docs/search.js"]).toBeUndefined();
    expect(plain["docs/setup/index.html"]).not.toContain("data-dd-search");
    expect(plain["docs/setup/index.html"]).toContain("Connect the violet cable.");
});

it("serves the search enhancement as JavaScript through development hosts", () => {
    let handler: Parameters<Parameters<ReturnType<typeof createHost>["serve"]>[0]["middlewares"]["use"]>[0];
    const host = createHost({ docs, search: true });
    host.serve({ middlewares: { use(value) { handler = value; } } });
    const headers: Record<string, string> = {};
    let body = "";
    handler!({ url: "/docs/search.js" }, { statusCode: 0, setHeader(key, value) { headers[key] = value; }, end(value) { body = value ?? ""; } }, () => { throw new Error("fell through"); });
    expect(headers["content-type"]).toBe("text/javascript; charset=utf-8");
    expect(body).toContain("mountSearch");
});
