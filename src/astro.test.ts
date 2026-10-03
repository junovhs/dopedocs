import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { dopedocs } from "./astro.js";
import { defineDocs } from "./schema.js";

const docs = defineDocs({
    entity: {
        name: "Example",
        url: "https://example.com",
        tagline: "Example documentation.",
        notToBeConfusedWith: [],
    },
    title: "Example manual",
    lead: "Learn how Example works.",
    facts: {},
    sections: [
        {
            id: "start",
            title: "Get started",
            question: "How do I start?",
            answer: "Follow the first step.",
            blocks: [{ kind: "p", text: "Do the first thing." }],
        },
    ],
});

const directories: string[] = [];

afterEach(async () => {
    await Promise.all(
        directories.splice(0).map((d) => rm(d, { recursive: true, force: true })),
    );
});

/** An Astro project after its build: public files already copied into dist. */
const project = async () => {
    const root = await mkdtemp(join(tmpdir(), "dopedocs-astro-"));
    directories.push(root);
    const dist = join(root, "dist");
    const pub = join(root, "public");
    await mkdir(dist, { recursive: true });
    await mkdir(pub, { recursive: true });
    const robots = "User-agent: Ahrefsbot\nDisallow: /\n";
    const sitemap =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        "  <url><loc>https://example.com/pricing/</loc></url>\n" +
        "</urlset>\n";
    for (const dir of [dist, pub]) {
        await writeFile(join(dir, "robots.txt"), robots);
        await writeFile(join(dir, "sitemap.xml"), sitemap);
    }
    return { root, dist, pub };
};

/** Runs the hooks Astro calls for a build, in Astro's order. */
const build = async (integration: ReturnType<typeof dopedocs>, dist: string, pub: string) => {
    integration.hooks["astro:config:done"]({ config: { publicDir: pathToFileURL(`${pub}/`) } });
    await integration.hooks["astro:build:done"]({ dir: pathToFileURL(`${dist}/`) });
};

describe("Astro integration", () => {
    it("is named, and offers the hooks Astro calls", () => {
        const integration = dopedocs({ docs });
        expect(integration.name).toBe("dopedocs");
        expect(Object.keys(integration.hooks).sort()).toEqual([
            "astro:build:done",
            "astro:config:done",
            "astro:server:setup",
        ]);
    });

    it("writes the tree into the folder Astro built, merged with the site's files", async () => {
        const { dist, pub } = await project();
        await build(dopedocs({ docs, stylesheet: true }), dist, pub);

        const index = await readFile(join(dist, "docs/index.html"), "utf8");
        expect(index).toContain("Example manual");
        expect(index).toContain('href="/docs/dopedocs.css"');
        expect(await readFile(join(dist, "docs/start/index.html"), "utf8")).toContain(
            "Get started",
        );
        expect(await readFile(join(dist, "docs/dopedocs.css"), "utf8")).toContain("--dd-");

        const robots = await readFile(join(dist, "robots.txt"), "utf8");
        expect(robots).toContain("User-agent: Ahrefsbot");
        expect(robots).toContain("User-agent: Googlebot");

        const sitemap = await readFile(join(dist, "sitemap.xml"), "utf8");
        expect(sitemap).toContain("<loc>https://example.com/pricing/</loc>");
        expect(sitemap).toContain("<loc>https://example.com/docs/start/</loc>");
        expect(sitemap.match(/<\/urlset>/g)).toHaveLength(1);
    });

    it("produces the same output when built twice into the same folder", async () => {
        const { dist, pub } = await project();
        const integration = dopedocs({ docs });
        await build(integration, dist, pub);
        const once = await readFile(join(dist, "robots.txt"), "utf8");
        await build(integration, dist, pub);
        expect(await readFile(join(dist, "robots.txt"), "utf8")).toBe(once);
    });

    it("serves the pages from the dev server", () => {
        const handlers: ((req: { url?: string }, res: unknown, next: () => void) => void)[] = [];
        dopedocs({ docs }).hooks["astro:server:setup"]({
            server: { middlewares: { use: (h) => void handlers.push(h as never) } },
        });
        expect(handlers).toHaveLength(1);

        const res = { statusCode: 0, headers: {} as Record<string, string>, body: "" };
        const response = {
            set statusCode(code: number) {
                res.statusCode = code;
            },
            get statusCode() {
                return res.statusCode;
            },
            setHeader: (name: string, value: string) => void (res.headers[name] = value),
            end: (chunk?: string) => void (res.body = chunk ?? ""),
        };
        let passed = false;
        handlers[0]!({ url: "/docs/start/" }, response, () => (passed = true));
        expect(passed).toBe(false);
        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toBe("text/html; charset=utf-8");
        expect(res.body).toContain("Get started");

        handlers[0]!({ url: "/about/" }, response, () => (passed = true));
        expect(passed).toBe(true);
    });
});
