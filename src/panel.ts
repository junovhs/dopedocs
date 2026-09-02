/**
 * The in-app documentation panel.
 *
 * Three behaviours matter here, and each replaces something that was wrong in
 * the hand-built version this is extracted from:
 *
 * - **Folders** are native `<details>`/`<summary>`, so disclosure semantics,
 *   keyboard handling and assistive-technology support come from the platform.
 * - **Scrollspy resolves from scroll position, not intersection.** An
 *   `IntersectionObserver` with a read band near the top of the viewport can
 *   never activate a final section shorter than the remaining scroll, because
 *   that section's top never reaches the band and there is nothing left to
 *   scroll. Position plus an explicit end clamp can say "at the bottom, the
 *   last section is what you are reading", which an observer cannot express.
 * - **The URL is part of the document** (DEC-04). Opening pushes the docs path,
 *   scrolling replaces the section path, and Back returns where the reader came
 *   from — so a section read inside the app has the same address a crawler
 *   indexed.
 */

import { escapeHtml, renderBody, renderLead } from "./render.js";
import type { DocSection, DocSet } from "./schema.js";

export interface PanelOptions {
    /** Path the docs live at. Defaults to the document's own, else `/docs`. */
    basePath?: string;
    /** Keep the address bar in step with the panel. Default true. */
    syncUrl?: boolean;
    /** Heading above the rail. Default "Contents". */
    navLabel?: string;
    /** Label on the close control. Default "Back". */
    backLabel?: string;
    /** Called after the panel opens or closes. */
    onToggle?: (open: boolean) => void;
}

export interface PanelHandle {
    /** Opens the panel, optionally scrolled to a section. */
    open(sectionId?: string): void;
    close(): void;
    /** Removes the panel and every listener it registered. */
    destroy(): void;
    readonly isOpen: boolean;
    /** The section currently being read, or null while closed. */
    readonly activeId: string | null;
}

/** Fraction of the viewport height at which a section counts as being read. */
const READ_LINE = 0.25;

/** Slack in pixels when deciding the scroll container is at its end. */
const END_SLACK = 2;

const trimSlashes = (s: string) => s.replace(/^\/+|\/+$/g, "");

/** Flattens the tree in reading order. */
function flatten(sections: DocSection[]): DocSection[] {
    return sections.flatMap((s) => [s, ...flatten(s.children ?? [])]);
}

/**
 * Resolves which section is being read from scroll position.
 *
 * The end clamp is the whole point. Without it a short final section is
 * unreachable: its top never crosses the read line because the container runs
 * out of scroll first, so the last rail item can never light up. At the bottom
 * of the document the last section is what you are reading, by definition.
 */
export function activeSectionId(
    container: HTMLElement,
    sections: HTMLElement[],
): string | null {
    if (sections.length === 0) return null;

    const atEnd =
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - END_SLACK;
    if (atEnd) return sections[sections.length - 1]!.id;

    // Measured against the container's own viewport rather than via offsetTop.
    // A section's offsetParent is the positioned shell, not the scrolling
    // element, so offsetTop carries the height of everything above the scroll
    // container — the bar — and comparing it to scrollTop is silently wrong by
    // that much, which reads as the rail lagging one section behind.
    const line = container.getBoundingClientRect().top + container.clientHeight * READ_LINE;
    let id = sections[0]!.id;
    for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) id = section.id;
    }
    return id;
}

/** A section's top in its scroll container's coordinates. */
function offsetWithin(container: HTMLElement, el: HTMLElement): number {
    return (
        el.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop
    );
}

