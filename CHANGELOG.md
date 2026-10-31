# Changelog

## 0.10.0 - 2026-10-31

- **Coloured reference code:** `prepareCode` now also prepares the developer
  reference's code panels, so every sample is coloured from the same semantic
  tokens as code blocks. The dark panels use their own palette, tunable with
  `--dd-ref-code-keyword`, `-string`, `-number`, `-comment`, `-function`,
  `-type` and `-punctuation`.
- **Copy buttons:** each reference sample gets a Copy button, revealed by a
  small `reference.js` enhancement and shown on hover or focus. Without
  clipboard access it says to select the code instead.
- **Panel design:** a calmer frame, a header with pill tabs, roomier code,
  thin scrollbars, and print and reduced-motion styles.

## 0.9.0 - 2026-10-31

- **Developer reference:** add `reference` to your docs for a reference page
  beside the manual, as in the Reference prototype: each entry is a row with
  prose on the left and its code on the right, the code staying in view while
  the row scrolls. Entries carry a badge, a signature, field lists, errors,
  code panels with tabs that switch together, and a guide link. It isn't tied
  to HTTP, so functions, socket messages, commands and file formats fit. The
  bar switches between the manual and the reference, manual links to an entry
  land on its anchor, and entries appear in `llms.txt` and `questions.json`.
  Its styles ship in a separate `reference.css`, emitted only for documents
  with a reference, so other pages keep their weight. The in-app panel doesn't
  show it yet.
- Static pages load the tabs enhancement for any element marked `data-dd-tabs`.
- **Studio:** typed controls in a designed editing panel, every documented
  theme token and typography control, local previews with batched saves, and
  readability fixes. Development only, as before.
- **Density and motion:** content spacing scales with a `--dd-density` token,
  and shared motion presets always respect reduced motion.
- **Mobile contents:** on static pages the contents open as a sheet that
  closes the way it opened, and stays usable without JavaScript.

All changes are additive; documents without a reference build as before.

## 0.8.0 - 2026-10-28

- **Docs-only Vite sites:** serve and build a complete documentation site with
  `basePath: "/"`, without a placeholder `index.html` or browser entry. Root
  pages now show one entity-name home link in the header.
- **Chapter overviews:** groups accept an optional `landing` page. The chapter
  label links to it, and navigation, search and machine-readable output include
  it before the chapter's children.
- **Richer content:** tables support any number of columns and validate row
  widths. New typed `tabs` support keyboard navigation and synchronized choices
  by group; `disclosure` blocks contain other blocks. Static pages show every
  labelled tab pane without JavaScript, and existing `details` blocks still work.
- **Math:** display and inline `math` blocks support optional variable definitions.
  The optional `dopedocs/math` build-time KaTeX adapter emits accessible native
  MathML, with no new reader script, stylesheet or font assets.
- **Copy page:** opt-in `copyPage` controls copy resolved section text and its
  canonical URL, including all tab alternatives and closed disclosure content.
  Clipboard failures show a manual-copy hint.
- **Sidebar filter:** opt-in `railFilter` matches titles regardless of case or
  accents and keeps ancestor group labels visible. `/` focuses the field (the
  shortcut is configurable), and Escape clears it. Without JavaScript, static
  pages retain the full navigation.
- **Keyboard access:** visible-on-focus skip links jump to the reading surface
  in the panel and static pages. Static pages include a self-hosted `skip.js`
  enhancement to preserve the address; without JavaScript the native link adds
  a fragment, while canonical metadata stays unchanged.
- **Reader weight checks:** the packed package is checked against reviewed
  raw/gzip budgets for CSS, the panel and the largest shipped example page,
  including its required assets.

All changes are additive. Static content remains readable without JavaScript;
tabs, copy and filtering use self-hosted enhancements when enabled.

## 0.7.0 - 2026-10-27

- **Real dates:** pages accept optional `published` and `updated` dates
  (`YYYY-MM-DD`). They become the page's `datePublished`/`dateModified` and its
  sitemap `lastmod`. Pages without dates no longer claim the build date as
  their modified date, since that told search and answer engines every page
  changed on every deploy. Add dates to pages you want shown as current.
