/**
 * The developer reference page (DEC-20): one long page of rows, each with
 * prose on the left and its code on the right, the code staying in view while
 * its row scrolls. Narrow screens stack the two. It is static HTML; the only
 * script is the shared tabs enhancement, which switches samples labelled
 * alike across every panel at once.
 *
 * Every class here is a stable `dd-ref-` name and public API (DEC-05).
 */
import type { FactMap } from "./facts.js";
import { icon } from "./icons.js";
import { anchorHref, escapeHtml, inline, type SectionHref } from "./inline.js";
import { renderBlock } from "./render.js";
import type { DocReference, Finding, ReferenceCode, ReferenceEntry, ReferenceFields, ReferenceGroup } from "./schema.js";

/** The tabs group every panel joins, so choosing Python once shows Python everywhere. */
const SAMPLE_GROUP = "dd-ref-sample";

/** A tab key from a sample label: `Node.js` becomes `node-js`. */
const sampleKey = (label: string): string =>
    label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sample";

function panel(code: ReferenceCode, text: (raw: string) => string): string {
    const pre = (raw: string) => `<pre class="dd-ref-pre" tabindex="0"><code>${escapeHtml(raw)}</code></pre>`;
    if (code.samples.length === 1) {
        const [sample] = code.samples;
        return `<div class="dd-ref-panel">` +
            `<p class="dd-ref-panel-title">${text(code.title)}<span class="dd-ref-panel-lang">${escapeHtml(sample!.label)}</span></p>` +
            pre(sample!.code) + `</div>`;
    }
    // The shared tabs markup: without script every sample shows under its label.
    return `<div class="dd-ref-panel dd-tabs" data-dd-tabs data-dd-tab-group="${SAMPLE_GROUP}">` +
        `<p class="dd-tabs-label dd-ref-panel-title">${text(code.title)}</p>` +
        code.samples.map((sample) =>
            `<div class="dd-tab-pane" data-dd-pane="${escapeHtml(sampleKey(sample.label))}">` +
            `<p class="dd-tab-label">${escapeHtml(sample.label)}</p>${pre(sample.code)}</div>`,
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

