# Style Studio: the direction for how dopedocs looks and moves

**Status:** owner-approved direction, 2026-10-25. Proof of concept in
[`prototypes/style-studio/`](prototypes/style-studio/). Nothing here is built
into the engine yet. The work is filed in Ishoo; see "Filed work" at the end.

## The idea in one paragraph

dopedocs should feel like a page builder and style designer for documentation.
A developer sets it up once. Then anyone, designer or not, opens a side panel,
moves sliders and flips options, and the docs restyle live. Layout, navigation,
color, spacing, motion and especially typography should all be reachable this
way. Every choice is written to a plain file, so a person in the panel and an AI
in a terminal can edit the same look together. The defaults must already look
excellent. The studio exists so people can make the docs theirs, not to rescue
bad defaults.

Owner's words: "a lego style toolkit for building user manuals, technical
documentation, course material", "highly stylizable, but it should look super
super good itself", and "anything you could do in Affinity Publisher, I want it
in here, but very easy for people to understand".

## Run the proof of concept

```sh
cd prototypes/style-studio
python3 -m http.server 8766 --bind 127.0.0.1
```

Open <http://127.0.0.1:8766/>. Keys: `1`–`4` switch layouts, `R` toggles Remix,
`G` opens the Field guide, `D` toggles dark mode, `Ctrl K` searches, `Ctrl Z`
undoes a Remix change.

The prototype is buildless and is not part of the npm package (`package.json`
`files` does not include `prototypes/`).

### What is in it

| File | Role |
| --- | --- |
| `index.html` | The lab shell: layout switcher, device frames, Remix panel, Field guide, welcome card |
| `content.js` | One typed document (a fictional espresso machine): chapters, sections with question + short answer, facts, and an API description |
| `skins.js` | Skins, type pairings and presets as plain data |
| `kit.js` / `kit.css` | Shared renderer, settings engine, command palette, hover previews, scrollspy, toasts |
| `handbook.html` | Classic three-pane product docs |
| `reference.html` | API reference: prose beside sticky code, language tabs, method badges, "Try it", Guides tab |
| `help.html` | Support site: hero search with typeahead, mega menu, topic cards, question-first articles |
| `reader.html` | The whole manual on one page: floating "island", minimap scrubber, sidenotes, focus mode |
| `fonts.css` | Google Fonts import for the prototype only (see the font rule below) |

**Remix controls today.** It has five tabs:

- **Style:** 6 presets, 12 skins, light or dark, accent swatches and a picker, 4 card styles, 4 textures, and sliders for corners, shadows and borders.
- **Layout:** sidebar left or right; outline right, left or off; header glass, solid or minimal; current-page marker pill, line, bold or solid; sliders for content width, sidebar width and spacing.
- **Type:** 13 pairings, and sliders for text size, heading size and heading weight.
- **Pieces:** turn on or off search, breadcrumbs, outline, pager, progress, minimap, answer card, feedback and hover previews.
- **Export:** the config, the theme and a share link.

Undo, redo and a change counter work across all tabs.

