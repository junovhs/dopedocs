# Changelog

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
