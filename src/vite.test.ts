import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { build, createServer } from "vite";

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


describe("docs-only Vite sites", () => {
    it.each(["plugin", "document"])("builds and serves root docs with the %s basePath and no index.html", async (source) => {
        const root = await temporaryDirectory("dopedocs-only-");
        const config = {
            root,
            configFile: false as const,
            logLevel: "silent" as const,
            plugins: [dopedocs(source === "plugin"
                ? { docs, basePath: "/", stylesheet: true }
                : { docs: { ...docs, basePath: "/" }, stylesheet: true })],
        };

        await expect(access(join(root, "index.html"))).rejects.toThrow();
        await build(config);
        const html = await readFile(join(root, "dist/index.html"), "utf8");
        expect(html).toContain("Example manual");
        expect(html).toContain('href="/start/"');
        expect(html).toContain('href="/dopedocs.css"');
        expect(await readFile(join(root, "dist/start/index.html"), "utf8"))
            .toContain("Do the first thing.");

        const server = await createServer({ ...config, server: { host: "127.0.0.1", port: 0 } });
        try {
            await server.listen();
            const address = server.httpServer!.address();
            if (!address || typeof address === "string") throw new Error("Missing server port");
            const origin = `http://127.0.0.1:${address.port}`;
            for (const path of ["/", "/start/"]) {
                const response = await fetch(origin + path);
                expect(response.status).toBe(200);
                expect(await response.text()).toContain("Example manual");
            }
            expect((await fetch(`${origin}/dopedocs.css`)).status).toBe(200);
        } finally {
            await server.close();
        }
    });

    it("retains the host index and non-root docs setup", async () => {
        const root = await temporaryDirectory("dopedocs-host-");
        await writeFile(join(root, "index.html"), "<h1>Host application</h1>");
        await build({ root, configFile: false, logLevel: "silent", plugins: [dopedocs({ docs })] });
        expect(await readFile(join(root, "dist/index.html"), "utf8")).toContain("Host application");
        expect(await readFile(join(root, "dist/docs/index.html"), "utf8")).toContain("Example manual");
    });

    it("keeps an explicit build input for a root docs site", async () => {
        const root = await temporaryDirectory("dopedocs-input-");
        await writeFile(join(root, "worker.js"), 'console.log("Host worker");');
        await build({
            root,
            configFile: false,
            logLevel: "silent",
            plugins: [dopedocs({ docs: { ...docs, basePath: "/" } })],
            build: { rollupOptions: { input: join(root, "worker.js"), output: { entryFileNames: "worker.js" } } },
        });
        expect(await readFile(join(root, "dist/worker.js"), "utf8")).toContain("Host worker");
        expect(await readFile(join(root, "dist/index.html"), "utf8")).toContain("Example manual");
    });
});


it("still bundles an existing host index when docs own the root", async () => {
    const root = await temporaryDirectory("dopedocs-root-host-");
    await writeFile(join(root, "index.html"), '<script type="module" src="/main.js"></script>');
    await writeFile(join(root, "main.js"), 'console.log("Host entry");');
    await build({
        root,
        configFile: false,
        logLevel: "silent",
        plugins: [dopedocs({ docs, basePath: "/" })],
        build: { rollupOptions: { output: { entryFileNames: "host.js" } } },
    });
    expect(await readFile(join(root, "dist/host.js"), "utf8")).toContain("Host entry");
    expect(await readFile(join(root, "dist/index.html"), "utf8")).toContain("Example manual");
});


it.each(["library", "ssr"])("preserves a %s entry without host HTML", async (mode) => {
    const root = await temporaryDirectory("dopedocs-special-build-");
    const entry = join(root, "entry.js");
    await writeFile(entry, 'export const hostValue = "Host export";');
    await build({
        root,
        configFile: false,
        logLevel: "silent",
        plugins: [dopedocs({ docs, basePath: "/" })],
        build: {
            ...(mode === "library" ? { lib: { entry, formats: ["es" as const] } } : { ssr: entry }),
            rollupOptions: { output: { entryFileNames: "host.mjs" } },
        },
    });
    expect(await readFile(join(root, "dist/host.mjs"), "utf8")).toContain("Host export");
});
