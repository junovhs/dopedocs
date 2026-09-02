# Theming dopedocs

dopedocs reads only `--dd-*` custom properties. You theme it by aliasing your
own tokens onto that namespace — there is no theme object, no configuration
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
alias renders correctly rather than breaking — which also means a token you
forget fails silently, in the fallback's appearance rather than an error.

## The fallbacks carry no brand

An unthemed dopedocs is plain greyscale on the system font stack, with a
monochrome accent. That is deliberate: dopedocs is meant to look like the app
hosting it, so the defaults are unopinionated rather than some other product's
palette leaking into yours. If your docs still look monochrome, `--dd-accent`
is the token you have not set yet.

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

**Content** (shared by the panel and the static pages) —
`dd-identity`, `dd-identity-mark`, `dd-identity-text`, `dd-identity-name`,
`dd-identity-meta`, `dd-identity-dot`, `dd-identity-maker`,
`dd-header`, `dd-title`, `dd-lead`,
`dd-section`, `dd-section-title`, `dd-answer`,
`dd-p`, `dd-list`,
`dd-callout` with `dd-callout--note` / `dd-callout--warn`,
`dd-keys`, `dd-table-scroll`, `dd-table`,
`dd-facts`, `dd-facts-title`, `dd-facts-rows`.

**Panel chrome** —
`dd-overlay` (with `is-open`), `dd-shell`,
`dd-bar`, `dd-back`, `dd-bar-page`, `dd-esc`,
`dd-body`, `dd-nav`, `dd-nav-label`, `dd-nav-list`,
`dd-nav-link` (with `is-active`), `dd-nav-group`, `dd-main`.

**Static page** — `dd-page`, which replaces the overlay chrome entirely,
plus `dd-contents` (the index's list of sections) and `dd-pager` (the
previous / all / next row at the foot of each section page).