- **Articles:** add `articles` to your docs for dated answer pages outside the
  manual. Each article is a normal page (question, answer, blocks, facts) with
  a required `published` date, optional `updated` and optional `author`. The
  build emits `/articles/<id>/`, an `/articles/` index newest first and an
  `/articles/feed.xml` RSS feed, and lists articles in the sitemap, `llms.txt`
  and `questions.json` with their dates. Docs without articles build exactly
  as before.
- **Articles look like articles:** each article is set like a long-form
  essay: a quiet header (headline, the answer as the standfirst, a byline),
  an optional `cover` shown as a wide illustration, an "In this article" list
  that folds away with no script, then the writing in one column. Pictures
  and diagrams sit in panels with their caption along the bottom, and an
  image block with `wide: true` runs wider than the text. In an article, notes
  and steps read as plain prose. An image with `drawing: true` (a diagram,
  not a screenshot) shows without a frame; a cover's `sources` carry onto its
  card, so a dark rendition shows in dark mode there too. The newest other articles close the page,
  and the index shows picture cards with the newest one featured.
- **Headings inside a page:** a new `{ kind: "heading", text }` block adds a
  subheading with an anchor (`id` optional, else a slug of the text) and a
  "#" link that shows on hover. Articles with two or more list them as
  "In this article".

## 0.6.1 - 2026-10-26

- Fix docs served at the site root (`basePath: "/"`): links, canonical URLs,
  the sitemap and output paths no longer gain a double slash (`//id/`), which
  browsers read as a different host. Other base paths are byte-identical.

## 0.6.0 - 2026-10-26

Adds theming, typography and font tooling, and an experimental development
Studio. Every change is additive: existing content, themes, URLs and imports
keep working unchanged.

- **Experimental Studio:** opt in with `studio: true` in the Vite or Astro
  integration and open `/__dopedocs/studio` in development. Style, Layout,
  Type, Pieces and Export tabs edit a live preview of your real manual and save
  to one hand-editable `--dd-*` theme file. Nothing is emitted in production.
  Its controls and panel layout may still change.
- `dopedocs theme` CLI and `dopedocs/theme` module edit theme tokens and leave
  every unrelated byte untouched; `themeFile` is read at build and dev time.
- Structural layout keywords for the sidebar, outline, header, current marker
  and cards, with stable classes and responsive CSS.
- Typography tokens: font roles, heading scale, leading, tracking, weights,
  OpenType features and variations, hyphenation, drop caps, heading counters and
  tabular tables. Studio toggles only the features an installed font supports.
- `dopedocs fonts add/list/remove`: self-hosts Fontsource or local fonts with
  their licence and generates metric-matched fallbacks to reduce layout shift.
  Studio adds catalog search, preview and upload. Readers never fetch fonts from
  a third party.
- Optional typed API reference metadata in `defineDocs`, with validation and
  generated cURL, `fetch` and Python samples (`api-samples.json`).
- Compatibility test suite covering exports, types, tokens, classes and
  byte-exact static output, so future releases can prove they are additive.

## 0.5.1 - 2026-10-19

- Remove the duplicate inline table of contents on the complete-manual page;
  the sidebar remains the sole contents navigation.

## 0.5.0 - 2026-10-18

Adds the documented integrations and manual toolkit to the npm package.

- Astro integration (`dopedocs/astro`), canonical inline links, public
  `facts.json`, configurable schema.org properties and prelaunch `noindex`.
- Up to three nested chapter groups, reading context, progress and previous/next
  navigation without changing section URLs.
- Local full-text panel search; optional static search via `search: true`.
- Literal code blocks, optional build-time Shiki highlighting, and opt-in
  PhotoSwipe zoom through separate exports. These libraries remain optional.
- Native modal focus handling, clearer typography, navigation and callouts,
  small licensed SVG icons, and an optional self-hosted font/theme example.
- Copyable product manual, onboarding walkthrough and placeholder-only plumbing
  starter with 30 questions. Examples, media and the full reference ship in npm.
- Fixes for dark-theme headings, bundled stylesheet paths, impossible review
  dates, resolved answer validation, empty answers and link examples in code.
- Concise README with software and service-business examples verified against
  real Vite/Astro builds from the installed tarball.

Existing content and canonical section URLs continue to work. Static builds
remain script-free unless search is enabled. The release remains MIT; no 2.0
licence change is part of this version.