/** Mounts the panel into `target` and returns a handle for controlling it. */
export function mountPanel(
    target: HTMLElement,
    docs: DocSet,
    options: PanelOptions = {},
): PanelHandle {
    const {
        syncUrl = true,
        navLabel = "Contents",
        backLabel = "Back",
        onToggle,
    } = options;

    const basePath = `/${trimSlashes(options.basePath ?? docs.basePath ?? "docs")}`;
    const ordered = flatten(docs.sections);
    const knownIds = new Set(ordered.map((s) => s.id));

    let open = false;
    let activeId: string | null = null;
    /** The group we last auto-expanded, so a manual collapse is not fought. */
    let expandedFor: string | null = null;
    /**
     * Groups this code opened, awaiting their `toggle` event.
     *
     * `toggle` fires for a programmatic `open = true` exactly as it does for a
     * click, and the handler navigates on open — so without this, expanding a
     * folder because the reader scrolled into its child would immediately scroll
     * them back out to the parent. The event is queued rather than synchronous,
     * so a plain boolean would already have been reset by the time it arrives.
     */
    const autoExpanded = new Set<string>();
    /**
     * A section the reader explicitly asked for, held active until they scroll.
     *
     * Near the end of the document the end clamp is right about what is on
     * screen but wrong about what was asked for: a section in the last
     * viewport cannot be scrolled to the read line, so following a deep link to
     * one would light up the final section instead of the requested one. The
     * pin is released by a real scroll gesture, not by the programmatic scroll
     * that navigation itself causes.
     */
    let pinned: string | null = null;
    let opener: HTMLElement | null = null;
    /** The URL the reader was on before the panel opened. */
    let entryUrl = "";
    let ticking = false;

    /* --- markup ---------------------------------------------------------- */

    const link = (s: DocSection) =>
        `<a class="dd-nav-link" href="${escapeHtml(basePath)}/${escapeHtml(
            s.id,
        )}/" data-dd-link="${escapeHtml(s.id)}">${escapeHtml(s.title)}</a>`;

    const railItem = (s: DocSection): string => {
        if (!s.children?.length) return `<li>${link(s)}</li>`;
        // The summary both toggles and, when it opens, navigates — so a folder
        // behaves like the section it actually is, while collapsing stays a
        // pure "I am done here" gesture that moves nothing.
        return (
            `<li><details class="dd-nav-group" data-dd-group="${escapeHtml(s.id)}">` +
            `<summary data-dd-link="${escapeHtml(s.id)}">${escapeHtml(s.title)}</summary>` +
            `<ul class="dd-nav-list">${s.children.map(railItem).join("")}</ul>` +
            `</details></li>`
        );
    };

    const root = document.createElement("div");
    root.className = "dd-overlay";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", docs.title);
    root.innerHTML =
        `<div class="dd-shell">` +
        `<div class="dd-bar">` +
        `<button type="button" class="dd-back" data-dd-close>${escapeHtml(backLabel)}</button>` +
        `<span class="dd-bar-page">${escapeHtml(docs.title)}</span>` +
        `<span class="dd-esc">Esc</span>` +
        `</div>` +
        `<div class="dd-body">` +
        `<nav class="dd-nav" aria-label="${escapeHtml(navLabel)}">` +
        `<p class="dd-nav-label">${escapeHtml(navLabel)}</p>` +
        `<ul class="dd-nav-list">${docs.sections.map(railItem).join("")}</ul>` +
        `</nav>` +
        `<main class="dd-main">${renderLead(docs)}${renderBody(docs)}</main>` +
        `</div></div>`;
    target.appendChild(root);

    const body = root.querySelector<HTMLElement>(".dd-body")!;
    const back = root.querySelector<HTMLButtonElement>(".dd-back")!;
    const sectionEls = [...root.querySelectorAll<HTMLElement>(".dd-section[id]")];
    const navLinks = [...root.querySelectorAll<HTMLElement>("[data-dd-link]")];
    const groups = [...root.querySelectorAll<HTMLDetailsElement>("[data-dd-group]")];

    /* --- url ------------------------------------------------------------- */

    const urlFor = (id?: string) => (id ? `${basePath}/${id}/` : `${basePath}/`);

    const replaceUrl = (id: string) => {
        if (!syncUrl) return;
        history.replaceState({ dopedocs: id }, "", urlFor(id));
    };

    /** The section named by a path, or undefined when the path is not ours. */
    function sectionFromPath(pathname: string): string | undefined | null {
        const base = trimSlashes(basePath);
        const parts = trimSlashes(pathname).split("/");
        const baseParts = base.split("/");
        if (baseParts.some((p, i) => parts[i] !== p)) return undefined;
        const id = parts[baseParts.length];
        return id && knownIds.has(id) ? id : null;
    }

    /* --- rail state ------------------------------------------------------ */

    function setActive(id: string | null): void {
        if (id === activeId) return;
        activeId = id;
        for (const el of navLinks) {
            el.classList.toggle("is-active", el.dataset.ddLink === id);
        }
        // Expand the folder containing the newly active section. Keyed on the
        // group rather than fired every tick, so a reader who collapses a group
        // is not fought until they navigate into it again.
        for (const group of groups) {
            const holds = [...group.querySelectorAll("[data-dd-link]")].some(
                (el) => (el as HTMLElement).dataset.ddLink === id,
            );
            if (holds && !group.open && expandedFor !== group.dataset.ddGroup) {
                const gid = group.dataset.ddGroup ?? null;
                if (gid) autoExpanded.add(gid);
                group.open = true;
                expandedFor = gid;
            }
        }
        if (id) replaceUrl(id);
    }

    function syncActive(): void {
        if (pinned) return;
        setActive(activeSectionId(body, sectionEls));
    }

    /** A real scroll gesture releases the pin; a programmatic scroll does not. */
    const onUserScroll = () => {
        pinned = null;
    };

    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            syncActive();
        });
    };

    function scrollTo(id: string, smooth = false): void {
        const el = root.querySelector<HTMLElement>(`.dd-section[id="${CSS.escape(id)}"]`);
        if (!el) return;
        body.scrollTo({
            top: offsetWithin(body, el) - 20,
            behavior: smooth ? "smooth" : "auto",
        });
        pinned = id;
        setActive(id);
    }

    /* --- open / close ---------------------------------------------------- */

    function doOpen(sectionId?: string, push = true): void {
        if (open) {
            if (sectionId) scrollTo(sectionId, true);
            return;
        }
        open = true;
        opener = document.activeElement as HTMLElement | null;
        entryUrl = location.pathname + location.search + location.hash;
        root.classList.add("is-open");
        document.body.style.overflow = "hidden";

        if (syncUrl && push) {
            history.pushState({ dopedocs: sectionId ?? null }, "", urlFor(sectionId));
        }

        if (sectionId) scrollTo(sectionId);
        else {
            pinned = null;
            body.scrollTop = 0;
            syncActive();
        }
        // The overlay is visibility:hidden until `is-open` is applied, and
        // focus() on a still-hidden element is silently ignored.
        //
        // Adding the class is not enough, and neither is forcing layout or one
        // animation frame: the visibility change rides a transition, so the
        // computed value stays `hidden` until a frame has actually committed.
        // Measured in Chromium — synchronous, a forced reflow, one rAF and a
        // zero timeout all still see `hidden`; two frames see `visible`. So the
        // focus move waits for the second frame, guarded in case the reader
        // closed the panel in between.
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                if (open) back.focus();
            }),
        );
        onToggle?.(true);
    }

    function doClose(pop = true): void {
        if (!open) return;
        open = false;
        activeId = null;
        root.classList.remove("is-open");
        document.body.style.overflow = "";
        // Focus returns to whatever opened the panel, so a keyboard reader lands
        // where they were rather than at the top of the document.
        opener?.focus?.();
        if (syncUrl && pop && location.pathname !== entryUrl) history.back();
        onToggle?.(false);
    }

    /* --- listeners ------------------------------------------------------- */

    const onClick = (event: MouseEvent) => {
        const el = event.target as HTMLElement;
        if (el.closest("[data-dd-close]")) {
            event.preventDefault();
            doClose();
            return;
        }
        if (event.target === root) {
            doClose();
            return;
        }
        const anchor = el.closest<HTMLElement>("a[data-dd-link]");
        if (anchor) {
            event.preventDefault();
            scrollTo(anchor.dataset.ddLink!, true);
        }
    };

    // A summary is not a link, so navigation rides the native toggle: opening a
    // folder takes you to the section it stands for, collapsing it moves nothing.
    const onToggleGroup = (event: Event) => {
        const group = event.target as HTMLDetailsElement;
        const id = group.dataset.ddGroup;
        if (!id) return;
        // Our own expansion, not the reader's: acknowledge it and move nothing.
        if (autoExpanded.delete(id)) return;
        if (group.open) {
            expandedFor = id;
            scrollTo(id, true);
        }
    };

    const onKeydown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && open) {
            event.preventDefault();
            doClose();
        }
    };

    const onPopState = () => {
        if (!syncUrl) return;
        const id = sectionFromPath(location.pathname);
        if (id === undefined) doClose(false);
        else if (!open) doOpen(id ?? undefined, false);
        else if (id) scrollTo(id);
    };

    root.addEventListener("click", onClick);
    body.addEventListener("scroll", onScroll, { passive: true });
    body.addEventListener("wheel", onUserScroll, { passive: true });
    body.addEventListener("pointerdown", onUserScroll, { passive: true });
    body.addEventListener("touchmove", onUserScroll, { passive: true });
    body.addEventListener("keydown", onUserScroll);
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("popstate", onPopState);
    for (const group of groups) group.addEventListener("toggle", onToggleGroup);

    // Arriving directly at a section URL opens the panel there, with no push —
    // the reader is already at the address, so adding a history entry would make
    // Back a no-op.
    if (syncUrl) {
        const id = sectionFromPath(location.pathname);
        if (id !== undefined) doOpen(id ?? undefined, false);
    }

    return {
        open: (sectionId?: string) => doOpen(sectionId),
        close: () => doClose(),
        destroy() {
            doClose(false);
            root.removeEventListener("click", onClick);
            body.removeEventListener("scroll", onScroll);
            body.removeEventListener("wheel", onUserScroll);
            body.removeEventListener("pointerdown", onUserScroll);
            body.removeEventListener("touchmove", onUserScroll);
            body.removeEventListener("keydown", onUserScroll);
            document.removeEventListener("keydown", onKeydown);
            window.removeEventListener("popstate", onPopState);
            for (const group of groups) group.removeEventListener("toggle", onToggleGroup);
            root.remove();
        },
        get isOpen() {
            return open;
        },
        get activeId() {
            return activeId;
        },
    };
}
