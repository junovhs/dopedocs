/**
 * The Vite plugin.
 *
 * One line in `vite.config.ts` gets the whole static surface: a real page per
 * section in the build output, and the same pages served in dev so a developer
 * sees what will deploy rather than something only the build produces.
 *
 * Per DEC-06 this must work for a consumer who has only the installed package —
 * nothing here reads the dopedocs source tree or resolves paths relative to this
 * repository.
 */

import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import type { DocSet } from "./schema.js";
import { InvalidDocumentError, buildStatic, type BuildStaticOptions } from "./static.js";

/** The subset of Vite's plugin surface this uses, declared structurally so the
 * package needs no `vite` dependency at runtime or at type-check time. */
interface ViteServerLike {
    middlewares: {
        use(handler: (req: IncomingLike, res: ServerResponseLike, next: () => void) => void): void;
    };
}
interface IncomingLike {
    url?: string;
}
interface ServerResponseLike {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(chunk?: string): void;
}
interface ResolvedConfigLike {
    build?: { outDir?: string };
    root?: string;
    publicDir?: string | false;
}

/** Everything the plugin accepts: a document, plus the static build's options. */
export interface DopedocsPluginOptions extends Omit<BuildStaticOptions, "stylesheet"> {
    /** The documentation set to publish. */
    docs: DocSet;
    /**
     * Styling for the static pages.
     *
     * `true` emits dopedocs' own stylesheet beside the pages and links it —
     * the right default, because a consumer who passes only an href gets pages
     * that quietly render unstyled if nothing else emits that file. A string is
     * an href you are emitting yourself; omitting it leaves the pages unstyled.
     */
    stylesheet?: string | true;
}

/** Files that merge with a consumer's own copy rather than replacing it. */
const MERGED = new Set(["robots.txt", "sitemap.xml"]);

/**
 * Joins two robots or sitemap documents.
 *
 * A consumer who already maintains one of these has rules dopedocs knows
 * nothing about, so replacing the file would silently drop them. Sitemaps merge
 * inside the single `<urlset>` element an XML sitemap is allowed to have.
 */
export function mergeCrawlerFile(name: string, existing: string, generated: string): string {
    if (!existing.trim()) return generated;
    if (name === "robots.txt") {
        return `${existing.trimEnd()}\n\n# --- dopedocs ---\n${generated}`;
    }
    const entries = generated.slice(
        generated.indexOf("<url>"),
        generated.lastIndexOf("</url>") + "</url>".length,
    );
    if (!entries) return existing;
    const close = existing.lastIndexOf("</urlset>");
    if (close === -1) return generated;
    return `${existing.slice(0, close)}${entries}\n${existing.slice(close)}`;
}

/**
 * Publishes a documentation set as static pages at build, and serves the same
 * pages in dev.
 */
export function dopedocs(options: DopedocsPluginOptions) {
    const { docs, stylesheet, ...rest } = options;
    const basePath = (docs.basePath ?? "docs").replace(/^\/+|\/+$/g, "");
    /** Where the bundled sheet lands when the plugin emits it. */
    const ownSheetPath = `${basePath}/dopedocs.css`;
    const buildOptions: BuildStaticOptions = {
        ...rest,
        stylesheet: stylesheet === true ? `/${ownSheetPath}` : stylesheet,
    };
    let outDir = "dist";
    let root = process.cwd();
    let publicDir: string | false | undefined;
    /** The bundled sheet, read once and reused across dev requests. */
    let ownSheet: string | undefined;

    /** Builds the tree, turning a document fault into a readable build failure. */
    const build = (): Record<string, string> => {
        try {
            return buildStatic(docs, buildOptions);
        } catch (error) {
            if (error instanceof InvalidDocumentError) {
                // Named sections and rules, so the message says what to fix
                // rather than only that something is wrong.
                throw new Error(`[dopedocs] ${error.message}`);
            }
            throw error;
        }
    };

    return {
        name: "dopedocs",
        // Runs after the consumer's own config, so outDir is the resolved one.
        configResolved(config: ResolvedConfigLike) {
            outDir = config.build?.outDir ?? "dist";
            root = config.root ?? process.cwd();
            publicDir = config.publicDir;
        },

        configureServer(server: ViteServerLike) {
            // Generated per request rather than once, so editing the content
            // module is reflected on reload without restarting the server.
            server.middlewares.use((req, res, next) => {
                const path = (req.url ?? "").split("?")[0] ?? "";
                let tree: Record<string, string>;
                try {
                    tree = build();
                    if (stylesheet === true) {
                        tree[ownSheetPath] = ownSheet ??= readFileSync(
                            fileURLToPath(new URL("../styles/dopedocs.css", import.meta.url)),
                            "utf8",
                        );
                    }
                } catch (error) {
                    res.statusCode = 500;
                    res.setHeader("content-type", "text/plain; charset=utf-8");
                    return res.end((error as Error).message);
                }

                const candidates = [
                    path.replace(/^\//, ""),
                    posix.join(path.replace(/^\//, ""), "index.html"),
                ];
                for (const candidate of candidates) {
                    const body = tree[candidate];
                    if (body === undefined) continue;
                    res.statusCode = 200;
                    res.setHeader(
                        "content-type",
                        candidate.endsWith(".css")
                            ? "text/css; charset=utf-8"
                            : candidate.endsWith(".xml")
                            ? "application/xml; charset=utf-8"
                            : candidate.endsWith(".json")
                              ? "application/json; charset=utf-8"
                              : candidate.endsWith(".html")
                                ? "text/html; charset=utf-8"
                                : "text/plain; charset=utf-8",
                    );
                    return res.end(body);
                }
                next();
            });
        },

        async closeBundle() {
            const tree = build();
            if (stylesheet === true) {
                // Read from the installed package, never from a source checkout
                // (DEC-06): this path resolves inside node_modules for a real
                // consumer.
                tree[ownSheetPath] = await readFile(
                    fileURLToPath(new URL("../styles/dopedocs.css", import.meta.url)),
                    "utf8",
                );
            }
            for (const [path, contents] of Object.entries(tree)) {
                const target = join(root, outDir, path);
                await mkdir(dirname(target), { recursive: true });

                let body = contents;
                if (MERGED.has(path)) {
                    // The consumer's own file may have been copied from publicDir
                    // into the output, or may still be sitting in publicDir when
                    // the copy has not happened yet.
                    for (const source of [
                        target,
                        publicDir ? join(root, publicDir as string, path) : null,
                    ]) {
                        if (!source) continue;
                        try {
                            body = mergeCrawlerFile(path, await readFile(source, "utf8"), body);
                            break;
                        } catch {
                            // No existing file here; try the next location.
                        }
                    }
                }
                await writeFile(target, body, "utf8");
            }
        },
    };
}

export default dopedocs;
