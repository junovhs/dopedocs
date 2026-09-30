/**
 * Turning a captured screenshot into a DocImage.
 *
 * `dopedocs-shots` writes a manifest beside the pictures it takes: for each
 * shot, the file's real pixel size and every resized or WebP copy it made.
 * Reading dimensions and candidates from that manifest, instead of typing them
 * into the content, is what keeps a retaken picture and its declaration from
 * drifting apart. This module has no Node dependency, so content modules that
 * run in the browser can use it.
 */

import type { DocImage } from "./schema.js";

/** One shot as the capture tool recorded it. */
export interface ShotRecord {
    /** Public URL of the full-size PNG. */
    src: string;
    width: number;
    height: number;
    /** Resized PNG copies, narrowest first. */
    sizes: { width: number; height: number; src: string }[];
    /** WebP copies of the full size and each resized one, when made. */
    webp: { width: number; src: string }[];
}

/** What `dopedocs-shots` writes to `shots.json`: shot name to record. */
export type ShotManifest = Record<string, ShotRecord>;

/** The parts of a DocImage the author still writes: what it shows and how it sits. */
export type ShotImageOptions = Omit<DocImage, "src" | "width" | "height" | "srcset" | "sources">;

/**
 * A DocImage for a captured shot, with its size, responsive candidates and
 * WebP sources taken from the manifest. Throws on an unknown name, so a shot
 * removed from the capture list fails the build instead of shipping a broken
 * image.
 */
export function shotImage(
    manifest: ShotManifest,
    name: string,
    options: ShotImageOptions,
): DocImage {
    const shot = manifest[name];
    if (!shot) {
        throw new Error(
            `No shot named "${name}" in the manifest. Known: ${Object.keys(manifest).join(", ") || "none"}. ` +
                `Add it to the shots config and run dopedocs-shots.`,
        );
    }
    const candidates = (items: { width: number; src: string }[]) =>
        items.map((item) => `${item.src} ${item.width}w`).join(", ");
    const pngs = [...shot.sizes, { width: shot.width, src: shot.src }];
    return {
        src: shot.src,
        width: shot.width,
        height: shot.height,
        ...(shot.sizes.length ? { srcset: candidates(pngs) } : {}),
        ...(shot.webp.length
            ? { sources: [{ srcset: candidates(shot.webp), type: "image/webp" }] }
            : {}),
        ...options,
    };
}
