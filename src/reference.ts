/**
 * The developer reference page (DEC-20): one long page of rows, each with
 * prose on the left and its code on the right, the code staying in view while
 * its row scrolls. Narrow screens stack the two. It is static HTML; two small
 * enhancements add the tabs, which switch samples labelled alike across every
 * panel at once, and a Copy button on each sample. Code is coloured from the
 * semantic tokens `prepareCode` adds, and plain without them.
 *
 * Every class here is a stable `dd-ref-` name and public API (DEC-05).
 */
import type { FactMap } from "./facts.js";
import { icon } from "./icons.js";
import { anchorHref, escapeHtml, inline, type SectionHref } from "./inline.js";
import { renderBlock } from "./render.js";
import { CODE_TONES, type DocReference, type Finding, type ReferenceCode, type ReferenceEntry, type ReferenceFields, type ReferenceGroup, type ReferenceSample } from "./schema.js";

/** The tabs group every panel joins, so choosing Python once shows Python everywhere. */
const SAMPLE_GROUP = "dd-ref-sample";

/** A tab key from a sample label: `Node.js` becomes `node-js`. */
const sampleKey = (label: string): string =>
    label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sample";

/** Lucide "copy" (ISC), inline so the shared icon set the panel loads stays as it is. */
const COPY_ICON = `<svg class="dd-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>`;

/** A sample's source, coloured when its tokens still spell it exactly. */
function source(sample: ReferenceSample): string {
    const valid = sample.tokens?.map((token) => token.text).join("") === sample.code;
    if (!valid) return escapeHtml(sample.code);
    return sample.tokens!.map((token) => {
        const escaped = escapeHtml(token.text);
        return token.tone && CODE_TONES.includes(token.tone) ? `<span class="dd-code-token--${token.tone}">${escaped}</span>` : escaped;
    }).join("");
}

/** One sample's code, with a Copy button the enhancement reveals. */
const body = (sample: ReferenceSample): string =>
    `<div class="dd-ref-body"><pre class="dd-ref-pre" tabindex="0"><code>${source(sample)}</code></pre>` +
    `<button type="button" class="dd-ref-copy" hidden>${COPY_ICON}<span>Copy</span></button></div>`;

function panel(code: ReferenceCode, text: (raw: string) => string): string {
    if (code.samples.length === 1) {
        const [sample] = code.samples;
        return `<div class="dd-ref-panel">` +
            `<p class="dd-ref-panel-title"><span class="dd-ref-panel-name">${text(code.title)}</span><span class="dd-ref-panel-lang">${escapeHtml(sample!.label)}</span></p>` +
            body(sample!) + `</div>`;
    }
    // The shared tabs markup: without script every sample shows under its label.
    return `<div class="dd-ref-panel dd-tabs" data-dd-tabs data-dd-tab-group="${SAMPLE_GROUP}">` +
        `<p class="dd-tabs-label dd-ref-panel-title"><span class="dd-ref-panel-name">${text(code.title)}</span></p>` +
        code.samples.map((sample) =>
            `<div class="dd-tab-pane" data-dd-pane="${escapeHtml(sampleKey(sample.label))}">` +
            `<p class="dd-tab-label">${escapeHtml(sample.label)}</p>${body(sample)}</div>`,
        ).join("") +
        `</div>`;
}

function codeColumn(code: ReferenceCode[] | undefined, text: (raw: string) => string): string {
    return `<div class="dd-ref-code">` +
        (code?.length ? `<div class="dd-ref-stick">${code.map((c) => panel(c, text)).join("")}</div>` : "") +
        `</div>`;
}

function fieldList(list: ReferenceFields, text: (raw: string) => string): string {
    return `<h3 class="dd-ref-label">${text(list.title)}</h3><ul class="dd-ref-fields">` +
        list.fields.map((field) =>
            `<li><p class="dd-ref-field"><code class="dd-ref-name">${escapeHtml(field.name)}</code>` +
            (field.type ? `<span class="dd-ref-type">${escapeHtml(field.type)}</span>` : "") +
            (field.required ? `<span class="dd-ref-required">Required</span>` : "") +
            (field.default ? `<span class="dd-ref-default">Default <code>${escapeHtml(field.default)}</code></span>` : "") +
            `</p><p class="dd-ref-desc">${text(field.description)}</p></li>`,
        ).join("") +
        `</ul>`;
}

