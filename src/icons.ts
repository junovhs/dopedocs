/** Selected Lucide SVG paths, vendored to keep both reading surfaces runtime-free.
 * Lucide ISC / Feather MIT: see THIRD_PARTY_NOTICES.md. */
const paths = {
    "arrow-left": "<path d=\"m12 19-7-7 7-7\" />\n  <path d=\"M19 12H5\" />",
    "arrow-right": "<path d=\"M5 12h14\" />\n  <path d=\"m12 5 7 7-7 7\" />",
    "chevron-right": "<path d=\"m9 18 6-6-6-6\" />",
    "check": "<path d=\"M20 6 9 17l-5-5\" />",
    "info": "<circle cx=\"12\" cy=\"12\" r=\"10\" />\n  <path d=\"M12 16v-4\" />\n  <path d=\"M12 8h.01\" />",
    "triangle-alert": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\" />\n  <path d=\"M12 9v4\" />\n  <path d=\"M12 17h.01\" />"
} as const;

export function icon(name: keyof typeof paths): string {
    return `<svg class="dd-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
