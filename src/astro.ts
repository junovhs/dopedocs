/**
 * The Astro integration.
 *
 * Astro builds with Vite, but the Vite plugin is the wrong tool there. Astro
 * runs Vite more than once per build — a server pass and a client pass — each
 * with an internal `outDir` of Astro's choosing, so a plugin that writes in
 * `closeBundle` writes the docs into the wrong folder, twice. The site's real
 * output only exists once Astro says the build is done, so that is when this
 * writes.
 *
 * ```ts
 * // astro.config.mjs
 * import dopedocs from "dopedocs/astro";
 * export default defineConfig({ integrations: [dopedocs({ docs, stylesheet: true })] });
 * ```
 *
 * Per DEC-06 the package needs no `astro` dependency: the hooks are declared
 * structurally, and the object returned is a valid `AstroIntegration`.
 */

import { fileURLToPath } from "node:url";

import { createHost, type DevServerLike, type DopedocsHostOptions } from "./host.js";

/** Everything the integration accepts: a document, plus the static build's options. */
export type DopedocsAstroOptions = DopedocsHostOptions;

/** The part of Astro's resolved config this reads. */
interface AstroConfigLike {
    publicDir?: URL;
}

/**
 * Publishes a documentation set into Astro's build output, merging robots.txt
 * and sitemap.xml with the site's own, and serves the same pages in dev.
 */
export function dopedocs(options: DopedocsAstroOptions) {
    const host = createHost(options);
    let publicDir: URL | undefined;

    return {
        name: "dopedocs",
        hooks: {
            "astro:config:done": ({ config }: { config: AstroConfigLike }) => {
                publicDir = config.publicDir;
            },

            // Astro's dev server is a Vite dev server; the pages are built per
            // request, so editing the content shows on reload.
            "astro:server:setup": ({ server }: { server: DevServerLike }) => {
                host.serve(server);
            },

            // `dir` is the folder Astro deployed to — for a static site its
            // `outDir`, for a server build the client folder a host serves as
            // static files. The site's public files are already copied in, so
            // the merge finds its robots.txt and sitemap.xml there.
            "astro:build:done": async ({ dir }: { dir: URL }) => {
                await host.write(
                    fileURLToPath(dir),
                    publicDir ? fileURLToPath(publicDir) : undefined,
                );
            },
        },
    };
}

export default dopedocs;
