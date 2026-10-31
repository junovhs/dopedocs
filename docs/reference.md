# dopedocs reference

[Install and integrate](../README.md). This reference covers the full content, media, rendering and build options.

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
| `schemaProperties` | Extra schema.org properties for the entity, merged in as written — see below. |

#### `schemaProperties` — what your kind of entity needs

The fields above are what dopedocs guarantees. A business usually needs more —
a travel agency its `telephone`, `address` and `areaServed`; a plumber its
`openingHours`. Pass those through:

```ts
entity: {
    name: "Wanderly Travel",
    url: "https://wanderly.example",
    notToBeConfusedWith: ["Wanderly (the app)"],
    schemaProperties: {
        telephone: "+1-555-0100",
        address: { "@type": "PostalAddress", addressLocality: "Portland", addressCountry: "US" },
        areaServed: ["Oregon", "Washington"],
    },
},
```

with `entityType: "TravelAgency"` in the [options](#options).

This is the one escape hatch from the typed model, and it costs what you would
expect: a misspelt property or a wrongly shaped value is published as written.
dopedocs does not model or validate schema.org, and does not claim to. What it
does check is that you do not set a property it writes itself — `name`, `url`,
`description`, `disambiguatingDescription`, any `@` key, and the rest of the
table above. That is a build error naming the field to use instead, so the
entity's id and its disambiguation cannot be overwritten by accident, and a
value is never silently dropped.

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

A section is a **page** or a **group**.

| Page field | |
| --- | --- |
| `id` | Required. URL-safe slug; it is the public address, so renaming one breaks links. |
| `title` | Required. |
| `question` | Required. The query this section is retrieved for. |
| `answer` | Required. Self-contained, at most 320 characters. |
| `blocks` | The body — see [Block kinds](#block-kinds). |
| `keywords` | Optional, published as the article's keywords. |

| Group field | |
| --- | --- |
| `id` | Required. A slug that keys the fold; not a URL, since a group has no page. |
| `title` | Required. The chapter label. |
| `landing` | Optional `DocPage` overview (id, title, question, answer and blocks), linked from the chapter label and read before its children. Its id must be unique across groups, pages and articles. |
| `children` | Required. Pages or subgroups, with no more than three nested groups. May be empty when the group has a landing page. |

### `reference` — a developer reference

Optional. A reference is one long page at `/<base>/<id>/`, published beside
the manual: each entry is a row with its prose on the left and its code on the
right, and the code stays in view while the row scrolls. Narrow screens and
print stack the two. It isn't tied to HTTP: an entry can be a function, a
message on a socket, a command, an endpoint or a file format.

```ts
reference: {
    id: "reference", title: "Developer reference",
    question: "How do I use Garden from code?",
    answer: "Garden's reference lists every function and message.",
    blocks: [],
    code: [{ title: "Quick start", samples: [{ label: "Python", language: "python", code: "garden.plant()" }] }],
    groups: [{ id: "plants", title: "Plants", entries: [{
        id: "plant", title: "plant()", badge: "fn",
        signature: "garden.plant(name, depth=2) -> Plant",
        question: "How do I plant something with Garden?",
        answer: "Garden's plant() adds one plant and returns it.",
        fields: [{ title: "Parameters", fields: [
            { name: "name", type: "str", required: true, description: "What to plant." },
            { name: "depth", type: "int", default: "2", description: "In centimetres." },
        ] }],
        errors: [{ code: "SoilError", description: "The bed is full." }],
        code: [{ title: "Example", samples: [
            { label: "Python", language: "python", code: "garden.plant(\"mint\")" },
            { label: "Node.js", language: "js", code: "await garden.plant(\"mint\")" },
        ] }],
        guide: "first-task",
    }] }],
},
```

| Field | |
| --- | --- |
| `id`, `title`, `question`, `answer`, `blocks` | The overview, a page like any other. `id` is the URL. |
| `code` | Panels beside the overview, such as a quick start. |
| `groups` | Labelled runs of entries: `{ id, title, entries }`. The label shows in the rail and above each entry. |

An entry is a page (`id`, `title`, `question`, `answer`, optional `blocks`) with:

| Entry field | |
| --- | --- |
| `badge` | A short kind label in the rail and beside the signature: `fn`, `GET`, `socket`, `cli`. |
| `signature` | One line of code naming it. |
| `fields` | Titled lists (`Parameters`, `Returns`, `Reply`) of `{ name, type?, required?, default?, description }`. |
| `errors` | `{ code, description }` rows. |
| `code` | Panels: `{ title, samples: { label, language?, code }[] }`. Several samples become tabs; samples with the same label switch together across the page. |
| `guide` | A manual page id, linked as further reading. |

Entry ids share the page namespace. A manual link to an entry, `[load](#load)`,
leads to its anchor on the reference page, and the bar switches between the
manual and the reference. Entries are listed in `llms.txt` and
`questions.json` with their anchor URLs; the sitemap lists the one page.
`validate` checks entries by every page rule. `buildStatic` also runs
`validateReference`: unique group ids, non-empty groups, panel titles, unique
sample labels, field names and descriptions, and that `guide` names a manual
page. Those checks live outside the schema so the in-app panel stays small.

`prepareCode` from `dopedocs/highlight` colours the reference's samples too.
The dark panels use their own palette; set `--dd-ref-code-keyword`, `-string`,
`-number`, `-comment`, `-function`, `-type` or `-punctuation` to retune it.
Each sample gets a Copy button from a small self-hosted `reference.js`
enhancement; without script the code stays selectable.

The reference page links `reference.css` after dopedocs' own sheet; the Vite
and Astro integrations emit it as `dopedocs-reference.css` when the document has
a reference, so other pages never load it. It uses the same `--dd-*` tokens,
and code panels sit on `--dd-ink` in both themes. The in-app panel doesn't
show the reference yet.

---

## Block kinds

| Kind | Shape |
| --- | --- |
| `p` | `{ kind: "p", text }` |
| `code` | `{ kind: "code", code, language?, caption? }` — literal multiline source. |
| `list` | `{ kind: "list", items, ordered? }` |
| `callout` | `{ kind: "callout", text, tone?: "note" \| "warn" }` |
| `steps` | `{ kind: "steps", items: { title, text }[] }` |
| `checklist` | `{ kind: "checklist", items: { text, checked? }[] }` |
| `tabs` | `{ kind: "tabs", label, group?, panes: { key, label, blocks: DocBlock[] }[] }` |
| `disclosure` | `{ kind: "disclosure", summary, blocks: DocBlock[], open? }` |
| `details` | `{ kind: "details", summary, text, open? }` |
| `cards` | `{ kind: "cards", items: { title, text, href?, label? }[] }` |
| `quote` | `{ kind: "quote", text, attribution?, cite? }` |
| `metrics` | `{ kind: "metrics", items: { value, label, detail? }[] }` |
| `compare` | `{ kind: "compare", before: { title, text }, after: { title, text } }` |
| `keys` | `{ kind: "keys", rows: [keys, does][] }` |
| `table` | `{ kind: "table", head: string[], rows: string[][] }` — any number of columns; every row must have the same cell count as `head` |
| `facts` | `{ kind: "facts", title?, mark?, href?, rows: [label, value][] }` — `href` links the head (mark and title) and shows the address; an http(s) URL opens in a new tab. |
| `image` | `{ kind: "image", src, alt, caption?, width?, height?, srcset?, sizes?, sources?, loading?, fetchPriority?, position?, href? }` |
| `gallery` | `{ kind: "gallery", images, columns?: 2 \| 3, label? }` |
| `video` | `{ kind: "video", src, poster?, caption? }` |

Tabs accept an accessible `label` and panes with unique non-empty `key` and
`label` values. Panes and disclosures can contain any blocks, including other
containers. Tabs with the same `group` synchronize matching pane keys within a
static page or mounted panel; separate panels keep independent choices. Arrow
Left/Right, Home and End select tabs, and Tab moves into the selected pane.
Without JavaScript, every pane appears in order under its label. Static builds
emit a self-hosted `tabs.js` only when the document uses tabs; allow self-hosted
scripts in your CSP to enable the interaction.

`disclosure` uses native `details` and `summary` and works without JavaScript.
The existing prose-only `details` block remains available unchanged.

```ts
{ kind: "tabs", label: "Package manager", group: "package-manager", panes: [
    { key: "npm", label: "npm", blocks: [{ kind: "code", code: "npm install example" }] },
    { key: "pnpm", label: "pnpm", blocks: [{ kind: "code", code: "pnpm add example" }] },
] }
{ kind: "disclosure", summary: "Troubleshooting", blocks: [
    { kind: "p", text: "Check your connection, then try again." },
] }
```

Prose carries three inline marks - `` `code` ``, `**strong**` and
`[text](href)` - plus `{fact:key}` references. Anything richer becomes a new
block kind, never new syntax.

A link's `href` takes one of three forms:

| Form | Example | Renders as |
| --- | --- | --- |
| Absolute URL | `[the changelog](https://example.com/changes)` | a link with `rel="noopener"` |
| `mailto:` | `[write to us](mailto:{fact:email})` | a mail link; facts fill in an href too |
| Section | `[Troubleshooting](#troubleshooting)` or `(section:troubleshooting)` | the panel's anchor in-app, `/docs/troubleshooting/` on a static page |

A section link to an id that is not a page (a typo, or a group, which has no
page) refuses the build with `unknown-section-link`; any other href, such as a
relative path or `javascript:`, refuses it with `unsupported-link`. Plain-text
outputs - the JSON-LD answer, the meta description, `llms.txt`,
`questions.json` and image `alt` - keep the link's text and drop the markup.
Inside a `` `code` `` span, link syntax stays literal.

## Code samples

```ts
{ kind: "code", language: "typescript", code: 'const name = "Example";\n',
  caption: "A small **literal** example." }
```

Source is escaped and preserved exactly: inline marks and `{fact:key}` syntax
inside code stay literal. Long lines scroll within the block, including by
keyboard; print output wraps. Captions are ordinary prose.

Highlighting is optional. Install `shiki@^3` as a development dependency and run
`prepareCode` from `dopedocs/highlight` in your content preparation step. It
returns a new document with serializable semantic tokens. Both the panel and
static build must receive that same prepared document. Unsupported languages
fall back to plain code; stale tokens cannot replace the literal source.

For example, with `tsx` installed as a development dependency:

```ts
// scripts/prepare-docs.ts — run with: tsx scripts/prepare-docs.ts
import { writeFile } from "node:fs/promises";
import { prepareCode } from "dopedocs/highlight";
import { docs } from "../src/docs.source.ts";

const prepared = await prepareCode(docs);
await writeFile("src/docs.generated.ts",
  'import type { DocSet } from "dopedocs";\nexport const docs = ' +
  JSON.stringify(prepared, null, 2) + ' satisfies DocSet;\n');
```

Run this before starting Vite or building, and import `docs.generated.ts` from
both your Vite configuration and browser code. Rerun preparation after source
changes. Keep `prepareCode` and the source document out of the browser's import
graph: the generated data needs no Shiki engine, language loaders or inline
styles. Token colours use the [CSS contract](../styles/TOKENS.md#optional-code-highlighting).

## Math

Install `katex@^0.19.1` as a development dependency and use `prepareMath` from
`dopedocs/math` in the same build-time preparation step described above:

```ts
import { prepareMath } from "dopedocs/math";
const prepared = prepareMath(docs);
```

```ts
{ kind: "math", tex: String.raw`V = \frac{D \times P}{T \times E}`,
  label: "Value equals demand times price divided by time times effort",
  where: [
    { symbol: "D", text: "Demand." },
    { symbol: "P", text: "Price." },
    { symbol: "T", text: "Time spent, in **hours**." },
    { symbol: "E", text: "Effort." },
  ] }
{ kind: "math", tex: "x^2", display: false }
```

TeX has no dollar delimiters. Display equations are the default; `display: false`
uses inline math layout within the block's place in the content flow (it does
not add math syntax to prose strings). `label` optionally supplies a spoken
explanation; otherwise assistive technology can use the native MathML semantics
and TeX annotation. The optional `where` list appears below the equation;
`symbol` is literal text and `text` supports normal inline marks and facts.

Preparation returns a new serializable document, including nested pages and
articles. It fails on blank, invalid or unsupported TeX. Pass the same generated
data to the panel and static build, and rerun preparation after edits. Keep the
adapter and KaTeX outside browser imports, as in the highlighting example.
Native MathML needs no KaTeX CSS, fonts or reader scripts. Without preparation
(or after source/mode changes), the renderer shows escaped TeX. The `prepared`
field is trusted build output, like inline SVG marks: never fill it with user
input or arbitrary HTML. Blank equations are also fatal document findings.

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

### Optional image zoom

Install `photoswipe` only if your site needs full-resolution image browsing:

```ts
import "photoswipe/style.css";
import "dopedocs/zoom.css";
import { mountImageZoom } from "dopedocs/zoom";

const zoom = mountImageZoom(document.querySelector(".dd-main")!);
// Before removing this panel:
zoom.destroy();
```

Give an image `href` to make it a full-size link. When `href` and `src` name the
same file, the adapter uses its declared dimensions (including `shotImage`'s
manifest dimensions), or its natural dimensions after loading. For a different
original, provide `dimensions: (link, image) => ({ width, height })` using its
real metadata. Unknown sizes keep ordinary link behavior. All eligible images
inside the target form one gallery; target an individual `.dd-gallery` to keep
galleries separate. Call after mounting the panel, and destroy before its target
is removed. Recreate the adapter if the image set changes.

A static-page consumer can explicitly initialize the same adapter on `.dd-page`.
By default, generated pages include no zoom scripts or PhotoSwipe downloads;
with JavaScript disabled the full-size links remain ordinary links.

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

## Screenshots from your app

A manual's pictures go stale the moment the interface moves, and a picture
nobody can retake is how an invented image ends up in documentation. dopedocs
takes them for you, from the running app, the same way every time.

```sh
npm i -D playwright && npx playwright install chromium
```

Declare the set in `dopedocs.shots.mjs` at the project root:

```js
import { defineShots } from "dopedocs/shots";

export default defineShots({
    out: "public/docs-assets",          // pictures and shots.json go here
    time: "2026-09-04T10:30:00-07:00",  // the page's clock is frozen here
    timezone: "America/Los_Angeles",
    fonts: ["Inter"],                   // refuse to shoot in fallback fonts
    storage: { "my-app-state": { tasks: [/* seeded, made-up content */] } },
    css: ".toast { visibility: hidden !important; }",
    shots: [
        { name: "home", viewport: { width: 1200, height: 900 }, widths: [700], webp: true },
        { name: "editor", dpr: 2, frame: ".editor", pad: -6,
          before: async (page) => { await page.click("#new"); await page.fill("#name", "Pay the bill"); } },
    ],
});
```

```sh
npx dopedocs-shots              # every shot
npx dopedocs-shots --only editor
npx dopedocs-shots --list
```

With no `url`, a Vite dev server is started for the run (with `env` in its
environment) and stopped after it.

What is pinned, so two runs write byte-identical files: the clock, zone and
locale; each shot's viewport and pixel ratio; the app's localStorage (cleared,
then seeded before the page loads); web fonts (Google Fonts by default,
fetched once and then served from `node_modules/.cache/dopedocs-shots`); and
motion (reduced motion, animations removed, transitions finished, pointer and
focus parked). A shot frames the viewport, the full `page`, one element, or
the union of several, with optional `pad`: never a freehand rectangle, so a
crop cannot cut a glyph. `widths` adds resized PNGs and `webp` adds WebP
copies, drawn by the same browser.

It also writes `shots.json`, the real size of every file. Declare images from
it and their dimensions can never drift from the pictures:

```ts
import { shotImage, type ShotManifest } from "dopedocs";
import shots from "../public/docs-assets/shots.json";

{ kind: "image", ...shotImage(shots as ShotManifest, "home", {
    alt: "The home screen with three tasks in order",
    caption: "Open the app and the order is already settled.",
}) }
```

`shotImage` fills `src`, `width`, `height`, `srcset` and the WebP `sources`,
and throws on a name the manifest does not have, so a removed shot fails the
build instead of shipping a broken image.

**Adding a picture, for a person or an agent:** add a row to `shots`, run
`npx dopedocs-shots --only <name>`, open the PNG and look at it, then use
`shotImage(shots, "<name>", { alt })` where it belongs. Seed only made-up
content: these pictures are public.

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

Not launched yet? `indexing: "noindex"` marks every page `noindex, nofollow`
and stops robots.txt advertising the sitemap; see [Options](#options).

An existing `robots.txt` or `sitemap.xml` of your own is merged, not replaced,
and merging is idempotent — building twice never repeats a rule or an entry.
When your `robots.txt` already has a `User-agent: *` group, dopedocs keeps
yours and adds no second one; when it already has a `Sitemap:` line, dopedocs
adds none (its pages are merged into the sitemap that line names). The named
search and training groups are always added.

## Options

Everything the plugin accepts besides `docs`. `buildStatic` takes the same set.

| Option | Default | |
| --- | --- | --- |
| `stylesheet` | none | `true` emits and links dopedocs' sheet; a string is an href you serve; an array links each in order. |
| `entityType` | `"Organization"` | The schema.org type for your entity. **Usually worth setting** — `"SoftwareApplication"` for an app, `"Product"`, `"WebApplication"`; for a business, its own type: `"TravelAgency"`, `"Plumber"`, `"BankOrCreditUnion"`. |
| `articleType` | `"TechArticle"` | What kind of page each section is. `TechArticle` suits software documentation; a business answering its customers' questions should set `"Article"` or `"WebPage"`. |
| `indexType` | `"CollectionPage"` | What kind of page the index (the whole manual on one page) is. |
| `siteType` | `"WebSite"` | What kind of thing the site the docs belong to is. |
| `basePath` | `"docs"` | Where the pages live, so `/help/<id>/` instead of `/docs/<id>/`. |
| `robots` | search allowed, training refused | See [Crawler policy](#crawler-policy). |
| `search` | `false` | `true` emits local search and its self-hosted script; complete static reading still works without JavaScript. |
| `indexing` | `"index"` | `"noindex"` keeps the docs out of search, for a site that is not launched yet: every page carries `<meta name="robots" content="noindex, nofollow">` and robots.txt drops its `Sitemap:` line, since advertising a sitemap of noindex pages contradicts the policy. `sitemap.xml` and `llms.txt` are still written, so launching is a rebuild. |
| `staleAfterDays` | `365` | How old a fact's `reviewed` date may be before it is reported. |
| `fullManualNote` | on | A visible line on every page saying the whole manual is one page (the index), so a reader or an AI assistant landing on one section knows where the rest is. Override the wording with `{ section, index }` using `{title}`, `{link}` and `{words}`; `false` turns it off. |
| `now` | the clock | Injected for deterministic output. |

**Not documenting software?** Set `entityType` to what your business is and
`articleType` to `"Article"`; the defaults describe a software product. These
are passed through as written: dopedocs does not check that a type exists in
schema.org.

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

### Multi-chapter manuals

Groups may contain pages or other groups, up to three nested groups. Each group uses a native keyboard-accessible disclosure in both navigation rails. Pages keep their `/docs/<id>/` URLs regardless of chapter placement. The panel expands the active page's ancestors; readers can also fold them manually. Chapter context and page progress appear while reading, and static section pages include previous/next destinations. A group may own a `landing: { id, title, question, answer, blocks }` page: its label links to the landing URL, and the overview appears once before its children in reading order, search and machine outputs. Previous/next links include the overview, and descendant breadcrumbs link to it. Without `landing`, the group remains a label with no URL or content of its own.

### Search within a manual

The panel includes local full-text search; enable it on static pages with `buildStatic(docs, { search: true })`. Search runs over section titles, questions, answers, keywords and rendered block text, including steps, tables and code. Search matches every word in any order, ignoring case and accents. Results use canonical section URLs; press Down from the search field to focus the first result, Tab through links, and Escape to clear. No service, network search request or analytics is involved. Results are capped at 50 for small-site use.

Opted-in static output includes a small `search.js` enhancement. Without JavaScript the contents, native chapter disclosures, previous/next links and complete manual remain readable; use the browser's Find command on the complete manual. Set `search: false` in `mountPanel` options to omit search. Static pages also include a small self-hosted `skip.js` enhancement: the first keyboard link focuses the reading surface without changing the address. Without JavaScript, its native fragment link still focuses the content and adds a fragment to the address; canonical metadata stays unchanged. Strict Content Security Policies can allow both self-hosted scripts with `script-src 'self'`.

### Copyable manuals and walkthroughs

Start with the [complete product manual](../examples/user-manual.ts) or [first-use walkthrough](../examples/onboarding-walkthrough.ts). Both use a fictional lamp and plain-language instructions; together they exercise every stable block, responsive images, art direction, a gallery and a silent video. The examples and their small local media files ship in the npm package. See [copy and build instructions](../examples/README.md).

### Industry starter

The [plumbing starter](../examples/plumbing-starter.ts) ships 30 customer questions with placeholder facts and business entity fields. Copy it from the installed package, obtain approved answers, and build with `entityType: "Plumber"` and `articleType: "Article"`. [Instructions](../examples/README.md#plumbing-starter) explain fact keys, review dates and business-name disambiguation. No real customer's answers are included.
