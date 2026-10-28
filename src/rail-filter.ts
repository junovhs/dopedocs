/** Optional rail-only filtering. Controls exist only after JavaScript mounts. */
export function mountRailFilter(nav: HTMLElement, shortcut = "/"): () => void {
    const list = nav.querySelector<HTMLElement>(":scope > .dd-nav-list")!;
    const control = document.createElement("div");
    control.className = "dd-rail-filter";
    const label = document.createElement("label");
    label.textContent = `Filter contents (${shortcut})`;
    const input = document.createElement("input");
    input.type = "search";
    input.className = "dd-search-input";
    input.setAttribute("aria-keyshortcuts", shortcut);
    label.append(input);
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    control.append(label, status);
    nav.querySelector(".dd-nav-label")!.after(control);
    const items = [...list.querySelectorAll<HTMLElement>("li")].reverse();
    const groups = [...list.querySelectorAll<HTMLDetailsElement>("details")];
    let original = groups.map(group => group.open);
    let filtering = false;
    const normal = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const update = () => {
        const query = normal(input.value.trim());
        if (query && !filtering) original = groups.map(group => group.open);
        filtering = !!query;
        for (const item of items) {
            const own = item.querySelector(":scope > a, :scope > details > summary");
            const children = [...item.querySelectorAll<HTMLElement>(":scope > details > ul > li")];
            item.hidden = !!query && !normal(own?.textContent ?? "").includes(query) && !children.some(child => !child.hidden);
        }
        groups.forEach((group, index) => { group.open = query ? true : original[index]!; });
        status.textContent = items.every(item => item.hidden) ? "No matching pages." : "";
    };
    const keydown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && event.target === input && input.value) {
            event.preventDefault(); event.stopPropagation(); input.value = ""; update();
        } else if (event.key === shortcut && !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.altKey &&
            !(event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) &&
            !(event.target instanceof Element && event.target.closest(".dd-nav") && !nav.contains(event.target)) &&
            (!nav.closest("dialog") || nav.closest("dialog")!.contains(event.target as Node)) &&
            nav.getClientRects().length && (!document.querySelector("dialog[open]") || nav.closest("dialog[open]"))) {
            event.preventDefault(); input.focus();
        }
    };
    input.addEventListener("input", update);
    input.addEventListener("keydown", keydown);
    document.addEventListener("keydown", keydown);
    return () => {
        input.removeEventListener("input", update);
        input.removeEventListener("keydown", keydown);
        document.removeEventListener("keydown", keydown);
        input.value = ""; update(); control.remove();
    };
}

export const railFilterScript = () => `(${mountRailFilter.toString()})(document.querySelector('.dd-nav'), document.currentScript.dataset.key);`;
