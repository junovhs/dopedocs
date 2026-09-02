# dopedocs

A typed documentation engine. You author your docs once, as TypeScript data;
dopedocs renders them both as an in-app panel and as crawlable static pages that
answer engines can read.

Its premise is that documentation fails on the machine-readable side not because
there is too little content, but because the same fact gets stated differently
on different surfaces. So dopedocs makes contradiction a build error rather than
a review problem.

## What the compiler enforces

- **Every section carries a question and a self-contained answer.** They are
  required fields, not conventions, so an unannotated section does not compile
  and the `FAQPage` graph is generated rather than authored.
- **Every factual claim is defined once, in a facts registry, and interpolated
  into prose.** The sentence a reader sees and the value in the structured data
  are the same string, so they cannot drift.
- **The entity declares what it is not.** Name collisions are the common way an
  answer engine gets a product wrong, so disambiguation is required input.

## What it emits

One source produces the in-app panel, a static page per section at a real URL,
the JSON-LD entity graph, `sitemap.xml`, `robots.txt` with search and training
crawlers ruled separately, `llms.txt`, and `questions.json` for regression
testing what the engines actually say back.

---

# Integration

Five steps. Nothing here needs a sibling checkout or a link step.

## 1. Install

```sh
npm i dopedocs
```

## 2. Add the plugin

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { dopedocs } from "dopedocs/vite";
import { docs } from "./src/docs";

export default defineConfig({
    plugins: [dopedocs({ docs, stylesheet: true })],
});
```

`stylesheet: true` emits dopedocs' own stylesheet beside the pages and links it.
Pass an href string instead only if you are emitting that file yourself -
getting that wrong renders the static pages unstyled with no error.

**To theme the static pages, pass a list.** The in-app panel picks up your
`--dd-*` aliases from your app's bundled CSS, but the static pages load only
what they link - so without this they render in the neutral fallback palette,
and the pages search engines see are the ones that look nothing like your app:

```ts
dopedocs({ docs, stylesheet: [true, "/docs-theme.css"] })
```

Sheets link in order, so put your aliases last. `/docs-theme.css` is yours to
serve - in Vite, `public/docs-theme.css` holding just the `:root` alias block.

## 3. Alias your design tokens

dopedocs reads only `--dd-*` custom properties, so it looks like your app rather
than like dopedocs. Alias what you have; every token has a working fallback.

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
}
```

The unthemed defaults are deliberately plain greyscale on the system font stack.
If your docs still look monochrome, `--dd-accent` is the token you have not set.
Full list in [`styles/TOKENS.md`](./styles/TOKENS.md).

## 4. Write the content

```ts
// src/docs.ts
import { defineDocs, defineFacts } from "dopedocs";

const facts = defineFacts({
    price: { value: "free", reviewed: "2026-09-02" },
    storage: { value: "your browser", reviewed: "2026-09-02" },
});

export const docs = defineDocs({
    entity: {
        name: "Your App",
        url: "https://yourapp.com",
        legalName: "Your Company Ltd",
        notToBeConfusedWith: ["YourApp Analytics", "Your App (the band)"],
        sameAs: ["https://github.com/you"],
    },
    title: "How Your App works",
    lead: "Your App does one thing, and this page is how.",
    facts,
    sections: [
        {
            id: "what-it-is",
            title: "What this is",
            question: "What is Your App?",
            answer: "Your App orders your work for you, and it is {fact:price}.",
            keywords: ["task order", "decision fatigue"],
            blocks: [
                { kind: "p", text: "An ordinary paragraph with **emphasis** and `code`." },
                { kind: "callout", text: "The sentence you most need to not miss." },
            ],
        },
        {
            id: "data",
            title: "Your data",
            question: "Where does Your App store my data?",
            answer: "Your App stores your list in {fact:storage}.",
            blocks: [{ kind: "p", text: "Your list lives in {fact:storage}." }],
            children: [
                {
                    id: "export",
                    title: "Export",
                    question: "Can I export my data?",
                    answer: "Your App exports everything as JSON at any time.",
                    blocks: [{ kind: "keys", rows: [["Esc", "Close the dialog"]] }],
                },
            ],
        },
    ],
});
```

