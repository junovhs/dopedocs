/** Optional image enhancement. Import only from dopedocs/zoom. */
import PhotoSwipeLightbox from "photoswipe/lightbox";

export interface ImageZoomOptions {
    /** Real dimensions of the linked original when it differs from the image src.
     * Return undefined to keep that image as an ordinary link. */
    dimensions?: (link: HTMLAnchorElement, image: HTMLImageElement) =>
        { width: number; height: number } | undefined;
}
export interface ImageZoomHandle { destroy(): void; }

/** Enhance linked images within target as one gallery. Unknown dimensions keep
 * their ordinary link behavior. Call after images load if relying on natural size.
 * Destroy this handle before removing its panel or target. */
export function mountImageZoom(target: HTMLElement, options: ImageZoomOptions = {}): ImageZoomHandle {
    const sizes = new Map<HTMLAnchorElement, { width: number; height: number }>();
    for (const link of target.querySelectorAll<HTMLAnchorElement>("a.dd-media-link")) {
        const image = link.querySelector("img");
        if (!image || !/^https?:$/.test(new URL(link.href).protocol)) continue;
        const size = options.dimensions ? options.dimensions(link, image) : (link.href === image.src ? {
            width: Number(image.getAttribute("width")) || image.naturalWidth,
            height: Number(image.getAttribute("height")) || image.naturalHeight,
        } : undefined);
        if (size && [size.width, size.height].every((v) => Number.isInteger(v) && v > 0)) sizes.set(link, size);
    }
    if (!sizes.size) return { destroy() {} };

    // A second native modal works above the panel's top layer as well as on a
    // static page. Its inertness prevents the underlying manual taking focus.
    const portal = target.ownerDocument.createElement("dialog");
    portal.className = "dd-zoom-dialog";
    portal.setAttribute("aria-label", "Image viewer");
    target.ownerDocument.body.appendChild(portal);
    let opener: HTMLElement | null = null;
    const lightbox = new PhotoSwipeLightbox({
        gallery: target,
        children: [...sizes.keys()],
        appendToEl: portal,
        returnFocus: false,
        pswpModule: () => import("photoswipe"),
    });
    lightbox.addFilter("domItemData", (data, _element, link) => ({
        ...data,
        ...sizes.get(link),
        alt: link.querySelector("img")?.alt ?? "",
    }));
    const rememberOpener = (event: MouseEvent) => {
        const link = (event.target as Element).closest<HTMLAnchorElement>("a.dd-media-link");
        if (link && sizes.has(link)) opener = link;
    };
    lightbox.on("beforeOpen", () => portal.showModal());
    lightbox.on("destroy", () => {
        portal.close();
        if (opener?.isConnected) opener.focus();
    });
    const cancel = (event: Event) => { event.preventDefault(); lightbox.pswp?.close(); };
    const keydown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            lightbox.pswp?.close();
        }
    };
    portal.addEventListener("cancel", cancel);
    portal.addEventListener("keydown", keydown);
    target.addEventListener("click", rememberOpener, true);
    lightbox.init();
    let destroyed = false;
    return { destroy() {
        if (destroyed) return;
        destroyed = true;
        lightbox.destroy();
        target.removeEventListener("click", rememberOpener, true);
        portal.removeEventListener("cancel", cancel);
        portal.removeEventListener("keydown", keydown);
        portal.remove();
    } };
}
