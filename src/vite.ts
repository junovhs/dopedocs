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
import { dirname, join, posix, resolve } from "node:path";
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
    /** "build" or "serve"; anything but a real build must write nothing. */
    command?: string;
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
    stylesheet?: string | true | (string | true)[];
}

/** Files that merge with a consumer's own copy rather than replacing it. */
const MERGED = new Set(["robots.txt", "sitemap.xml"]);

/** Marks where dopedocs' own robots rules begin, so a re-merge replaces them. */
const ROBOTS_MARKER = "# --- dopedocs ---";

/** A `User-agent: *` line: the consumer already rules every crawler not named. */
const WILDCARD_AGENT = /^[ \t]*user-agent[ \t]*:[ \t]*\*[ \t]*(#.*)?$/im;

/** A `Sitemap:` line: the consumer already tells crawlers where their sitemap is. */
const SITEMAP_LINE = /^[ \t]*sitemap[ \t]*:/im;

/**
 * dopedocs' robots rules, less what the consumer's own file already says.
 *
 * The generated file ends with a `User-agent: *` group and a `Sitemap:` line so
 * it stands alone. Beside a consumer's file that has its own wildcard group,
 * ours would be a second group for the same crawlers, which robots.txt parsers
 * resolve inconsistently; and the sitemap dopedocs merges into is the one their
 * line already names. Named search and training groups are always kept: those
 * are the policy dopedocs exists to state.
 */
function robotsBesides(theirs: string, generated: string): string {
    const dropWildcard = WILDCARD_AGENT.test(theirs);
    const dropSitemap = SITEMAP_LINE.test(theirs);
    if (!dropWildcard && !dropSitemap) return generated;

    const records = generated.trimEnd().split(/\n[ \t]*\n/);
    const kept = records
        .map((record) =>
            dropSitemap
                ? record
                      .split("\n")
                      .filter((line) => !SITEMAP_LINE.test(line))
                      .join("\n")
                : record,
        )
        .filter((record) => {
            if (!record.trim()) return false;
            if (!dropWildcard) return true;
            const agents = record
                .split("\n")
                .filter((line) => /^[ \t]*user-agent[ \t]*:/i.test(line));
            return !(agents.length && agents.every((line) => WILDCARD_AGENT.test(line)));
        });
    return `${kept.join("\n\n")}\n`;
}

/** One `<url>…</url>` entry, non-greedy, with any whitespace before it. */
const URL_ENTRY = /\s*<url>[\s\S]*?<\/url>/g;

const LOCATION = /<loc>([^<]*)<\/loc>/;

/** Every URL a sitemap fragment names. */
const locationsIn = (xml: string): string[] =>
    [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]!);

/**
 * Joins two robots or sitemap documents.
 *
 * A consumer who already maintains one of these has rules dopedocs knows
 * nothing about, so replacing the file would silently drop them. Sitemaps merge
 * inside the single `<urlset>` element an XML sitemap is allowed to have.
 *
 * Merging is idempotent, because the existing file is often dopedocs' own
 * previous output: a build into an `outDir` that was not emptied reads back
 * what the last build wrote. Appending there would repeat every rule and every
 * entry, once per build, which is exactly what it used to do.
 */
export function mergeCrawlerFile(name: string, existing: string, generated: string): string {
    if (!existing.trim()) return generated;

    if (name === "robots.txt") {
        // Everything from the marker on is a previous build's work, so it is
        // replaced rather than appended to.
        const at = existing.indexOf(ROBOTS_MARKER);
        const theirs = (at === -1 ? existing : existing.slice(0, at)).trimEnd();
        // Only the consumer's part decides what of ours is redundant, so a
        // re-merge sees the same input and produces the same bytes.
        return theirs
            ? `${theirs}\n\n${ROBOTS_MARKER}\n${robotsBesides(theirs, generated)}`
            : generated;
    }

    const entries = generated.slice(
        generated.indexOf("<url>"),
        generated.lastIndexOf("</url>") + "</url>".length,
    );
    if (!entries) return existing;

    // Drop any entry the existing file already has for a URL we are about to
    // write — which, on a re-merge, is every entry we wrote last time. A
    // consumer's own entries name other URLs and are left exactly as they are.
    const ours = new Set(locationsIn(entries));
    const deduped = existing.replace(URL_ENTRY, (block) => {
        const loc = block.match(LOCATION)?.[1];
        return loc !== undefined && ours.has(loc) ? "" : block;
    });

    const close = deduped.lastIndexOf("</urlset>");
    if (close === -1) return generated;
    // The head is normalised to end in exactly one newline, so a second merge
    // reproduces the first byte for byte rather than drifting whitespace.
    const head = deduped.slice(0, close).replace(/\s*$/, "\n");
    return `${head}${entries}\n${deduped.slice(close)}`;
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
    const sheets = stylesheet === undefined ? [] : [stylesheet].flat();
    /** True when dopedocs must emit its own sheet as well as link it. */
    const emitsOwnSheet = sheets.includes(true);
    const buildOptions: BuildStaticOptions = {
        ...rest,
        // Order is preserved, so a consumer's alias sheet listed after `true`
        // overrides the tokens dopedocs' own sheet defines.
        stylesheet: sheets.map((s) => (s === true ? `/${ownSheetPath}` : s)),
    };
    let outDir = "dist";
    let root = process.cwd();
    let publicDir: string | false | undefined;
    let command: string | undefined;
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
            command = config.command;
        },

        configureServer(server: ViteServerLike) {
            // Generated per request rather than once, so editing the content
            // module is reflected on reload without restarting the server.
            server.middlewares.use((req, res, next) => {
                const path = (req.url ?? "").split("?")[0] ?? "";
                let tree: Record<string, string>;
                try {
                    tree = build();
                    if (emitsOwnSheet) {
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
            // Only a real build writes files. `closeBundle` fires in any Vite
            // pipeline that resolves this config, and a test runner is one:
            // Vitest resolves it with `command: "serve"` and `build.outDir` set
            // to the sentinel "dummy-non-existing-folder", so without this
            // guard `vitest run` scattered a whole copy of the documentation
            // site into the consumer's project root on every test run. The
            // command is the honest discriminator; the sentinel's name is not
            // a contract. Dev is served per request by `configureServer`, which
            // writes nothing, so nothing is lost by staying quiet there too.
            if (command !== "build") return;

            const tree = build();
            // Vite accepts both project-relative and absolute output paths.
            // `join(root, outDir, path)` treats even an absolute `outDir` as a
            // fragment, nesting `/tmp/site` below the project root. Resolve the
            // output root once so both forms have Vite's intended meaning.
            const outputRoot = resolve(root, outDir);
            if (emitsOwnSheet) {
                // Read from the installed package, never from a source checkout
                // (DEC-06): this path resolves inside node_modules for a real
                // consumer.
                tree[ownSheetPath] = await readFile(
                    fileURLToPath(new URL("../styles/dopedocs.css", import.meta.url)),
                    "utf8",
                );
            }
            for (const [path, contents] of Object.entries(tree)) {
                const target = join(outputRoot, path);
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
