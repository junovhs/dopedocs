/** Local manual search. No network requests or consumer application content. */
import { renderSection } from "./render.js";
import { pagesOf, type DocSet } from "./schema.js";

export interface SearchEntry { id: string; title: string; href: string; text: string; }

/** Build readable search text from the same resolved HTML readers receive. */
export function createSearchIndex(docs: DocSet, href: (id: string) => string): SearchEntry[] {
    return pagesOf(docs.sections).map(({ page, ancestors }) => ({
        id: page.id, title: page.title, href: href(page.id),
        text: [ancestors.map((group) => group.title).join(" "), page.question, ...(page.keywords ?? []),
            renderSection(page, docs.facts).replace(/<[^>]*>/g, " ")
                .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
        ].join(" ").replace(/\s+/g, " ").trim(),
    }));
}

/** Each search region owns its label, results and JSON index; safe in multiple panels. */
export function renderSearch(index: SearchEntry[]): string {
    return `<div class="dd-search" data-dd-search>` +
        `<label>Search manual<input type="search" class="dd-search-input" autocomplete="off" disabled></label>` +
        `<p class="dd-search-status" role="status"></p><ul class="dd-search-results" hidden></ul>` +
        `<script type="application/json" data-dd-search-index>${JSON.stringify(index).replace(/</g, "\\u003c")}</script>` +
        `<noscript><p>Read the complete manual and use your browser's Find command to search it.</p></noscript></div>`;
}

/** Enhance all search regions under a root. Self-contained for the static script. */
export function mountSearch(root: ParentNode): () => void {
    const cleanups: (() => void)[] = [];
    for (const region of root.querySelectorAll<HTMLElement>("[data-dd-search]")) {
        const input = region.querySelector<HTMLInputElement>("input")!;
        const status = region.querySelector<HTMLElement>('[role="status"]')!;
        const results = region.querySelector<HTMLUListElement>("ul")!;
        const index = JSON.parse(region.querySelector("[data-dd-search-index]")!.textContent!) as SearchEntry[];
        const normal = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
        const searchable = index.map((entry) => ({ entry, text: normal(entry.text + " " + entry.title) }));
        input.disabled = false;
        const update = () => {
            const words = normal(input.value).trim().split(/\s+/).filter(Boolean);
            results.replaceChildren();
            results.hidden = words.length === 0;
            if (!words.length) { status.textContent = ""; return; }
            const matches = searchable.filter(({ text }) => words.every((word) => text.includes(word)));
            status.textContent = matches.length ? `${matches.length} result${matches.length === 1 ? "" : "s"}${matches.length > 50 ? "; showing first 50" : ""}` : "No results. Try another word.";
            for (const { entry } of matches.slice(0, 50)) {
                const item = document.createElement("li");
                const anchor = document.createElement("a");
                anchor.href = entry.href;
                anchor.dataset.ddLink = entry.id;
                anchor.textContent = entry.title;
                item.append(anchor);
                results.append(item);
            }
        };
        const keydown = (event: KeyboardEvent) => {
            if (event.key === "ArrowDown" && !results.hidden) {
                const first = results.querySelector<HTMLAnchorElement>("a");
                if (first) { event.preventDefault(); first.focus(); }
            } else if (event.key === "Escape" && input.value) {
                event.preventDefault(); event.stopPropagation(); input.value = ""; update(); input.focus();
            }
        };
        input.addEventListener("input", update);
        region.addEventListener("keydown", keydown);
        cleanups.push(() => { input.removeEventListener("input", update); region.removeEventListener("keydown", keydown); });
    }
    return () => cleanups.forEach((cleanup) => cleanup());
}

/** Standalone enhancement emitted by buildStatic; no imports or dependencies. */
export const searchScript = () => `(${mountSearch.toString()})(document);`;
