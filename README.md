# dopedocs

**The documentation layer for your app or site. Built in from day one.**

Write manuals, technical docs or help content in one typed source. Give readers
an in-app panel and crawlable pages at `/docs/<id>/`, styled with your host's own
design tokens. Your docs share your product's look and build, with no separate
documentation project to maintain.

Make finding an answer fast and reading a pleasure: nested chapters, scrollspy,
local search and reading progress keep people oriented. Static pages share the
navigation, include previous/next links and offer the complete manual on one
page. They remain readable without JavaScript; local search progressively
enhances them.

**For AI and search, too.** The same source generates JSON-LD, a sitemap,
`robots.txt`, `llms.txt`, `questions.json` and `facts.json`, giving crawlers
structured entities, direct answers and shared facts in formats they can read.
Write documentation once; rebuild when a fact changes.

## Add it to your site

Install into your existing Vite or Astro project:

```sh
npm install dopedocs
```

### 1. Write a document

This fictional software example exports the document used below:

```ts
// src/docs.ts
import { defineDocs, defineFacts } from "dopedocs";

export const docs = defineDocs({
    entity: {
        name: "Field Notes",
        url: "https://field-notes.example",
        notToBeConfusedWith: ["Other products and publications named Field Notes"],
    },
    title: "Using Field Notes",
    lead: "Keep a small notebook for your daily work.",
    facts: defineFacts({
        storage: { value: "your browser", reviewed: "2026-10-18" },
    }),
    sections: [{
        id: "storage",
        title: "Your notes",
        question: "Where does Field Notes store my notes?",
        answer: "Field Notes stores notes in {fact:storage}.",
        blocks: [{ kind: "p", text: "Use the same browser to return to your notebook." }],
    }],
});
```

Sections require a question and a short, self-contained answer. Put repeated
claims in the facts registry and reference them with `{fact:key}`. Review dates
help identify stale claims; they do not approve an answer for you.

### 2. Generate the static pages

For Vite:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { dopedocs } from "dopedocs/vite";
import { docs } from "./src/docs.ts";

export default defineConfig({
    plugins: [dopedocs({ docs, stylesheet: [true, "/docs-theme.css"] })],
});
```

For Astro, use its integration instead of the Vite plugin:

```ts
// astro.config.mjs
import { defineConfig } from "astro/config";
import dopedocs from "dopedocs/astro";
import { docs } from "./src/docs.ts";

