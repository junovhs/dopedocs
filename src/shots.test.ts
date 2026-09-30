import { describe, expect, it } from "vitest";

import { shotImage, type ShotManifest } from "./shot-image.js";
import { defineShots, pngSize } from "./shots.js";

const manifest: ShotManifest = {
    hero: {
        src: "/docs-assets/hero.png",
        width: 1200,
        height: 800,
        sizes: [{ width: 600, height: 400, src: "/docs-assets/hero-600.png" }],
        webp: [
            { width: 600, src: "/docs-assets/hero-600.webp" },
            { width: 1200, src: "/docs-assets/hero.webp" },
        ],
    },
    plain: { src: "/docs-assets/plain.png", width: 300, height: 90, sizes: [], webp: [] },
};

describe("shotImage", () => {
    it("takes size, candidates and WebP sources from the manifest", () => {
        expect(shotImage(manifest, "hero", { alt: "The hero", caption: "Hi" })).toEqual({
            src: "/docs-assets/hero.png",
            width: 1200,
            height: 800,
            srcset: "/docs-assets/hero-600.png 600w, /docs-assets/hero.png 1200w",
            sources: [{ srcset: "/docs-assets/hero-600.webp 600w, /docs-assets/hero.webp 1200w", type: "image/webp" }],
            alt: "The hero",
            caption: "Hi",
        });
    });

    it("declares no candidates a shot does not have", () => {
        const image = shotImage(manifest, "plain", { alt: "Plain" });
        expect(image).toEqual({ src: "/docs-assets/plain.png", width: 300, height: 90, alt: "Plain" });
    });

    it("fails loudly on a shot the manifest does not know", () => {
        expect(() => shotImage(manifest, "gone", { alt: "x" })).toThrow(/No shot named "gone".*hero, plain/);
    });
});

describe("pngSize", () => {
    it("reads width and height from the IHDR chunk", () => {
        const bytes = new Uint8Array(24);
        const view = new DataView(bytes.buffer);
        view.setUint32(16, 1207);
        view.setUint32(20, 1330);
        expect(pngSize(bytes)).toEqual({ width: 1207, height: 1330 });
    });
});

describe("defineShots", () => {
    it("returns the config unchanged, for typing plain .mjs configs", () => {
        const config = { out: "public/docs-assets", shots: [{ name: "hero" }] };
        expect(defineShots(config)).toBe(config);
    });
});
