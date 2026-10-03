/**
 * What every build host does with the static tree.
 *
 * The Vite plugin and the Astro integration differ only in which hooks they
 * listen on and where the output folder comes from. Building the tree,
 * emitting dopedocs' own stylesheet, serving it in dev and writing it beside
 * the site's own files are the same work, so they live here once.
 *
 * Per DEC-06 nothing here reads the dopedocs source tree: the stylesheet is
 * resolved relative to this module, which is inside node_modules for a real
 * consumer.
 */

import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import type { DocSet } from "./schema.js";
import { InvalidDocumentError, buildStatic, type BuildStaticOptions } from "./static.js";

/** Everything a host accepts: a document, plus the static build's options. */
export interface DopedocsHostOptions extends Omit<BuildStaticOptions, "stylesheet"> {
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

/** The subset of a Connect-style dev server this uses, declared structurally. */
export interface DevServerLike {
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

/** The bundled stylesheet's location inside the installed package. */
const OWN_SHEET_URL = new URL("../styles/dopedocs.css", import.meta.url);

/**
 * A host's view of one documentation set: how to build its tree, serve it in
 * dev, and write it into an output folder.
 */
export function createHost(options: DopedocsHostOptions) {
    const { docs, stylesheet, ...rest } = options;
    const basePath = (docs.basePath ?? "docs").replace(/^\/+|\/+$/g, "");
    /** Where the bundled sheet lands when the host emits it. */
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
    /** The bundled sheet, read once and reused across dev requests. */
    let ownSheet: string | undefined;

    /** Builds the tree, turning a document fault into a readable build failure. */
    const build = (): Record<string, string> => {
        let tree: Record<string, string>;
        try {
            tree = buildStatic(docs, buildOptions);
        } catch (error) {
            if (error instanceof InvalidDocumentError) {
                // Named sections and rules, so the message says what to fix
                // rather than only that something is wrong.
                throw new Error(`[dopedocs] ${error.message}`);
            }
            throw error;
        }
        if (emitsOwnSheet) {
            tree[ownSheetPath] = ownSheet ??= readFileSync(fileURLToPath(OWN_SHEET_URL), "utf8");
        }
        return tree;
    };

    /**
     * Serves the tree per request. Generated per request rather than once, so
     * editing the content module is reflected on reload without restarting
     * the server.
     */
    const serve = (server: DevServerLike) => {
        server.middlewares.use((req, res, next) => {
            const path = (req.url ?? "").split("?")[0] ?? "";
            let tree: Record<string, string>;
            try {
                tree = build();
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
    };

    /**
     * Writes the tree under `outputRoot`, an absolute folder. `publicRoot`, also
     * absolute, is where the site keeps its own robots.txt and sitemap.xml
     * before they are copied into the output.
     */
    const write = async (outputRoot: string, publicRoot?: string) => {
        const tree = build();
        for (const [path, contents] of Object.entries(tree)) {
            const target = join(outputRoot, path);
            await mkdir(dirname(target), { recursive: true });

            let body = contents;
            if (MERGED.has(path)) {
                // The consumer's own file may have been copied from the public
                // folder into the output, or may still be sitting there when
                // the copy has not happened yet.
                for (const source of [target, publicRoot ? join(publicRoot, path) : null]) {
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
    };

    return { build, serve, write };
}