export default defineConfig({
    integrations: [dopedocs({ docs, stylesheet: [true, "/docs-theme.css"] })],
});
```

Both write documentation into your existing build output. `stylesheet: true`
emits the bundled stylesheet; the second entry is a theme file you supply in
`public/`. Use `search: true` to add local search to the static pages. The
in-app panel includes search by default.

Set `railFilter: true` on `mountPanel`, `buildStatic`, or the Vite/Astro integration
to filter sidebar titles independently of full-text search. `/` focuses the field;
`railFilter: { shortcut: "f" }` changes that key. Escape clears the filter.
Matching ignores case and accents and keeps ancestor group labels visible.
Without JavaScript the field is absent and the full navigation remains available.

Set `copyPage: true` on `mountPanel` and on the Vite/Astro integration (or
`buildStatic`) to offer a “Copy page” action on manual sections. It copies the
resolved section text and canonical URL, including labelled tab alternatives and
closed disclosure content. Static pages use a self-hosted `copy.js` enhancement;
without JavaScript the complete content remains readable. Clipboard access needs
a secure context and a reader click; a denied request shows a manual-copy hint.

### Docs-only Vite site

To let documentation own the whole site, set `basePath: "/"` on the document
or pass it to `dopedocs({ docs, basePath: "/", stylesheet: true })` in your
Vite config. Run `npx vite` to serve it locally and `npx vite build` to generate
`dist/index.html` and a page at `dist/<id>/index.html` for each section.
No placeholder `index.html`, browser entry or panel mount is needed. Existing
host HTML and explicit `build.rollupOptions.input` entries continue to build.

### 3. Use your design tokens

Serve this as `public/docs-theme.css`, and link it from the app shell after the
bundled stylesheet. Replace the `--site-*` names with your own tokens:

```css
/* public/docs-theme.css */
:root {
    --dd-bg: var(--site-background, #fff);
    --dd-text: var(--site-text, #18181b);
    --dd-muted: var(--site-muted, #666);
    --dd-accent: var(--site-accent, #354350);
    --dd-sans: var(--site-font, system-ui);
}
```

Both reading surfaces use these aliases. See the [token contract](./styles/TOKENS.md)
and [self-hosted font/theme example](./examples/theme/README.md) for more control.

### 4. Mount the panel

Add these elements to your existing app shell:

```html
<!-- app-shell.html -->
<link rel="stylesheet" href="/docs-theme.css">
<button type="button" data-open-docs>Read the documentation</button>
```

Then use this browser entry:

```ts
// src/main.ts
import "dopedocs/styles.css";
import { mountPanel } from "dopedocs/panel";
import { docs } from "./docs.js";

const panel = mountPanel(document.body, docs);
document.querySelector("[data-open-docs]")?.addEventListener("click", () => panel.open());
```

The panel manages keyboard focus, Escape, chapter disclosures and URL updates.
A direct server request to a section URL gets the generated static page. In
Astro, import your browser entry from a processed `<script>` in your page.

## Documentation for service businesses, too

This fictional booking business uses the same authoring surface. Save it as a
separate document and pass it to the integration with `entityType: "LocalBusiness"`
and `articleType: "Article"`:

```ts
// src/service-docs.ts
import { defineDocs, defineFacts } from "dopedocs";

export const docs = defineDocs({
    entity: {
        name: "Harbor Visits",
        url: "https://harbor-visits.example",
        notToBeConfusedWith: ["Similarly named tour businesses in other towns"],
        schemaProperties: { areaServed: "Fictional Harbor Town" },
    },
    title: "Plan your visit",
    lead: "Example booking policies for a fictional local guide.",
    facts: defineFacts({
        booking: { value: "no booking fee", reviewed: "2026-10-18" },
        cancellation: { value: "free until 24 hours before arrival", reviewed: "2026-10-18" },
        support: { value: "9am to 5pm UTC, Monday to Friday", reviewed: "2026-10-18" },
    }),
    sections: [
        { id: "fees", title: "Booking fees", question: "Does Harbor Visits charge a booking fee?",
          answer: "Harbor Visits charges {fact:booking}.", blocks: [] },
        { id: "cancellation", title: "Cancellation", question: "What is Harbor Visits' cancellation policy?",
          answer: "Harbor Visits cancellation is {fact:cancellation}.", blocks: [] },
        { id: "support", title: "Support", question: "When can I contact Harbor Visits?",
          answer: "Harbor Visits support is available {fact:support}.", blocks: [] },
    ],
});
```

Replace fictional values with approved information before publishing. For a
larger starting point, the [plumbing template](./examples/plumbing-starter.ts)
contains 30 questions and placeholder facts rather than real business answers.

## Entity disambiguation

`entity.notToBeConfusedWith` is required. A business sharing a name with another
company is easy to misidentify: list plausible collisions, use your own URL,
and add authoritative `sameAs` profiles when available. dopedocs emits this
context with a stable entity identifier. It helps describe the intended entity;
it cannot control an answer engine's attribution.

## What dopedocs checks, and what you review

dopedocs keeps its own rendered answers and generated metadata consistent.
It rejects missing answers, unknown fact references, invalid review dates,
unsupported section links and other structural problems. The panel and pages
must be built from the same document to share those values.

It does not make a claim true, validate arbitrary `schemaProperties`, guarantee
indexing, or guarantee that an answer engine cites you. Review your facts and
update their dates when approved. Every registry value is public in `facts.json`,
including unused facts. Reviewer `note` fields are omitted from the generated
files; the authored content module still needs the same care as your repository.

## Examples and reference

The npm package includes copyable [user-manual](./examples/user-manual.ts),
[onboarding](./examples/onboarding-walkthrough.ts) and
[plumbing](./examples/plumbing-starter.ts) examples, plus local media.
[Copy/build instructions](./examples/README.md) demonstrate their installed-package flow.

The [full reference](./docs/reference.md) covers all blocks, responsive media,
optional Shiki highlighting and PhotoSwipe zoom, screenshots, direct static
builds, crawler policy and configuration. No telemetry or hosted service is required.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contributions and public-store rules.

## Licence

dopedocs 1.x is MIT; see [LICENSE](./LICENSE). Every version published under MIT
stays MIT. From 2.0, the planned licence is source-available commercial software,
free for personal and open-source use and licensed per site for commercial use.
The exact 2.0 text has not been chosen; `LICENSE`, `package.json` and this section
will change together in that release.

### Edit the host theme from a terminal

Link `docs-theme.css` from your app and static pages, then edit the same file
with the installed CLI:

```sh
npx dopedocs theme set accent '#ff6a2b'
npx dopedocs theme get accent
npx dopedocs theme list
npx dopedocs theme unset accent
```

Use `--file public/docs-theme.css` to select another path. Short names and full
`--dd-*` names both work. The commands use the `:root` containing
`/* dopedocs theme */`, or the last top-level `:root` if none is marked. They
create a managed block when needed and preserve unrelated CSS bytes. Unknown
token names warn so forward-compatible host extensions remain possible;
`list` shows set, documented tokens and `get` exits 1 for an unset value.
For scripts, `dopedocs/theme` exports the same `parseTheme`, `updateTheme` and
file helpers. There is no theme configuration object (DEC-05, DEC-12).

### Install a font into your site

```sh
npx dopedocs fonts add 'Fraunces' --weights 400,600 --role display
npx dopedocs fonts add ./MyFont.ttf --license ./OFL.txt --role body
npx dopedocs fonts list
npx dopedocs fonts remove 'Fraunces'
```

Google families come from Fontsource. The CLI downloads only the selected
weights, style (`--italic`) and subset (`--subset latin` by default), resolves a
package version once, and stores WOFF2 files and the licence under
`public/fonts/dopedocs/<family>/`. Local OTF/TTF files are converted to WOFF2;
WOFF2 files are copied. Local files need `--license` or an adjacent `OFL.txt`,
`LICENSE`, `LICENSE.txt`, `LICENCE` or `LICENCE.txt`. Their embedded family name
and default weight are used. For multiple static weights, add each local file;
repeat installs retain the family's other faces.

The commands write `@font-face` rules with `font-display: swap` and
`unicode-range`, plus the selected `--dd-display`, `--dd-body`, `--dd-ui` or
`--dd-mono` stack in `docs-theme.css`. Link that file **after** the engine
stylesheet from both your app and static pages. Font URLs stay local; choosing
a Google font needs network access only during installation (DEC-13).

Use `--file` for another theme file, `--public-dir` for another public directory,
and `--public-path` for the deployed URL prefix (default `/fonts/dopedocs`).
Use the same paths when listing or removing a family. `--source` selects a
Fontsource-compatible CDN mirror; the default is `https://cdn.jsdelivr.net/npm`.
The CLI owns its marked font blocks and family asset directories; keep other
hand-written rules outside those blocks. Removing a family retains other font
stack entries. No font catalog or font files ship in the dopedocs package.

Font installation also writes a metric-matched local fallback after the chosen
family in its stack. Display/body/UI roles use Arial and mono uses Courier New,
with separate weight/style faces. `size-adjust` matches x-height (cap height
when unavailable); ascent, descent and line gap follow the installed font.
This reduces shifts during font loading, though different glyph widths can
still change wrapping. If the named system font is unavailable, the rest of
your existing stack remains available. Removing a font removes its generated
fallbacks too. Unchanged sites get no new faces until they run `fonts add`.

### Typed API reference data

Add an optional `api` field to `defineDocs`. It contains `baseUrl`, optional
`authentication` text, resource `groups` with `endpoints`, and an optional
`errors` table. Each endpoint has an id, method, path, title, description,
parameters and `exampleResponse: { status, body }`; `guide` links to an existing
page id. See the complete [API example](./examples/api-reference.ts).

Supported methods are `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE` and `OPTIONS`.
Parameters have a name, type (`string`, `number`, `integer`, `boolean`, `object`
or `array`), required flag, location (`path`, `query`, `header` or `body`),
description and optional JSON `example`. Path parameters use `{name}` in the
path and must be required. Body parameters form a JSON object. Optional
parameters without examples are omitted; required parameters without examples
get deterministic illustrative values. Object/array query values use JSON.

`validate(docs)` reports duplicate API ids, unknown methods, invalid request
metadata and broken guide links. `buildStatic(docs)` rejects fatal findings and
emits `api-samples.json` only when API metadata exists. API ids are unique
across resource groups and endpoints; guide ids remain in the page namespace.
Existing pages keep their required question and answer (DEC-02).

`generateApiSamples(docs.api)` produces the same endpoint-id map from validated
API data: `{ curl, javascript, python }`. The samples encode URL parameters and
quote supplied examples as literal data. JavaScript uses `fetch`, Python uses
its standard library, and cURL samples use POSIX shell quoting. Authentication
text is documentation; add a header parameter to include an example token.
Builds generate these strings without executing requests.

### Development Studio

> **Experimental.** The Studio's controls and panel layout may change between
> minor releases. The theme file it writes is plain `--dd-*` CSS and stays valid.

Enable `studio: true` in the existing Vite or Astro dopedocs integration and
set `themeFile: 'public/docs-theme.css'` (or your own host-owned CSS path).
Keep `stylesheet: [true, '/docs-theme.css']` so the same file styles production.
Start the host's dev server, then open `/__dopedocs/studio` on localhost.
The Remix tabs edit Style, Layout, Type and Pieces beside your real generated
manual. Changes save automatically to the theme file; Export shows its CSS.
Reload file reads hand edits. Reset removes only that token's declaration.
The editor only runs in development and no Studio routes or scripts are emitted
by a production build. Do not enable it on a remotely accessible dev server.

In the Studio Type tab, open **Find or upload fonts**. Search Google families
by name, category or variable support, choose a role and Preview on your own
text. **Use font** installs the selected weights and language subset into your
host's public fonts directory with its licence; only the local CSS is saved.
Preview downloads stay inside the Studio and do not modify the theme file.
You can also drop a WOFF2, TTF or OTF file and paste its hosting licence.
Catalog metadata comes from the [Fontsource API](https://fontsource.org/docs/api/fonts).
Readers never request the catalog or third-party font files.
