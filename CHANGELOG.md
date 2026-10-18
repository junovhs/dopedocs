# Changelog

## 0.5.1 - Unreleased

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
