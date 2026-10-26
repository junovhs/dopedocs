# Theming dopedocs

dopedocs reads only `--dd-*` custom properties. You theme it by aliasing your
own tokens onto that namespace - there is no theme object, no configuration
argument, and no build step (DEC-05).

## The whole integration

```css
@import "dopedocs/styles.css";

:root {
    --dd-bg: var(--bg);
    --dd-panel-muted: var(--panel-muted);
    --dd-ink: var(--ink);
    --dd-text: var(--text);
    --dd-text-soft: var(--text-soft);
    --dd-muted: var(--muted);
    --dd-line: var(--line);
    --dd-line-soft: var(--line-soft);
    --dd-edge: var(--edge);
    --dd-accent: var(--accent);
    --dd-sans: var(--sans);
    --dd-mono: var(--mono);
    --dd-ease: var(--ease);
    --dd-spring: var(--spring);
}
```

Alias what you have. Every token below has a working fallback, so a partial
alias renders correctly rather than breaking - which also means a token you
forget fails silently, in the fallback's appearance rather than an error.

## The fallbacks carry no brand

An unthemed dopedocs is plain greyscale on the system font stack, with a
monochrome accent. That is deliberate: dopedocs is meant to look like the app
hosting it, so the defaults are unopinionated rather than some other product's
palette leaking into yours. If your docs still look monochrome, `--dd-accent`
is the token you have not set yet.

For a complete self-hosted font and palette example, see
[`examples/theme`](../examples/theme/README.md). Its font-face CSS is linked by
both the app and static pages; importing a font only into the app is not enough.

## Dark mode

dopedocs defines no dark-mode block, deliberately. Alias tokens that already
respond to your app's theme and dopedocs follows automatically. If dopedocs
declared its own colour scheme it would fight the app it is embedded in.

## Tokens

### Surfaces

| Token | Role | Fallback |
| --- | --- | --- |
| `--dd-bg` | Page and panel ground | `#ffffff` |
| `--dd-panel` | Raised surface | `#ffffff` |
| `--dd-panel-muted` | Inset surface: code, `kbd`, facts card | `#f4f4f5` |
| `--dd-ink` | Darkest surface: the bar and callouts | `#18181b` |

### Text

| Token | Role | Fallback |
| --- | --- | --- |
| `--dd-text` | Headings, strong, emphasis | `#18181b` |
| `--dd-text-soft` | Body prose | `#52525b` |
| `--dd-muted` | Labels, table headers, captions | `#8b8b93` |
| `--dd-on-ink` | Text on `--dd-ink` | `#f4f4f5` |
| `--dd-on-ink-strong` | Strong text on `--dd-ink` | `#ffffff` |
| `--dd-on-accent` | Text on `--dd-accent` (the active nav item) | `#ffffff` |

`--dd-on-ink` and `--dd-on-accent` are separate tokens because a dark surface
and an accent surface rarely take the same foreground. If you invert your
palette for dark mode, these are the two most likely to need attention.

### Rules

| Token | Role | Fallback |
| --- | --- | --- |
| `--dd-line` | Standard 1px rule | `#e4e4e7` |
| `--dd-line-soft` | Lighter rule, between table rows | `#efeff1` |
| `--dd-edge` | Heavier edge: scrollbar thumb, folder marker | `#b8b8c0` |

### Accent

| Token | Role | Fallback |
| --- | --- | --- |
| `--dd-accent` | Active nav item, callout edge | `#18181b` |

### Depth

| Token | Role | Fallback |
| --- | --- | --- |
| `--dd-scrim` | Behind the open panel | `rgb(9 9 11 / 0.72)` |
| `--dd-shadow-lift` | Panel shell shadow | `0 22px 70px rgb(9 9 11 / 0.2)` |

### Type

| Token | Role | Fallback |
| --- | --- | --- |
| `--dd-sans` | All prose and headings | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| `--dd-display` | Titles when a font is explicitly installed | `var(--dd-sans)` |
| `--dd-body` | Body font when explicitly installed | `var(--dd-sans)` |
| `--dd-ui` | Navigation and bar when explicitly installed | Existing sans/mono role |
| `--dd-mono` | Code, `kbd`, the bar | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |

### Shape

| Token | Role | Fallback |
| --- | --- | --- |
| `--dd-radius` | Cards | `4px` |
| `--dd-radius-sm` | Code, `kbd`, callouts | `3px` |
| `--dd-radius-xs` | Nav items, bar controls | `2px` |

### Motion

