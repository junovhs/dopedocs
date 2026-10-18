# Start from a working example

These are fictional teaching documents, with no customer information. Replace
all names, URLs, facts, review dates and media before publishing.

- `user-manual.ts`: a product manual using every stable block kind.
- `onboarding-walkthrough.ts`: a complete three-stage first-use flow.
- `manual-assets/`: local SVG illustrations and a silent WebM brightness demo.

After `npm i dopedocs`, copy one content file and its media into your project:

```sh
mkdir -p src public/manual-assets
cp node_modules/dopedocs/examples/user-manual.ts src/docs.ts
cp node_modules/dopedocs/examples/manual-assets/* public/manual-assets/
```

The file exports `docs`; pass it to the Vite plugin or Astro integration and
to `mountPanel` as shown in the package README. To start from onboarding,
copy `onboarding-walkthrough.ts` instead. The examples use root-relative media
URLs: if your site lives below a path, adjust those URLs to include it.

To build without a framework, install TypeScript as a development dependency,
compile the copied document as a NodeNext ES module, and run this module beside
the compiled `docs.js` (the directory's package.json must set `"type":"module"`):

```js
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { buildStatic } from 'dopedocs/static';
import { docs } from './docs.js';
for (const [name, body] of Object.entries(buildStatic(docs, {
  stylesheet: '/docs.css', search: true,
}))) {
  const target = join('public', name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, body);
}
```

Copy `node_modules/dopedocs/styles/dopedocs.css` to `public/docs.css` and serve
`public/` with a static web server. `/docs/` contains the complete manual;
individual pages retain `/docs/<id>/` URLs. Serve the bundled WebM as
`video/webm`. The animation is silent; its caption and written steps carry all
instructions.

For maintainers, `npm run check:examples` packs the project, installs that
archive into a throwaway app, compiles all root example modules against the
installed package and builds their complete static trees. It checks block
coverage and that every root-relative example media reference exists.
