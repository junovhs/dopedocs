# One theme, both reading surfaces

Copy this directory into a new folder, then run:

```sh
npm install
npm run check
npm run build
npm run dev
```

The garden, its hours and its answers are fictional. This is a theme example,
not a starter set of business claims. It uses a self-hosted Inter variable font
from Fontsource. `prepare-font.mjs` copies just the Latin normal-weight font and
its licence into `public/fonts/`, and copies the engine sheet into `public/docs/`; it makes no runtime requests to a font service.
Use another subset or family when your content needs it.

`index.html` links the emitted `/docs/dopedocs.css` first and `/docs-theme.css`
second for the app and panel. Keep this order so engine defaults do not override
your font and palette aliases. The plugin receives
`stylesheet: [true, '/docs-theme.css']`, so the static pages load the bundled
engine CSS followed by the same consumer-owned font and token aliases. Test
`/docs/` and `/docs/visit/` as well as the panel. This example's palette follows
the system colour preference; the engine itself still follows its host.

For an unreleased checkout, first build and pack dopedocs, then replace the
registry dependency with that tarball in this throwaway folder:

```sh
npm install /absolute/path/to/dopedocs-0.4.0.tgz
npm run check
npm run build
```

The engine does not depend on this example's font package or choose this palette
for other sites. Its regular system-font and host-token defaults are unchanged.
