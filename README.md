# dopedocs

**Documentation for your site, as a drop-in.**

You write your docs once, as TypeScript data. dopedocs gives you two finished
surfaces from it: a documentation panel inside your app, and a real page per
section at a real URL that anyone — a reader, a search engine, an answer engine
— can read without running your JavaScript.

It exists because this is the part everyone rebuilds. A panel, a nav rail, a
scrollspy, anchors that survive a reload, a sitemap, structured data, a page
that works with JavaScript off — none of it is hard, all of it is a week, and
you end up doing it again on the next project. This is that week, packaged.

## What you get

- A **panel in your app**, mounted in one line, with a nav rail and folders.
- A **page per section** at `/docs/<id>/`, complete without JavaScript, each one
  carrying a bar back to your app and a rail of every section.
- The **machine-readable set**, generated rather than authored: a JSON-LD entity
  graph, `sitemap.xml`, `robots.txt` that rules search and training crawlers
  separately, `llms.txt`, and `questions.json`.
- **Your styling.** dopedocs reads only `--dd-*` custom properties, so it looks
  like your product rather than like dopedocs.

Nothing here needs a sibling checkout, a link step, or a build in your tree.

## A machine-readable layer, even if the rest of your site isn't one

Most sites are built for people and then hope for the best with search and
answer engines. dopedocs is the other way round: the pages it emits are the
part of your site a machine can actually use, and you get them by writing your
documentation rather than by doing SEO work.

Each section is a real page at a real URL, complete without JavaScript, and it
arrives annotated — an `Organization` or `SoftwareApplication` entity with one
stable id, a `TechArticle` per section, `BreadcrumbList`, and a `FAQPage` built
from the question and answer every section is required to carry. Alongside them
sit `sitemap.xml`, a `robots.txt` that rules search and training crawlers
separately, and `llms.txt`.

So a site that is otherwise a single opaque bundle still gets a surface an
answer engine can quote correctly, and can attribute to the right product —
which is what `notToBeConfusedWith` is for.

`questions.json` is the other half of that: a list of every question your docs
claim to answer, with the answer and its URL. It exists so you can ask the
engines those questions on a schedule and check what comes back, rather than
guessing whether any of this landed.

## Why you can trust what it says

Documentation goes wrong quietly. The panel says one thing, the page says
another, and the structured data says a third — usually because someone updated
one of them. dopedocs is built so that cannot happen, and so the parts a machine
quotes are checked rather than hoped for:

- **One source, two surfaces.** The panel and the static page render from the
  same document, so they cannot drift apart.
- **Facts are defined once and interpolated.** The sentence a reader sees and
  the value in the structured data are the same string.
- **Every section carries a question and a self-contained answer.** They are
  required fields, not conventions, so the `FAQPage` graph is generated from
  what you wrote rather than maintained beside it.
- **The entity declares what it is not.** A name collision is the ordinary way
  an answer engine attributes someone else's facts to your product.
- **Contradiction is a build error.** A missing answer, a fact that does not
  exist, an unlabelled image: the build fails at your keyboard rather than in a
  reader's browser.

---

# Integration

Five steps.

## 1. Install

```sh
npm i dopedocs
```

## 2. Add the plugin

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { dopedocs } from "dopedocs/vite";
import { docs } from "./src/docs.ts";

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

