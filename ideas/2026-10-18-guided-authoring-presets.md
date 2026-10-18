# Idea: Guided authoring presets

**Date:** 2026-10-18  
**Status:** Exploration

## Premise

DopeDocs is a typed facts, documentation authoring, and publishing engine for *any* subject: a web app, restaurant, university department, travel agency, physical product, or technical system. It can produce a user manual, technical manual, FAQ, or another clear reference surface.

Its job is to help people state what is true once, maintain that truth, and publish useful documentation. Better discoverability by search engines and AI assistants is a valuable adjacency—not a prerequisite, a replacement for good docs, or a promised ranking.

## Idea

**DopeDocs shouldn't need to know the answers, but it can know which questions are worth asking.**

Let the author pick a preset such as **web app**, **restaurant**, **university department**, **travel agency**, or **physical product**. The preset supplies a thoughtful starter outline, high-value questions, and suggested canonical facts. Unanswered prompts remain prompts; the engine must never invent a business's policies, prices, specifications, or guarantees.

A restaurant preset might ask about hours, location, menu, allergens, accessibility, and reservations. A university department preset might ask about programs, admission requirements, dates, advising, and contacts. A product preset might ask about specifications, setup, use, safety, and troubleshooting.

Build these from **composable question/fact modules**, not a hundred unrelated hardcoded templates. Authors can add, remove, and rearrange everything. Potentially allow sharable community presets once the format settles.

## Authoring flow

1. Choose a preset or start blank.
2. See suggested sections and questions, prioritized by usefulness to readers.
3. Enter answers and define reusable, reviewed facts where claims recur.
4. Get gentle warnings for important unanswered questions or stale facts—not fabricated answers.
5. Publish coherent human-readable docs alongside appropriate structured, crawlable output.

A lightweight discovery checklist (sitemap, crawlability, Google Search Console, Bing Webmaster Tools) could come later. Retrofitting an old, contradictory website is an optional secondary use case, not the main product or an excuse to build a complicated AI audit pipeline.

## Product constraint

Keep the core deterministic, lightweight, and useful without an AI account. Presets guide authorship; DopeDocs validates facts and renders/publishes them. Don't turn it into an SEO dashboard or a mandatory crawler.

**Related tracker items:** `TPL-01` (industry question sets), `TPL-02` (complete examples), `DOCS-02` (documentation-first positioning).
