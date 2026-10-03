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
 *
 * Under Astro use `dopedocs/astro` instead: Astro runs Vite more than once with
 * outDirs of its own, so this plugin's `closeBundle` writes to the wrong place.
 */

import { resolve } from "node:path";

import { createHost, type DevServerLike, type DopedocsHostOptions } from "./host.js";

export { mergeCrawlerFile } from "./host.js";

interface ResolvedConfigLike {
    build?: { outDir?: string };
    root?: string;
    publicDir?: string | false;
    /** "build" or "serve"; anything but a real build must write nothing. */
    command?: string;
}

/** Everything the plugin accepts: a document, plus the static build's options. */
export type DopedocsPluginOptions = DopedocsHostOptions;

/**
 * Publishes a documentation set as static pages at build, and serves the same
 * pages in dev.
 */
export function dopedocs(options: DopedocsPluginOptions) {
    const host = createHost(options);
    let outDir = "dist";
    let root = process.cwd();
    let publicDir: string | false | undefined;
    let command: string | undefined;

    return {
        name: "dopedocs",
        // Runs after the consumer's own config, so outDir is the resolved one.
        configResolved(config: ResolvedConfigLike) {
            outDir = config.build?.outDir ?? "dist";
            root = config.root ?? process.cwd();
            publicDir = config.publicDir;
            command = config.command;
        },

        configureServer(server: DevServerLike) {
            host.serve(server);
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

            // Vite accepts both project-relative and absolute output paths.
            // `join(root, outDir, path)` treats even an absolute `outDir` as a
            // fragment, nesting `/tmp/site` below the project root. Resolve the
            // output root once so both forms have Vite's intended meaning.
            await host.write(
                resolve(root, outDir),
                publicDir ? resolve(root, publicDir) : undefined,
            );
        },
    };
}

export default dopedocs;