The owner rejected two earlier layouts: a course/"Academy" layout ("not sure we
should support this direction") and a Finder-style column browser ("feels like a
cheap version of the others"). Don't bring them back without asking.

## Rules this must respect

These accepted decisions govern the work. Read them in full with
`ishoo_decision op:show` before filing.

- **DEC-05: theming is a `--dd-*` CSS custom property contract, and there is no
  theme object.** The studio's output is a block of `--dd-*` values that a
  developer could also write by hand.
- **DEC-12 (accepted 2026-10-25): the studio saves the look as one hand-editable
  CSS file.** The studio reads and writes one host-owned file, `docs-theme.css`,
  of ordinary `--dd-*` declarations. Opening the studio parses the file, so hand
  edits show up in the panel. Structural choices are documented keyword tokens
  in the same file, such as `--dd-sidebar-side: right`. The Vite and Astro
  integrations read them at build time and turn them into stable classes on the
  panel and the static pages. Terminal commands edit the same file. The JSON
  "theme file" in the prototype's Export tab is not the plan.
- **DEC-11: keep the shared renderer and token CSS. Fonts stay host-controlled
  by default, there are no default font downloads, and static pages stay
  complete without JavaScript.** Every behavior the studio adds (island,
  minimap, palette) is an enhancement on top of readable no-script HTML.
- **DEC-13 (accepted 2026-10-25): any Google font or local font, self-hosted.**
  A developer can search and pick any Google font, or drop in their own files.
  dopedocs downloads only the chosen weights once, at development time, into
  the host's site, and writes `@font-face` and the font tokens into
  `docs-theme.css`. Readers never load fonts from Google or any other third
  party. The prototype's `fonts.css` links Google directly; that is demo-only.
- **DEC-09: dopedocs adds docs to an existing website, themed by your own
  tokens.** The studio must be able to start from the host's tokens, not
  replace them. A skin is a starting point the host can alias over.
- **DEC-07: `/docs/<id>` always serves the static page, with the same bar and
  rail as the panel.** Structural options (sidebar side, outline position) must
  render the same in the panel and on static pages.
- **The studio is a development tool.** It never ships to readers. The prototype
  shows it beside the preview. In production, think `dopedocs studio`, or a
  dev-server overlay that writes the theme file.

## Typography: the most important part

Readers mostly look at type, so this has to be taken very seriously. The goal is
desktop-publishing depth with plain-language controls. Each row below gives a
plain name for the panel, what it does, and the CSS that would carry it. Token
names are suggestions.

**How the controls should feel.**

- Show the plain name first and the technical name small underneath, so people
  learn it: *Letter spacing (tracking)*.
- Show **Basic** controls by default and fold **Advanced** away.
- Preview every change live on the user's own content. Add a **type specimen**
  view that shows every role, size and feature at once.
- Only show OpenType toggles the chosen font actually supports. Detect features
  from the font file, for example with a font-parsing library at build time.
- Give every control a reset, a default marker and a guardrail: a minimum size,
  a minimum contrast, and line length kept readable.

### Fonts

| Plain name | What it does | Carries it |
| --- | --- | --- |
| Fonts by role | Separate fonts for headings, body, interface (nav, labels), code, and optionally numbers and captions | `--dd-display`, `--dd-body`, `--dd-sans`, `--dd-mono`, new `--dd-numeric`, `--dd-caption` |
| Your own fonts | Drop in WOFF2/OTF/TTF files or point at the host's existing `@font-face` | generated `@font-face`, `font-display`, `unicode-range` subsets |
| No-jump fallbacks | Fallback fonts sized to match, so text doesn't shift while fonts load | `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` |
| Variable font axes | Weight, width, optical size, slant, grade, and custom axes as sliders | `font-variation-settings`, `font-optical-sizing`, `font-weight`, `font-stretch` |
| Fake bold and italic | Allow or forbid the browser inventing styles the font lacks | `font-synthesis` |

### Size and scale

| Plain name | What it does | Carries it |
| --- | --- | --- |
| Text size | Body size | `--dd-text-size` (in the prototype) |
| Type scale | One ratio sets every heading size: 1.125, 1.2, 1.25, 1.333, 1.5, golden | `--dd-scale-ratio`, generated `--dd-h1`…`--dd-h6` |
| Grows with screen | Fluid sizes between a phone size and a desktop size | `clamp()` per level |
| Per-heading overrides | Fine-tune any one level's size, weight, case, color and spacing | `--dd-h2-size`, `--dd-h2-weight`… |
| Small text | Sizes for sidebar, outline, captions, meta row, table, code | `--dd-nav-size`, `--dd-toc-size`, `--dd-meta-size`, `--dd-code-size` |

### Line and paragraph spacing

| Plain name | What it does | Carries it |
| --- | --- | --- |
| Line spacing (leading) | Body line height. The prototype derives it from text size; make it a direct control too | `--dd-leading` |
| Heading line spacing | Tighter leading for large type | `--dd-heading-leading` |
| Sidebar / outline / table line spacing | Separate leading for dense UI text | `--dd-nav-leading`… |
| Paragraph spacing | Space before and after paragraphs, headings and lists | `--dd-flow`, `--dd-heading-space-before/after` |
| Indented paragraphs | Book-style first-line indent instead of gaps | `text-indent`, `p + p` rule |
| Baseline grid | Snap text to a vertical rhythm, and trim the extra space above caps and below descenders | `text-box-trim`, `text-box-edge`, `line-height` steps |

### Letter spacing and kerning

| Plain name | What it does | Carries it |
| --- | --- | --- |
| Letter spacing (tracking) | Per role: headings, body, labels, all-caps | `--dd-display-track` (in the prototype), `--dd-body-track`, `--dd-caps-track` |
| Auto-tighten big type | Larger headings get slightly negative tracking automatically | computed per level |
| Kerning | Font's built-in kerning on or off | `font-kerning` |
| Word spacing | Space between words | `word-spacing` |

### Line length, wrapping and alignment

| Plain name | What it does | Carries it |
| --- | --- | --- |
| Line length (measure) | Width of the reading column in characters as well as pixels | `--dd-measure` (px today), add `ch` mode |
| Balanced headings | No lonely last words in headings | `text-wrap: balance` |
| Nicer paragraphs | Avoid one-word last lines | `text-wrap: pretty` |
| Hyphenation | Break long words, per language, with limits | `hyphens`, `hyphenate-limit-chars`, `lang` |
| Justified text | Even right edge, with hyphenation forced on | `text-align: justify`, `text-justify` |
| Hanging punctuation | Quotes and bullets hang into the margin | `hanging-punctuation` |
| Widows and orphans | For print and PDF | `widows`, `orphans` |

### OpenType features (the Publisher-level part)

| Plain name | What it does | Carries it |
| --- | --- | --- |
| Small caps | Real small capitals for acronyms, labels, headings; also petite caps, all small caps and titling caps | `font-variant-caps` |
| Number style | Lining or old-style numbers, proportional or tabular (tables align), slashed zero, fractions, ordinals | `font-variant-numeric` |
| Ligatures | Common, discretionary and contextual; separate switch for code | `font-variant-ligatures` |
| Stylistic sets | The font's alternate designs (ss01–ss20), character variants, swashes | `font-feature-settings` |
| Real super/subscripts | Proper glyphs instead of shrunken letters | `font-variant-position` |
| Case-sensitive forms | Punctuation that lines up with capitals | `font-feature-settings: "case"` |

### Case, emphasis, links and decoration

| Plain name | What it does | Carries it |
| --- | --- | --- |
| Letter case per role | Uppercase eyebrows, title case nav, normal body | `text-transform` |
| Emphasis style | Italic, weight, or color for `em`/`strong` | `--dd-em-*` |
| Link style | Color, underline on/hover/none, thickness, offset, skip descenders | `text-decoration-*`, `text-underline-offset` |
| Highlight / mark | Marker color for search hits and `<mark>` | `--dd-mark` |

### Headings, initials, lists, quotes

| Plain name | What it does |
| --- | --- |
| Numbered headings | 1, 1.1, 1.1.1 automatically (CSS counters) |
| Eyebrow / kicker | Small label above a heading: size, case, tracking, color |
| Heading rules | Line above or below headings |
| Anchor link placement | `#` before, after or hidden |
| Drop caps | Large first letter, choice of lines (`initial-letter`, `::first-letter`) |
| List markers | Bullet shape, number style, hanging indent, nested indent, item spacing |
| Quotes | Smart quotes per language (`quotes`), blockquote and pull-quote styles |

### Code, tables, rendering and languages

- **Code:** font, size relative to body, ligatures on or off, `tab-size`, line numbers, wrap or scroll, inline code pill (border, background, padding).
- **Tables:** tabular numbers on by default, header case and tracking, row density, zebra rows, header tint, rounded or square frame.
- **Rendering:** font smoothing and `text-rendering`, and automatic optical size.
- **Languages and scripts:** fonts per language, CJK line breaking (`line-break`, `word-break`), right-to-left with logical properties, vertical text.

### Type presets and accessibility

- **Presets:** whole type systems in one click, such as Book, Technical, Magazine, Interface, Friendly and Dyslexia-friendly.
- **Guardrails:** respect the reader's browser font size (rem-based), warn below about 15px body or below WCAG AA contrast, keep line length roughly 45–90 characters, and honor reduced motion.

## Everything else the panel should reach

Beyond type, the panel should reach:

- **Color:** generate a full palette from one accent, keep contrast checked, adjust light and dark separately, set link color and selection color.
- **Spacing:** one spacing scale with a density control. The prototype has `--dd-density`. Add section spacing and gutters.
- **Motion:** a speed and feel control: calm, snappy or none. Cover page transitions, the sliding active indicator, panel and drawer easing, hover lift, and scroll behavior. Always respect `prefers-reduced-motion`.
- **Page chrome:**
  - Header behavior: sticky, hide-on-scroll or static.
  - Divider under the header.
  - Top-bar links and a call-to-action button.
  - The host website's own header and footer, kept in place. The footer stays at the bottom of the page and the docs sit inside the site.
- **Sidebar:**
  - Left or right side, and width.
  - Group headers: bold, overline or with an icon.
  - Collapsible groups, and indent guides for nested items.
  - A drill-in mode: a section with a back arrow.
  - A filter box with a key hint.
  - External-link markers and badges such as "API".
- **Outline (table of contents):**
  - Position and depth.
  - Nested indent.
  - Indicator: a line segment, a moving thumb or a dot.
  - Truncate or wrap long entries.
- **Page meta row:** last updated, copy as Markdown, view as Markdown, agent setup, and edit page. Choose which appear and the divider style between them.
- **Content blocks:**
  - Callouts, tables and code cards.
  - Tabs, for example package managers.
  - Disclosure rows and badges.
  - Split buttons, like "Copy page" with a dropdown.
  - Feedback ("Was this helpful?").

## Recreate real sites with options only

The owner's test is: could I rebuild these looks with sliders and options alone?
Use these as acceptance targets. Match the look and behavior; never copy
branding.

**Cloudflare docs** (dark, orange accent):

- **Page:** near-black background, warm orange for links, the active outline line and the call-to-action.
- **Top bar:** product links, search with a `Ctrl K` hint, and an orange button.
- **Sidebar:**
  - A product title with an icon, and a "Filter sidebar" box with a `/` hint.
  - Items about 14px, and groups with chevrons.
  - Nested items indented beside a guide line.
  - The active item is a filled, slightly lighter pill.
- **Page header:** small breadcrumbs and an H1 of about 40px semibold.
- **Meta row:** last updated, Copy as Markdown, View as Markdown and Agent setup, separated by thin dividers, with a rule beneath.
- **Body:** about 17px with generous line height (about 1.85). Links are orange and underlined. Inline code pills have a border. Tables have rounded frames and a tinted header row.
- **Right outline:** "On this page" with nested levels and an orange bar segment beside the active entry.
- **Bottom:** "Was this helpful?" Yes and No buttons, then Edit page and Report issue.

**Vercel docs** (pure black, tight grotesque type):

- **Page:** black background, a grotesque face, and tightly tracked headings.
- **Top bar:**
  - Logo / Docs, with Build and Learn menus that open a full-width mega menu.
  - The mega menu has small overline group labels over large 18px links, and it dims the page below.
  - Ask AI, Log In and a white primary Sign Up button.
- **Sidebar:**
  - Search with a `⌘K` hint.
  - A drill-in header with a back chevron.
  - Bold top-level items and muted nested items.
  - A dark filled pill marks the active item.
- **Page header:** breadcrumbs, a bold H1 of about 40px, a "Copy page" split button and a small pill badge.
- **Body:** about 16px in muted grey with bold lead-ins.
- **Content blocks:** disclosure rows with chevrons, and underline-style tabs (pnpm, yarn, npm, bun).
- **Outline:** small, muted, with a left line, nested indent and ellipsis on long entries.

**The gap today:**

- Navigation pieces: mega menu style, drill-in sidebar, sidebar filter with key hint, indent guides.
- Page header: the meta row actions, split button and badges.
- Content blocks: package-manager tabs.
- Type and color details: overline labels, link color and underline controls, table header tint, inline code border.
- Outline: nested outline and its indicator styles.
- Page chrome: divider under the header, top-bar call-to-action, host footer placement.
- Typography: per-role sizes and leading.

## Known prototype bugs and limits

The owner said these don't matter for the proof of concept. Don't fix them in
the prototype; make sure the real build avoids them.

- The settings engine, palette and spies are prototype-grade. `reference.html` adds a new scroll listener every time you switch between Guides and API.
- Reference with the sidebar on the right *and* the outline on the left puts the code panel left of the prose. It works, but it isn't a good combination. Consider forbidding it.
- In Reader, "Sidebar side" moves the margin notes. That's a stretch of meaning; name it per layout.
- The Handbook outline folds into a dropdown below 1180px. With Remix open, that happens on most screens.
- `fonts.css` downloads 14 font families from Google at once. That's fine for the demo, wrong for production (DEC-11, DEC-13).
- The config and theme code in Export is a proposed API only. The real output is `docs-theme.css` (DEC-12), not a JSON file.
- The content model in `content.js` is a simplified mirror of `defineDocs`, plus an API description that the real schema doesn't have yet.
- The code highlighter is regex-based and breaks on strings that contain `&`.
- The share link stores settings in the URL hash as base64 JSON, with no versioning.

## Filed work

Filed in Ishoo on 2026-10-25 across three plans. Read each issue with
`ishoo_show` before starting; the order comes from each issue's dependencies.

**Plan `style-studio`**: the studio and the theme file.

| Issue | What |
| --- | --- |
| STU-01 | Theme file module and `dopedocs theme get/set/list` (terminal parity) |
| LAY-01 | Spacing scale token and line length in characters |
| LAY-03 | Structural keyword tokens: sidebar side, outline, header, current-page marker, card |
| MOT-01 | Motion presets (calm, snappy, none) with reduced motion |
| SKIN-01 | The 12 skins and type presets as importable CSS files |
| STU-02 | `dopedocs studio`: the Remix panel over real docs |
| STU-03 | Presets, undo and redo, share link, type specimen |
| STU-04 | Readability guardrails |
| STU-05 | Acceptance: rebuild the Cloudflare-style and Vercel-style looks with options only |

**Plan `typography-and-fonts`**

| Issue | What |
| --- | --- |
| TYPO-01 | Basic type tokens: roles, scale, leading, tracking, weight |
| TYPO-02 | Advanced type tokens: OpenType features, hyphenation, justification, links, lists, drop caps, numbering |
| FONT-01 | `dopedocs fonts add`: self-host any Google font or local file |
| FONT-02 | Metric-matched fallbacks (no layout jump) |
| FONT-03 | Studio font picker: search and preview every Google font |
| TYPO-03 | Show only the OpenType features the chosen font has |

**Plan `docs-layouts`**

| Issue | What |
| --- | --- |
| LAY-02 | Docs inside the host site's own header and footer |
| NAV-04 | Sidebar filter with key hint |
| NAV-05 | Page meta row and split Copy button (works with COPY-01) |
| NAV-06 | Outline depth, indent and indicator styles |
| NAV-07 | Sidebar drill-in, indent guides, badges |
| NAV-08 | Top-bar mega menu |
| BLK-01 | Tabs and disclosure blocks |
| API-01 | Schema for API endpoints |
| API-02 | Reference layout: two-pane API pages |
| LAY-04 | Help Center layout |
| LAY-05 | Reader layout on the complete manual page |

**Where to start:** STU-01 (the theme file) and TYPO-01 (basic type tokens) have
no blockers. Do those first, then LAY-03, then STU-02 (the studio).
Typography is what readers see most.
