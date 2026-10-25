// Skins and type pairings are plain data, so a person (or an AI in a terminal)
// can add one without touching CSS. Every value lands on a --dd-* token.
window.DD_FONTS = [
  { id: "neutral", name: "Neutral", display: "Inter", body: "Inter", w: 650, t: -0.025 },
  { id: "grotesk", name: "Grotesk", display: "Space Grotesk", body: "Inter", w: 600, t: -0.035 },
  { id: "editorial", name: "Editorial", display: "Newsreader", body: "Newsreader", w: 500, t: -0.015, size: 18.5 },
  { id: "softserif", name: "Soft serif", display: "Fraunces", body: "Inter", w: 600, t: -0.02 },
  { id: "magazine", name: "Magazine", display: "Instrument Serif", body: "Inter", w: 400, t: -0.01, hscale: 1.18 },
  { id: "rounded", name: "Rounded", display: "Bricolage Grotesque", body: "Inter", w: 750, t: -0.03 },
  { id: "technical", name: "Technical", display: "IBM Plex Sans", body: "IBM Plex Sans", ui: "IBM Plex Sans", mono: "IBM Plex Mono", w: 600, t: -0.02 },
  { id: "friendly", name: "Friendly", display: "DM Sans", body: "DM Sans", ui: "DM Sans", w: 700, t: -0.03 },
  { id: "modern", name: "Modern", display: "Manrope", body: "Manrope", ui: "Manrope", w: 750, t: -0.03 },
  { id: "geometric", name: "Geometric", display: "Sora", body: "Inter", w: 650, t: -0.035 },
  { id: "classic", name: "Classic", display: "Source Serif 4", body: "Source Serif 4", ui: "Source Sans 3", w: 650, t: -0.015, size: 18 },
  { id: "console", name: "Console", display: "Space Grotesk", body: "Inter", ui: "JetBrains Mono", w: 600, t: -0.035 },
  { id: "mono", name: "Mono", display: "JetBrains Mono", body: "JetBrains Mono", ui: "JetBrains Mono", w: 650, t: -0.04, size: 15 },
];