| Token | Role | Fallback |
| --- | --- | --- |
| `--dd-ease` | Standard easing | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--dd-spring` | Overshoot, on the panel's arrival | `cubic-bezier(0.34, 1.4, 0.64, 1)` |
| `--dd-duration` | Panel transition | `0.24s` |

Under `prefers-reduced-motion: reduce` nothing travels or springs; the panel
still fades, because appearing and disappearing is what makes it usable.

### Layout

| Token | Role | Fallback |
| --- | --- | --- |
| `--dd-measure` | Prose measure | `660px` |
| `--dd-rail` | Nav rail width | `224px` |
| `--dd-column` | Reading column | `752px` |

## Class names are public API

Anything the token contract failed to anticipate is reachable with an ordinary
CSS rule, so no consumer is ever blocked waiting on a dopedocs release. The
trade is that these names are a compatibility surface and renaming one is a
breaking change.

**Content** (shared by the panel and the static pages) -
`dd-identity`, `dd-identity-mark`, `dd-identity-text`, `dd-identity-name`,
`dd-identity-meta`, `dd-identity-dot`, `dd-identity-maker`,
`dd-header`, `dd-title`, `dd-lead`,
`dd-section`, `dd-section-title`, `dd-answer`,
`dd-p`, `dd-list`, `dd-link` (an inline link in prose),
`dd-callout` with `dd-callout--note` / `dd-callout--warn`,
`dd-steps`, `dd-step`, `dd-step-body`, `dd-step-title`, `dd-step-text`,
`dd-checklist`, `dd-check` (with `is-checked`), `dd-check-icon`,
`dd-details`, `dd-details-body`,
`dd-cards`, `dd-card`, `dd-card-title`, `dd-card-text`, `dd-card-label`,
`dd-quote`, `dd-metrics`, `dd-metric`, `dd-metric-value`, `dd-metric-detail`,
`dd-compare`, `dd-compare-item` with `dd-compare-item--before` /
`dd-compare-item--after`, `dd-compare-title`, `dd-compare-text`,
`dd-keys`, `dd-table-scroll`, `dd-table`,
`dd-facts`, `dd-facts-title`, `dd-facts-rows`,
`dd-figure`, `dd-media`, `dd-media-link`, `dd-figcaption`, `dd-gallery`,
`dd-gallery-item`, `dd-gallery--2`, `dd-gallery--3`, and image position classes
`dd-media--center` / `--top` / `--bottom` / `--left` / `--right`.

**Panel chrome** -
`dd-overlay` (with `is-open`), `dd-shell`,
`dd-bar`, `dd-back`, `dd-bar-page`, `dd-esc`,
`dd-body`, `dd-nav`, `dd-nav-label`, `dd-nav-list`,
`dd-nav-link` (with `is-active`), `dd-nav-group`, `dd-main`.

**Static page** - `dd-page`, which replaces the overlay chrome entirely,
plus `dd-contents` (the index's list of sections) and `dd-pager`, `dd-pager-label`, `dd-pager-title`, `dd-pager-all` (the
previous / all / next row at the foot of each section page).

## Optional code highlighting

`code` blocks always work as plain escaped `pre`/`code`. Build-time Shiki
preparation adds semantic classes without inline colours. Override any of:

| Token | Fallback |
| --- | --- |
| `--dd-code-keyword` | `--dd-accent` |
| `--dd-code-string` | `--dd-text-soft` |
| `--dd-code-number` | `--dd-accent` |
| `--dd-code-comment` | `--dd-muted` |
| `--dd-code-function` | `--dd-accent` |
| `--dd-code-type` | `--dd-text` |
| `--dd-code-punctuation` | `--dd-text-soft` |

Classes: `dd-code-block`, `dd-code-language`, `dd-code`, and
`dd-code-token--keyword` / `--string` / `--number` / `--comment` / `--function` /
`--type` / `--punctuation`. The host's dark palette controls these as usual.

### Basic typography

These tokens are optional. Unset tokens retain the original contextual sizes
and weights. Set them on `:root` or the docs container; font roles fall back to
`--dd-sans` (and `--dd-ui` remains supported for interface fonts).

| Token | Role | Unset behavior |
| --- | --- | --- |
| `--dd-display` | Headings font | `--dd-sans` |
| `--dd-body` | Reading font | `--dd-sans` |
| `--dd-caption` | Caption font | body font |
| `--dd-text-size` | Paragraph, answer and list size | 15.5px |
| `--dd-scale-ratio` | Heading scale multiplier relative to 1.25 | 1.25 preserves existing fluid sizes |
| `--dd-h1-size` | Title override | clamp(28px, 3.4vw, 38px), 27px on narrow screens |
| `--dd-h2-size` | Section heading override | clamp(20px, 2.4vw, 24px) |
| `--dd-h3-size` | Subheading override | clamp(16px, 2vw, 18px) |
| `--dd-h4-size` | Fourth-level heading override | 1rem |
| `--dd-leading` | Body line height | 1.75 |
| `--dd-heading-leading` | Heading line height | title 1.16, section 1.3 |
| `--dd-nav-leading` | Navigation line height | link 1.4, group 1.5 |
| `--dd-display-track` | Heading letter spacing | -0.025em |
| `--dd-body-track` | Body letter spacing | normal |
| `--dd-caps-track` | Label letter spacing | existing contextual spacing |
| `--dd-heading-weight` | Heading weight | title 700, section 650 |
| `--dd-nav-size` | Sidebar link size | 13px |
| `--dd-toc-size` | Contents link size | 14px |
| `--dd-meta-size` | Reading context size | 12px |
| `--dd-code-size` | Code size | inline 12.5px, block 13px |

Headings balance their lines and paragraphs use pretty wrapping where supported.
Use rem or clamp() values to follow the reader's preferred font size.

### Advanced typography

Native OpenType options take effect only when the selected font supports them.
These settings apply to reading content, leaving navigation controls readable.
Unsupported browser CSS is progressively ignored. Set a correct HTML `lang`
on the host document for language-dependent hyphenation; `--dd-hyphens: auto`
is recommended with justified text (dictionary availability varies by browser).

| Token | CSS value / purpose | Default |
| --- | --- | --- |
| `--dd-small-caps` | font-variant-caps, e.g. small-caps | normal |
| `--dd-number-style` | font-variant-numeric, e.g. oldstyle-nums proportional-nums slashed-zero | normal |
| `--dd-ligatures` | font-variant-ligatures, e.g. common-ligatures discretionary-ligatures | normal |
| `--dd-features` | font-feature-settings, e.g. `"ss01" 1, "case" 1` | normal |
| `--dd-variations` | font-variation-settings, e.g. `"wght" 500` | normal |
| `--dd-optical-sizing` | auto or none | auto |
| `--dd-font-synthesis` | none to forbid synthesized styles | weight style small-caps |
| `--dd-kerning` | auto, normal or none | auto |
| `--dd-word-spacing` | word spacing length | normal |
| `--dd-hyphens` | none, manual or auto | manual |
| `--dd-hyphen-limit` | hyphenate-limit-chars, e.g. 6 3 3 | auto |
| `--dd-text-align` | start or justify | start |
| `--dd-text-justify` | auto or inter-word | auto |
| `--dd-hanging-punctuation` | none, first, last, allow-end | none |
| `--dd-paragraph-gap` | Paragraph end spacing; use 0 for book style | 16px |
| `--dd-paragraph-indent` | First line of adjacent paragraphs | 0 |
| `--dd-widows` | Minimum lines at top of printed page | 2 |
| `--dd-orphans` | Minimum lines at bottom of printed page | 2 |
| `--dd-link-decoration` | underline or none | underline |
| `--dd-link-hover-decoration` | Set underline with base decoration none for hover-only | base decoration |
| `--dd-link-thickness` | Underline thickness | auto |
| `--dd-link-offset` | Underline offset | 3px |
| `--dd-link-underline-color` | Underline color | accent |
| `--dd-link-style` | solid, dotted, dashed, wavy | solid |
| `--dd-link-skip-ink` | auto or none | auto |
| `--dd-bullet-style` | Unordered marker, e.g. square | disc |
| `--dd-list-number-style` | Ordered marker, e.g. lower-roman | decimal |
| `--dd-list-indent` | List indent | 19px |
| `--dd-list-item-gap` | List item spacing | 8px |
| `--dd-drop-cap` | initial-letter line count; browser support varies | normal |
| `--dd-drop-cap-size` | First-letter fallback size | inherit |
| `--dd-heading-number` | Set `counter(dd-h2) ". "` for numbered sections | none |
| `--dd-subheading-number` | Set `counter(dd-h2) "." counter(dd-h3) " "` | none |
| `--dd-code-ligatures` | Code ligatures, e.g. none | normal |
| `--dd-code-ratio` | Code size relative to body | inline 0.80645, block 0.83871 |
| `--dd-tab-size` | Code tab width | 4 |
| `--dd-table-numbers` | Table number style | tabular-nums |

For book-style paragraphs set gap to 0 and indent to 1.5em. Heading numbers
use native counters and require no script. Drop caps are opt-in on prose
paragraphs. Tables use tabular figures by default; set normal to opt out.

### Structural keywords

Pass `themeFile: 'public/docs-theme.css'` to the Vite/Astro integration, and
include that file in `stylesheet` after the bundled CSS. The integration reads
its `:root` tokens on each build/dev request and adds stable classes to static
page roots. The panel reads the same tokens from its inherited CSS on mount.
Unknown keywords warn and preserve the original layout. Unset tokens add no
classes, preserving existing output. Hand-editing a structural choice requires
a rebuild/reload. These values are keywords, not CSS expressions or aliases.

| Token | Values | Class prefix |
| --- | --- | --- |
| `--dd-sidebar-side` | left, right | dd-sidebar-side- |
| `--dd-outline` | right, left, off | dd-outline- |
| `--dd-header` | glass, solid, minimal | dd-header- |
| `--dd-current` | pill, line, bold, solid | dd-current- |
| `--dd-card` | raised, outline, flat, tint | dd-card- |

The outline refers to the generated contents on the whole-manual page.
On small screens side outlines return to normal flow and navigation stays above
content. Default pages retain the original left rail and inline contents.
