import type { Font } from "fontkit";

// System-face dimensions from @capsizecss/metrics 4.4.0 (Arial and Courier New).
// https://github.com/seek-oss/capsize — numeric font metadata, not bundled fonts.
const systemFaces = {
    Arial: { xHeight: 1062, capHeight: 1467, unitsPerEm: 2048 },
    "Courier New": { xHeight: 866, capHeight: 1170, unitsPerEm: 2048 },
};
export type SystemFallback = keyof typeof systemFaces;
export const fallbackFamily = (family: string, system: SystemFallback): string => `${family} Fallback ${system}`;
const percent = (value: number) => `${Number((value * 100).toFixed(4))}%`;

/** Match x-height (or cap height) and the target's line metrics on a local system face. */
export function renderFontFallback(font: Font, family: string, system: SystemFallback, weight: number, style: string, range: string): string {
    if (font.variationAxes.wght) font = font.getVariation({ wght: weight });
    const fallback = systemFaces[system];
    const targetHeight = font.xHeight > 0 ? font.xHeight : font.capHeight;
    const localHeight = font.xHeight > 0 ? fallback.xHeight : fallback.capHeight;
    const size = targetHeight > 0 ? (targetHeight / font.unitsPerEm) / (localHeight / fallback.unitsPerEm) : 1;
    if (![size, font.unitsPerEm, font.ascent, font.descent, font.lineGap].every(Number.isFinite) || size <= 0 || font.unitsPerEm <= 0) throw new Error("Font has invalid fallback metrics");
    const em = font.unitsPerEm * size;
    const bold = weight >= 600;
    const italic = style === "italic";
    const suffix = bold && italic ? " Bold Italic" : bold ? " Bold" : italic ? " Italic" : "";
    const postscript = system === "Arial" ? `Arial${bold && italic ? "-BoldItalic" : bold ? "-Bold" : italic ? "-Italic" : ""}MT` : `CourierNewPS${bold && italic ? "-BoldItalic" : bold ? "-Bold" : italic ? "-Italic" : ""}MT`;
    return `@font-face {\n    font-family: ${JSON.stringify(fallbackFamily(family, system))};\n    src: local(${JSON.stringify(system + suffix)}), local(${JSON.stringify(postscript)});\n    font-style: ${style};\n    font-weight: ${weight};\n    unicode-range: ${range};\n    size-adjust: ${percent(size)};\n    ascent-override: ${percent(Math.max(0, font.ascent) / em)};\n    descent-override: ${percent(Math.abs(font.descent) / em)};\n    line-gap-override: ${percent(Math.max(0, font.lineGap) / em)};\n}`;
}
