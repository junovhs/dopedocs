import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defineDocs } from "./schema.js";
import { dopedocs } from "./vite.js";

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

const temporaryDirectories: string[] = [];

const temporaryDirectory = async (prefix: string): Promise<string> => {
    const directory = await mkdtemp(join(tmpdir(), prefix));
    temporaryDirectories.push(directory);
    return directory;
};

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

const runBuild = async (root: string, outDir: string) => {
    const plugin = dopedocs({ docs });
    plugin.configResolved({ root, command: "build", build: { outDir } });
    await plugin.closeBundle();
};

describe("Vite output directory resolution", () => {
    it("writes beneath an absolute outDir without nesting it under the project root", async () => {
        const root = await temporaryDirectory("dopedocs-project-");
        const output = await temporaryDirectory("dopedocs-output-");

        await runBuild(root, output);

        expect(await readFile(join(output, "docs/index.html"), "utf8")).toContain(
            "Example manual",
        );
        expect(await readFile(join(output, "robots.txt"), "utf8")).toContain("User-agent:");
        expect(await readFile(join(output, "sitemap.xml"), "utf8")).toContain(
            "https://example.com/docs/",
        );
        await expect(access(join(root, output, "docs/index.html"))).rejects.toThrow();
    });

    it("continues to resolve a relative outDir from the project root", async () => {
        const root = await temporaryDirectory("dopedocs-project-");

        await runBuild(root, "custom-dist");

        expect(await readFile(join(root, "custom-dist/docs/index.html"), "utf8")).toContain(
            "Example manual",
        );
    });
});

describe("Vite indexing pass-through", () => {
    it("writes noindex pages and an unadvertised sitemap when indexing is off", async () => {
        const root = await temporaryDirectory("dopedocs-project-");
        const plugin = dopedocs({ docs, indexing: "noindex" });
        plugin.configResolved({ root, command: "build", build: { outDir: "dist" } });
        await plugin.closeBundle();

        expect(await readFile(join(root, "dist/docs/start/index.html"), "utf8")).toContain(
            '<meta name="robots" content="noindex, nofollow">',
        );
        expect(await readFile(join(root, "dist/robots.txt"), "utf8")).not.toContain("Sitemap:");
    });
});

describe("Vite stylesheet basePath", () => {
    it("emits and links the bundled stylesheet under the effective override", async () => {
        const root = await temporaryDirectory("dopedocs-base-");
        const plugin = dopedocs({ docs: { ...docs, basePath: "docs" }, basePath: "/help/", stylesheet: [true, "/theme.css"] });
        plugin.configResolved({ root, command: "build", build: { outDir: "dist" } });
        await plugin.closeBundle();
        const html = await readFile(join(root, "dist/help/index.html"), "utf8");
        expect(html).toContain('href="/help/dopedocs.css"');
        expect(html.indexOf('/help/dopedocs.css')).toBeLessThan(html.indexOf('/theme.css'));
        expect(await readFile(join(root, "dist/help/dopedocs.css"), "utf8")).toContain('--dd-bg');
        await expect(access(join(root, "dist/docs/dopedocs.css"))).rejects.toThrow();
    });
});
