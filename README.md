# dopedocs

A typed documentation engine. You author your docs once, as TypeScript data;
dopedocs renders them both as an in-app panel and as crawlable static pages
that answer engines can read.

Its premise is that documentation fails on the machine-readable side not
because there is too little content, but because the same fact gets stated
differently on different surfaces. So dopedocs makes contradiction a build
error rather than a review problem.

## What the compiler enforces

- **Every section carries a question and a self-contained answer.** They are
  required fields, not conventions, so an unannotated section does not compile
  and the `FAQPage` graph is generated rather than authored.
- **Every commercial or factual claim is defined once, in a facts registry, and
  interpolated into prose.** The sentence a reader sees and the value in the
  structured data are the same string, so they cannot drift.
- **The entity declares what it is not.** Name collisions are the common way an
  answer engine gets a product wrong, so disambiguation is required input.

## What it emits

One source produces the in-app panel, a static page per section at a real URL,
the JSON-LD entity graph, `sitemap.xml`, `robots.txt` with search and training
crawlers ruled separately, `llms.txt`, and `questions.json` for regression
testing what the engines actually say back.

## Status

Early. The API is not stable and the package is not yet published.