export interface ReferenceRenderOptions {
    sectionHref?: SectionHref;
    /** A manual page's title, for an entry's guide link. */
    titleOf?: (id: string) => string | undefined;
}

function entryRow(entry: ReferenceEntry, group: ReferenceGroup, facts: FactMap, options: ReferenceRenderOptions): string {
    const { sectionHref = anchorHref } = options;
    const where = `reference entry "${entry.id}"`;
    const text = (raw: string) => inline(raw, facts, where, sectionHref);
    const badge = entry.badge ? `<span class="dd-ref-badge">${escapeHtml(entry.badge)}</span>` : "";
    return `<section class="dd-ref-row" id="${escapeHtml(entry.id)}">` +
        `<div class="dd-section dd-ref-doc">` +
        `<p class="dd-ref-kicker">${escapeHtml(group.title)}</p>` +
        `<h2 class="dd-ref-title">${escapeHtml(entry.title)}</h2>` +
        (entry.signature ? `<p class="dd-ref-signature">${badge}<code>${escapeHtml(entry.signature)}</code></p>` : "") +
        `<p class="dd-answer">${text(entry.answer)}</p>` +
        (entry.blocks ?? []).map((block) => renderBlock(block, facts, where, sectionHref)).join("") +
        (entry.fields ?? []).map((list) => fieldList(list, text)).join("") +
        (entry.errors?.length
            ? `<h3 class="dd-ref-label">Errors</h3><ul class="dd-ref-errors">` +
              entry.errors.map((error) => `<li><code>${escapeHtml(error.code)}</code><p>${text(error.description)}</p></li>`).join("") +
              `</ul>`
            : "") +
        (entry.guide
            ? `<p class="dd-ref-guide">${icon("arrow-right")}<a href="${escapeHtml(sectionHref(entry.guide))}">` +
              `${escapeHtml(options.titleOf?.(entry.guide) ?? entry.guide)}</a></p>`
            : "") +
        `</div>` +
        codeColumn(entry.code, text) +
        `</section>`;
}

/** The whole reference page body: the overview row, then one row per entry. */
export function renderReference(reference: DocReference, facts: FactMap, options: ReferenceRenderOptions = {}): string {
    const { sectionHref = anchorHref } = options;
    const where = `the reference "${reference.id}"`;
    const text = (raw: string) => inline(raw, facts, where, sectionHref);
    const contents = reference.groups.map((group) =>
        `<li><p class="dd-ref-index-group">${escapeHtml(group.title)}</p><p class="dd-ref-index-links">` +
        group.entries.map((entry) => `<a href="#${escapeHtml(entry.id)}">${escapeHtml(entry.title)}</a>`).join(" · ") +
        `</p></li>`,
    ).join("");
    return `<div class="dd-ref">` +
        `<section class="dd-ref-row dd-ref-row--intro" id="${escapeHtml(reference.id)}">` +
        `<div class="dd-section dd-ref-doc">` +
        `<h1 class="dd-title">${escapeHtml(reference.title)}</h1>` +
        `<p class="dd-answer dd-ref-lead">${text(reference.answer)}</p>` +
        reference.blocks.map((block) => renderBlock(block, facts, where, sectionHref)).join("") +
        `<h3 class="dd-ref-label">Contents</h3><ul class="dd-ref-index">${contents}</ul>` +
        `</div>` +
        codeColumn(reference.code, text) +
        `</section>` +
        reference.groups.map((group) => group.entries.map((entry) => entryRow(entry, group, facts, options)).join("")).join("") +
        `</div>`;
}

/** The reference page's rail: the overview, then each group's entries with their badges. */
export function renderReferenceRail(reference: DocReference): string {
    const link = (id: string, label: string, badge?: string) =>
        `<li><a class="dd-nav-link dd-ref-link" href="#${escapeHtml(id)}">` +
        (badge ? `<span class="dd-ref-badge">${escapeHtml(badge)}</span>` : "") +
        `<span>${escapeHtml(label)}</span></a></li>`;
    return `<nav class="dd-nav dd-ref-nav" aria-label="${escapeHtml(reference.title)}">` +
        `<p class="dd-nav-label">${escapeHtml(reference.title)}</p>` +
        `<ul class="dd-nav-list">${link(reference.id, "Overview")}` +
        reference.groups.map((group) =>
            `<li><details class="dd-nav-group" open><summary>${icon("chevron-right")}${escapeHtml(group.title)}</summary>` +
            `<ul class="dd-nav-list">${group.entries.map((entry) => link(entry.id, entry.title, entry.badge)).join("")}</ul></details></li>`,
        ).join("") +
        `</ul></nav>`;
}

