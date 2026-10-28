/** Opt-in copying from resolved article markup, never from navigation or source facts. */
export function mountCopy(root: ParentNode, canonical: (id: string) => string): () => void {
    const cleanups: (() => void)[] = [];
    // Include folded content and all authored tab labels, independent of UI state.
    function text(node: Node): string {
        if (node.nodeType === 3) return node.textContent ?? "";
        if (!(node instanceof Element)) return "";
        if (node.matches("[data-dd-copy], [role=tablist], .dd-heading-link, svg, [aria-hidden=true]")) return "";
        if (node.matches("img")) return node.getAttribute("alt") ?? "";
        if (node.matches(".dd-math-equation")) {
            return node.getAttribute("aria-label") ?? node.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? node.textContent ?? "";
        }
        if (node.matches("pre")) return "\n" + node.textContent + "\n";
        const value = [...node.childNodes].map(text).join("");
        if (node.matches(".dd-card-title, .dd-card-text, .dd-card-label, .dd-callout-label, .dd-metric-value, .dd-metric-detail")) return "\n" + value + "\n";
        if (node.matches("li")) return "\n- " + value.trim() + "\n";
        if (node.matches("th, td")) return value + "\t";
        if (node.matches("span, a, strong, em, code, kbd")) return value;
        return "\n" + value + "\n";
    }
    for (const section of root.querySelectorAll<HTMLElement>(".dd-section[id]")) {
        const actions = document.createElement("div");
        actions.className = "dd-copy";
        actions.dataset.ddCopy = "";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "dd-copy-button";
        button.textContent = "Copy page";
        button.setAttribute("aria-label", `Copy page: ${section.querySelector(".dd-section-title")?.textContent ?? "page"}`);
        const status = document.createElement("span");
        status.className = "dd-copy-status";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        actions.append(button, status);
        section.querySelector(".dd-section-title")!.after(actions);
        let live = true;
        async function copy(): Promise<void> {
            status.textContent = "";
            try {
                const content = text(section).replace(/\n{3,}/g, "\n\n").trim();
                await navigator.clipboard.writeText(`${content}\n\n${canonical(section.id)}`);
                if (live) status.textContent = "Page copied.";
            } catch {
                if (live) status.textContent = "Could not copy. Select the page text and copy it manually.";
            }
        }
        button.addEventListener("click", copy);
        cleanups.push(() => {
            live = false;
            button.removeEventListener("click", copy);
            actions.remove();
        });
    }
    return () => cleanups.forEach(cleanup => cleanup());
}

/** A self-hosted classic script, compatible with script-src 'self'. */
export const copyScript = () => `(${mountCopy.toString()})(document, () => document.querySelector('link[rel="canonical"]').href);`;
