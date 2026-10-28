/** Optional build-time TeX preparation. Never imported by the core renderer. */
import { renderToString } from "katex";
import type { FactMap } from "./facts.js";
import { isGroup, type DocBlock, type DocPage, type DocSection, type DocSet } from "./schema.js";

/** Return serializable data for both static pages and the panel. Native MathML
 * needs no KaTeX stylesheet, fonts or scripts. Invalid TeX fails preparation.
 * Run only at build time; bundle/serialize the returned document for readers. */
export function prepareMath<F extends FactMap>(docs: DocSet<F>): DocSet<F> {
    const block = (item: DocBlock): DocBlock => {
        if (item.kind !== "math") return item;
        if (!item.tex.trim()) throw new Error("A math block needs non-empty TeX.");
        const display = item.display !== false;
        const output = renderToString(item.tex, {
            output: "mathml", displayMode: display, throwOnError: true,
            trust: false, strict: "error",
        });
        // KaTeX wraps MathML in a span. Keep just the native math element so
        // its own browser layout works without KaTeX's HTML/CSS presentation.
        const start = output.indexOf("<math");
        const end = output.lastIndexOf("</math>");
        if (start < 0 || end < start) throw new Error("KaTeX did not produce MathML.");
        return { ...item, prepared: { tex: item.tex, display, mathml: output.slice(start, end + 7) } };
    };
    const page = <P extends DocPage>(item: P): P => ({ ...item, blocks: item.blocks.map(block) });
    const visit = (items: DocSection[]): DocSection[] => items.map(item => isGroup(item)
        ? { ...item, children: visit(item.children) } : page(item));
    return { ...docs, sections: visit(docs.sections),
        ...(docs.articles ? { articles: docs.articles.map(page) } : {}) };
}