These same aliases style the static pages' bar and rail, so the chrome matches
your product without a second stylesheet.

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
    // Optional: the release card at the top of the docs. `mark` points at a
    // file you serve — drop it if you have not got one yet.
    identity: {
        name: "Your App",
        version: "1.4.0",
        channel: "Beta",
        maker: { name: "Your Company", href: "#who-makes-this" },
        mark: "/logo.png",
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
level deep, or it references a fact that is not in the registry. An `image` with
a blank `alt` fails too. Stale `reviewed` dates are reported but do not block.

## 5. Mount the panel

```ts
import { mountPanel } from "dopedocs/panel";
import { docs } from "./docs";

const panel = mountPanel(document.body, docs);
document.querySelector("#docsButton")!.addEventListener("click", () => panel.open());
```

The panel reads the URL when it mounts, so do not also call `open()` on boot.
Opening it pushes `/docs/<id>/` through the History API, which is why in-app
navigation keeps the address bar in step without a page load.

That is in-app navigation. Someone who *arrives* at that address from outside
gets the static page — see below.

---

## What a reader gets at `/docs/<id>/`

A section owns one address, and two correct behaviours want it. Inside your app
the panel opens at that path with no server request. But a request that actually
reaches the server — a search result, a pasted link, a reload — is always served
**the static page**, because that is what a crawler must receive, and serving
people something different from crawlers is the shape of cloaking.

So the static page is a destination, not a fragment. Every one carries:

- a **bar** linking back to your app, labelled with `entity.name`;
- a **rail** of every section, children nested under their parent, with the
  current one marked;
- the section itself, and links to the previous and next.

All of it is derived from the document you already wrote — `entity.url`,
`entity.name`, `docs.title`, the section tree — so there is nothing to configure
and nothing to keep in step. The back link's destination comes from
`entity.url`: a site at a domain root gets `/`, one served under `/product/`
gets `/product/`.

Links a reader follows are paths, not absolute URLs, so a local build or a
preview deployment stays where it is instead of bouncing you to production.
Addresses a machine reads — the canonical tag, `og:url`, the JSON-LD ids,
`sitemap.xml` and `llms.txt` — stay absolute, because there the whole point is
naming one address unambiguously.

The page is complete with JavaScript disabled. dopedocs adds no script to it.

---

## The document

### `entity` — what the docs are about

| Field | |
| --- | --- |
| `name` | Required. |
| `url` | Required. The site's address; the back link and every canonical URL derive from it. |
| `notToBeConfusedWith` | Required, and required for a reason: it generates `disambiguatingDescription`. |
| `legalName` | Registered name, when it differs from the trading name. |
| `tagline` | One line, used as the entity's description. |
| `logo` | Used for `og:image`. |
| `sameAs` | Authoritative profiles elsewhere. |
| `contactEmail` | Published as the entity's `email`. |

### `identity` — the release card

Optional. Omit it and nothing renders; include it and the docs open with a card
naming the product, its version and who makes it.

| Field | |
| --- | --- |
| `name` | Required when `identity` is present. |
| `version` | e.g. `"1.4.0"`. Also published as `softwareVersion` when `entityType` is a software type. |
| `channel` | e.g. `"Preview"`, `"Beta"`. |
| `maker` | `{ name, href? }`. An `href` of `#some-id` links to that section. |
| `mark` | A brandmark — see [Brandmarks](#brandmarks). |

### `sections`

| Field | |
| --- | --- |
| `id` | Required. URL-safe slug; it is the public address, so renaming one breaks links. |
| `title` | Required. |
| `question` | Required. The query this section is retrieved for. |
| `answer` | Required. Self-contained, at most 320 characters. |
| `blocks` | The body — see [Block kinds](#block-kinds). |
| `children` | One level of nesting, rendered as a folder. |
| `keywords` | Optional, published as the article's keywords. |

---

## Block kinds

| Kind | Shape |
| --- | --- |
| `p` | `{ kind: "p", text }` |
| `list` | `{ kind: "list", items, ordered? }` |
| `callout` | `{ kind: "callout", text, tone?: "note" \| "warn" }` |
| `steps` | `{ kind: "steps", items: { title, text }[] }` |
| `checklist` | `{ kind: "checklist", items: { text, checked? }[] }` |
| `details` | `{ kind: "details", summary, text, open? }` |
| `cards` | `{ kind: "cards", items: { title, text, href?, label? }[] }` |
| `quote` | `{ kind: "quote", text, attribution?, cite? }` |
| `metrics` | `{ kind: "metrics", items: { value, label, detail? }[] }` |
| `compare` | `{ kind: "compare", before: { title, text }, after: { title, text } }` |
| `keys` | `{ kind: "keys", rows: [keys, does][] }` |
| `table` | `{ kind: "table", head: [a, b], rows: [a, b][] }` |
| `facts` | `{ kind: "facts", title?, mark?, rows: [label, value][] }` |
| `image` | `{ kind: "image", src, alt, caption?, width?, height?, srcset?, sizes?, sources?, loading?, fetchPriority?, position?, href? }` |
| `gallery` | `{ kind: "gallery", images, columns?: 2 \| 3, label? }` |
| `video` | `{ kind: "video", src, poster?, caption? }` |

Prose carries two inline marks - `` `code` `` and `**strong**` - plus
`{fact:key}` references. Anything richer becomes a new block kind, never new
syntax.

## Widgets for manuals and walkthroughs

These blocks are for product tours, setup guides, handbooks and user manuals,
not only API documentation. They render as semantic HTML in both surfaces and
need no JavaScript:

```ts
{ kind: "steps", items: [
  { title: "Write down the task", text: "Use the words already in your head." },
  { title: "Answer three prompts", text: "Rough answers are enough." },
  { title: "Start at the top", text: "The list puts the next thing first." },
] }

{ kind: "checklist", items: [
  { text: "The task has a clear outcome", checked: true },
  { text: "The deadline is recorded" },
] }

{ kind: "details", summary: "Why am I being asked this?",
  text: "The answer helps the product order the list.", open: false }

{ kind: "cards", items: [
  { title: "Take the tour", text: "Create a first task in two minutes.",
    href: "/docs/first-task/", label: "Start" },
  { title: "Keep nearby", text: "A plain reference card does not need a link." },
] }

{ kind: "quote", text: "I stopped negotiating with my list.",
  attribution: "A reader", cite: "https://example.com/story" }

{ kind: "metrics", items: [
  { value: "3", label: "Questions", detail: "For a useful first pass" },
  { value: "{fact:price}", label: "Price" },
] }

{ kind: "compare",
  before: { title: "Before", text: "Everything looked equally urgent." },
  after: { title: "After", text: "One clear next task sits at the top." } }
```

`steps` describe an ordered procedure. `checklist` is intentionally static:
its checked state records what the manual says is complete, but it does not
pretend to be application state. `details` uses the native disclosure element,
so it remains keyboard-operable with JavaScript disabled. Cards with `href`
are links; cards without one are informational articles. Metric items render
as a description list, and comparisons collapse to one column on narrow
screens.

## Pictures and video

```ts
{ kind: "image", src: "/shot.png", alt: "The order, most urgent first",
  caption: "The list as it appears.", width: 1200, height: 800 }

{ kind: "image",
  src: "/tour-wide-1200.webp",
  srcset: "/tour-wide-640.webp 640w, /tour-wide-1200.webp 1200w",
  sizes: "(max-width: 700px) 100vw, 660px",
  sources: [
    { srcset: "/tour-tall.webp", media: "(max-width: 500px)", type: "image/webp" },
  ],
  alt: "The guided intake on a narrow phone and a wide desktop",
  width: 1200, height: 760, loading: "eager", fetchPriority: "high",
  position: "top", href: "/tour-wide-original.webp" }

{ kind: "gallery", columns: 3, label: "The three setup screens", images: [
  { src: "/setup-1.webp", alt: "Name your task", caption: "1. Name it." },
  { src: "/setup-2.webp", alt: "Choose a deadline", caption: "2. Date it." },
  { src: "/setup-3.webp", alt: "Review the ordered list", caption: "3. Start." },
] }

{ kind: "video", src: "/tour.webm", poster: "/tour-still.png", caption: "A two minute tour." }
```

Both render as a `<figure>` sized to the reading column, styled from the same
tokens as the prose around them, so a screenshot needs no CSS of yours.

`alt` is **required** on standalone and gallery images — an unlabelled image is
invisible to a screen reader and to an answer engine alike, so omitting it is a
compile error and leaving it blank is a build finding. `width` and `height` are
optional positive whole-pixel attributes, which let the browser reserve space
before the file arrives.

`srcset` and `sizes` describe resolution candidates on the fallback `<img>`.
`sources` adds ordered `<source>` elements for art direction or newer formats;
the required `src` remains the universal fallback. `loading` defaults to
`"lazy"`; use `"eager"` with `fetchPriority: "high"` only for the first image
a reader sees. `position` publishes an object-position class for cropped
screenshots, and `href` links to a full-size original without adding a lightbox
or script.

A gallery is an accessible group of ordinary figures. Each image keeps its own
alt text and caption, and the grid collapses to one column below 620px.

### Accessible manuals and printing

The bundled stylesheet treats manuals as documents, not only screens. Keyboard
focus is visible on navigation, disclosure summaries, cards and linked images;
Windows High Contrast and other forced-colour modes receive system-colour token
aliases; and reduced-motion preferences remove panel travel and widget hover
motion.

Printing a static page or an open documentation panel removes panel chrome,
expands disclosure content, prevents individual widgets and figures from being
split where the browser can avoid it, and lets wide tables wrap instead of
clipping inside a horizontal scroller. Consumer themes need no print overrides,
though they can still add product-specific headers or footers around dopedocs.

Video is `controls preload="metadata"` and nothing else: no autoplay, no
tracking, no third-party embed. A `src` is a `src` — host the file yourself.

Captions are prose, so `**strong**`, `` `code` `` and `{fact:key}` all work in
them. `alt` is plain text, because it ends up inside an attribute.

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

An existing `robots.txt` or `sitemap.xml` of your own is merged, not replaced,
and merging is idempotent — building twice never repeats a rule or an entry.

## Options

Everything the plugin accepts besides `docs`. `buildStatic` takes the same set.

| Option | Default | |
| --- | --- | --- |
| `stylesheet` | none | `true` emits and links dopedocs' sheet; a string is an href you serve; an array links each in order. |
| `entityType` | `"Organization"` | The schema.org type for your entity. **Usually worth setting** — `"SoftwareApplication"` for an app, `"Product"`, `"WebApplication"`. |
| `basePath` | `"docs"` | Where the pages live, so `/help/<id>/` instead of `/docs/<id>/`. |
| `robots` | search allowed, training refused | See [Crawler policy](#crawler-policy). |
| `staleAfterDays` | `365` | How old a fact's `reviewed` date may be before it is reported. |
| `fullManualNote` | on | A visible line on every page saying the whole manual is one page (the index), so a reader or an AI assistant landing on one section knows where the rest is. Override the wording with `{ section, index }` using `{title}`, `{link}` and `{words}`; `false` turns it off. |
| `now` | the clock | Injected for deterministic output. |

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