`children` gives one level of nesting, which the nav rail renders as a folder.

### Rules the build enforces

A section fails the build if its `id` is not a URL-safe slug, its `question` is
empty, its `answer` opens with an outward-referring pronoun ("It stores…" rather
than "Your App stores…") or runs past 320 characters, it nests more than one
level deep, or it references a fact that is not in the registry. Stale
`reviewed` dates are reported but do not block.

## 5. Mount the panel

```ts
import { mountPanel } from "dopedocs/panel";
import { docs } from "./docs";

const panel = mountPanel(document.body, docs);
document.querySelector("#docsButton")!.addEventListener("click", () => panel.open());
```

The panel reads the URL on mount, so arriving at `/docs/what-it-is/` from a
search result opens it at that section. Do not also call `open()` on boot.

---

## Block kinds

| Kind | Shape |
| --- | --- |
| `p` | `{ kind: "p", text }` |
| `list` | `{ kind: "list", items, ordered? }` |
| `callout` | `{ kind: "callout", text, tone?: "note" \| "warn" }` |
| `keys` | `{ kind: "keys", rows: [keys, does][] }` |
| `table` | `{ kind: "table", head: [a, b], rows: [a, b][] }` |
| `facts` | `{ kind: "facts", title?, mark?, rows: [label, value][] }` |

Prose carries two inline marks - `` `code` `` and `**strong**` - plus
`{fact:key}` references. Anything richer becomes a new block kind, never new
syntax.

## Brandmarks

`identity.mark` and a `facts` block's `mark` each take one of two forms:

```ts
mark: "/logo.png"                       // any image: png, jpg, webp, or an .svg file
mark: '<svg viewBox="0 0 32 32">...'    // inline SVG
```

**An image URL always works**, because it needs no stylesheet.

**Inline SVG must be self-contained** — presentation attributes or
`currentColor`, never class names styled from your app's CSS. The static pages
link dopedocs' stylesheet, not your bundle, so a mark drawn by your own classes
falls back to SVG's defaults there: a `<circle>` meant as a ring renders as a
filled disc, on the pages search engines see, with no error to warn you.

```ts
// Works everywhere: the stroke is on the element.
'<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="5"/></svg>'
```

A mark is decorative — the card names the thing in text beside it — so it is
hidden from assistive technology rather than given invented alt text.

## Crawler policy

`robots.txt` rules search crawlers separately from training crawlers, because
they are separate decisions. The defaults allow search and refuse training:

```ts
dopedocs({
    docs,
    stylesheet: true,
    robots: { allowTraining: false, allowSearch: true },
})
```

Search: `Googlebot`, `Bingbot`, `OAI-SearchBot`, `PerplexityBot`,
`Claude-SearchBot`, `DuckDuckBot`. Training: `GPTBot`, `ClaudeBot`,
`Google-Extended`, `CCBot`. Both lists are replaceable.

An existing `robots.txt` or `sitemap.xml` of your own is merged, not replaced.

## Without Vite

`buildStatic(docs, options)` returns a map of output path to contents and writes
nothing, so any host can persist it:

```ts
import { buildStatic } from "dopedocs/static";

for (const [path, contents] of Object.entries(buildStatic(docs, { stylesheet: "/docs.css" }))) {
    // write path
}
```

## Installing an unreleased commit

```sh
npm i github:junovhs/dopedocs
```

`dist/` is gitignored, so a git install builds the package through its `prepare`
script. This needs a toolchain at install time and pins a commit rather than a
version; the registry install is the supported path.

## Status

Early. The API is not stable.

MIT.