/**
 * What a reference adds to its pages: groups, fields, code panels, guides.
 * `validate` checks entries by every page rule; `buildStatic` adds these. They
 * live here, outside the schema, so the in-app panel doesn't carry them.
 */
export function validateReference(reference: DocReference, manualIds: Set<string>): Finding[] {
    const findings: Finding[] = [];
    const bad = (sectionId: string, message: string) =>
        findings.push({ code: "invalid-reference", severity: "fatal", sectionId, message });
    const panels = (id: string, code: ReferenceCode[] | undefined) => {
        for (const panel of code ?? []) {
            if (!panel.title.trim()) bad(id, `A code panel in "${id}" has no title.`);
            if (!panel.samples.length) bad(id, `The "${panel.title}" panel in "${id}" has no samples.`);
            const labels = new Set<string>();
            for (const sample of panel.samples) {
                if (!sample.label.trim() || labels.has(sample.label)) {
                    bad(id, `The "${panel.title}" panel in "${id}" needs a unique, non-blank label for each sample.`);
                }
                labels.add(sample.label);
                if (!sample.code.trim()) bad(id, `The "${sample.label}" sample in "${id}" is empty.`);
            }
        }
    };
    panels(reference.id, reference.code);
    const groupIds = new Set<string>();
    for (const group of reference.groups) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group.id) || groupIds.has(group.id)) bad(group.id, `Reference group id "${group.id}" must be a unique slug.`);
        groupIds.add(group.id);
        if (!group.entries.length) bad(group.id, `Reference group "${group.id}" has no entries.`);
        for (const entry of group.entries) {
            panels(entry.id, entry.code);
            if (entry.badge !== undefined && !entry.badge.trim()) bad(entry.id, `Entry "${entry.id}" has a blank badge.`);
            for (const list of entry.fields ?? []) {
                if (!list.title.trim()) bad(entry.id, `A field list in "${entry.id}" has no title.`);
                if (list.fields.some((field) => !field.name.trim() || !field.description.trim())) {
                    bad(entry.id, `Every field in "${entry.id}" needs a name and a description.`);
                }
            }
            if ((entry.errors ?? []).some((error) => !error.code.trim() || !error.description.trim())) {
                bad(entry.id, `Every error in "${entry.id}" needs a code and a description.`);
            }
            if (entry.guide !== undefined && !manualIds.has(entry.guide)) {
                findings.push({
                    code: "unknown-reference-guide",
                    severity: "fatal",
                    sectionId: entry.id,
                    message: `Entry "${entry.id}" names the guide "${entry.guide}", which is not a manual page.`,
                });
            }
        }
    }
    return findings;
}


/**
 * The Copy enhancement, as a self-contained script for the reference page:
 * each button copies its sample's exact source. Without script, or without
 * clipboard access, the code stays selectable and the button stays hidden or
 * says how to copy by hand.
 */
export function mountReferenceCopy(root: ParentNode): void {
    for (const button of root.querySelectorAll<HTMLButtonElement>(".dd-ref-copy")) {
        const label = button.querySelector("span")!;
        const code = button.parentElement!.querySelector("code")!;
        button.hidden = false;
        button.setAttribute("aria-label", "Copy code");
        let timer: ReturnType<typeof setTimeout> | undefined;
        button.addEventListener("click", async () => {
            clearTimeout(timer);
            try {
                await navigator.clipboard.writeText(code.textContent ?? "");
                label.textContent = "Copied";
                button.classList.add("is-done");
            } catch {
                label.textContent = "Select to copy";
            }
            timer = setTimeout(() => { label.textContent = "Copy"; button.classList.remove("is-done"); }, 1600);
        });
    }
}

export const referenceScript = (): string => `(${mountReferenceCopy.toString()})(document);`;