// c: bg, panel, muted, ink, onInk, text, soft, dim, line, lineSoft, accent, onAccent
const pal = (bg, panel, muted, ink, onInk, text, soft, dim, line, lineSoft, accent, onAccent) => ({ bg, panel, muted, ink, onInk, text, soft, dim, line, lineSoft, accent, onAccent });
window.DD_SKINS = [
  { id: "studio", name: "Studio", ds: "Crisp and neutral", font: "neutral", radius: 10,
    light: pal("#fbfbfc", "#ffffff", "#f3f4f6", "#111318", "#e9eaee", "#0e1014", "#474c57", "#8a8f9a", "#e5e6ea", "#eff0f2", "#5a5cf0", "#ffffff"),
    dark: pal("#0b0c0f", "#121318", "#1a1c22", "#1f2128", "#e9eaee", "#f3f4f6", "#b3b7c1", "#747a86", "#23252c", "#1a1c21", "#8e8fff", "#0b0c0f") },
  { id: "paper", name: "Paper", ds: "Warm stock, serif", font: "editorial", radius: 3,
    light: pal("#f6f1e7", "#fffcf5", "#efe8da", "#1f1b16", "#f4ede0", "#1b1712", "#4a4238", "#8c8172", "#e0d6c4", "#ebe3d4", "#b23d18", "#fffaf0"),
    dark: pal("#17140f", "#1e1a14", "#28231b", "#2b251d", "#f1e9da", "#f1e9da", "#c4b8a3", "#8a7f6d", "#332c22", "#25201a", "#ec8a5c", "#17140f") },
  { id: "swiss", name: "Swiss", ds: "Black, white, one red", font: "neutral", radius: 0, w: 750, t: -0.04,
    light: pal("#ffffff", "#ffffff", "#f2f2f2", "#000000", "#ffffff", "#000000", "#262626", "#7a7a7a", "#e0e0e0", "#ededed", "#ff2e00", "#ffffff"),
    dark: pal("#000000", "#0a0a0a", "#161616", "#161616", "#ffffff", "#ffffff", "#d6d6d6", "#8a8a8a", "#262626", "#181818", "#ff4a1f", "#000000") },
  { id: "nordic", name: "Nordic", ds: "Cool, calm, quiet", font: "modern", radius: 8,
    light: pal("#f5f7fa", "#ffffff", "#eceff4", "#1c2433", "#e5e9f0", "#1c2433", "#4c566a", "#8a94a6", "#e1e5ec", "#eceff3", "#2f6fdb", "#ffffff"),
    dark: pal("#11151c", "#161b24", "#1d2430", "#1d2430", "#e5e9f0", "#e5e9f0", "#a9b3c4", "#6b7588", "#252c39", "#1b212b", "#6ea2ff", "#11151c") },
  { id: "forest", name: "Forest", ds: "Earthy, soft serif", font: "softserif", radius: 12,
    light: pal("#f4f5ef", "#fbfbf7", "#e9ebe1", "#1d2a1f", "#e8efe3", "#1d2a1f", "#4a5a4c", "#87947f", "#dde2d3", "#e8ebe0", "#2f6b3a", "#ffffff"),
    dark: pal("#0f1410", "#141a15", "#1b231c", "#1b231c", "#e4ecdf", "#e4ecdf", "#a9b8a5", "#6d7b69", "#232d24", "#19201a", "#7cc488", "#0f1410") },
  { id: "sandstone", name: "Sandstone", ds: "Magazine warmth", font: "magazine", radius: 10,
    light: pal("#faf6f1", "#fffdfa", "#f1e9df", "#2b2118", "#f6ede3", "#2b2118", "#5c4d3f", "#9a8a79", "#e8ddd0", "#f0e7dc", "#c2672b", "#ffffff"),
    dark: pal("#1a1511", "#211b16", "#2a231c", "#2a231c", "#f3e9df", "#f3e9df", "#c9b9a8", "#8b7b6b", "#352c24", "#251f19", "#e8935a", "#1a1511") },
  { id: "ocean", name: "Ocean", ds: "Fresh and friendly", font: "friendly", radius: 12,
    light: pal("#f3f8fa", "#ffffff", "#e6f0f4", "#0d2530", "#dff1f6", "#0d2530", "#3d5763", "#7d97a2", "#d7e5eb", "#e5eff3", "#0a8ea8", "#ffffff"),
    dark: pal("#071419", "#0b1c22", "#10252d", "#10252d", "#dff1f6", "#dff1f6", "#9fbcc6", "#5f7d88", "#16313b", "#0f232a", "#3cc8e3", "#071419") },
  { id: "dusk", name: "Dusk", ds: "Violet evening", font: "geometric", radius: 14,
    light: pal("#f7f5fb", "#ffffff", "#efebf7", "#1e1a2e", "#ece8f8", "#1e1a2e", "#4f4866", "#8e86a6", "#e4dff0", "#eeeaf6", "#7c5cff", "#ffffff"),
    dark: pal("#0f0d17", "#151221", "#1d192c", "#1d192c", "#ece8f8", "#ece8f8", "#b3abcc", "#736b8f", "#272238", "#1a1727", "#a78bfa", "#0f0d17") },
  { id: "candy", name: "Candy", ds: "Round and loud", font: "rounded", radius: 20,
    light: pal("#fff6fa", "#ffffff", "#fbecf4", "#2a1238", "#fbe7f3", "#23102e", "#5b4a66", "#a28ead", "#f3dcea", "#f8e9f1", "#f43f8e", "#ffffff"),
    dark: pal("#150b1d", "#1d1027", "#271534", "#2f1a40", "#fbeef7", "#fbeef7", "#cdb6d6", "#8a729a", "#331d43", "#241430", "#ff6bb0", "#150b1d") },
  { id: "blueprint", name: "Blueprint", ds: "Technical drawing", font: "technical", radius: 4, texture: "grid",
    light: pal("#eef3fb", "#f8fbff", "#e1eaf7", "#0b1f44", "#dfe9ff", "#0b1f44", "#3a4f78", "#7489ad", "#cfdcf0", "#dfe8f5", "#1f5eff", "#ffffff"),
    dark: pal("#0a1630", "#0e1c3a", "#132446", "#132446", "#dfe9ff", "#dfe9ff", "#9fb3da", "#6278a3", "#1c3058", "#142649", "#6fa1ff", "#0a1630") },
  { id: "ember", name: "Ember", ds: "Dark heat, orange", font: "grotesk", radius: 6, prefers: "dark",
    light: pal("#fbf7f4", "#ffffff", "#f3ece6", "#24150d", "#f6e8df", "#24150d", "#5a4436", "#9a8576", "#ecdfd5", "#f3eae3", "#e5480f", "#ffffff"),
    dark: pal("#120c09", "#19110d", "#221813", "#221813", "#f6e8df", "#f6e8df", "#c6ad9e", "#85695a", "#2d211a", "#1e1611", "#ff6a2b", "#120c09"), glow: "rgb(255 106 43 / .28)" },
  { id: "terminal", name: "Terminal", ds: "Mono, sharp, glowing", font: "console", radius: 2, prefers: "dark",
    light: pal("#f3f5ef", "#fbfcf8", "#e7ebe0", "#0c0e0b", "#d8f5b4", "#0d110b", "#3e4739", "#7c8775", "#d6dccd", "#e4e9dc", "#3a7d00", "#f3f5ef"),
    dark: pal("#080a07", "#0d100b", "#141911", "#141911", "#e6f2d9", "#e6f2d9", "#a3b394", "#637056", "#1e251a", "#151b12", "#b5f36a", "#080a07"), glow: "rgb(181 243 106 / .25)" },
];

// Curated starting points: a whole look in one click.
window.DD_PRESETS = [
  { name: "Crisp", patch: { skin: "studio", font: "", mode: "light", radius: null, card: "elevated", active: "pill", header: "glass", texture: "" } },
  { name: "Bookish", patch: { skin: "paper", font: "", mode: "light", measure: 640, card: "flat", active: "line", header: "solid", texture: "grain" } },
  { name: "Swiss", patch: { skin: "swiss", font: "", mode: "light", radius: null, card: "outline", active: "bold", header: "minimal", texture: "" } },
  { name: "Night shift", patch: { skin: "terminal", font: "", mode: "dark", card: "outline", active: "line", header: "solid", texture: "grid" } },
  { name: "Playful", patch: { skin: "candy", font: "", mode: "light", radius: null, card: "tint", active: "pill", header: "glass", texture: "dots" } },
  { name: "Calm", patch: { skin: "nordic", font: "", mode: "light", density: 1.15, card: "flat", active: "pill", header: "minimal", texture: "" } },
];
