import { expect, test } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dopedocs } from './vite.js';
import { structuralClasses } from './structure.js';
import { defineDocs } from './schema.js';

test('host theme keywords reach generated static pages and invalid choices warn', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dd-structure-'));
    try {
        writeFileSync(join(root, 'theme.css'), ':root { --dd-sidebar-side: right; --dd-header: minimal; }');
        const docs = defineDocs({title:'Guide',lead:'A guide.',entity:{name:'Example',url:'https://example.com',tagline:'Example.',notToBeConfusedWith:[]},facts:{},sections:[]});
        const plugin = dopedocs({docs, themeFile:'theme.css'});
        plugin.configResolved({root,command:'build',build:{outDir:'output'}});
        await plugin.closeBundle();
        expect(readFileSync(join(root,'output/docs/index.html'),'utf8')).toContain('class="dd-static dd-sidebar-side-right dd-header-minimal"');
        const warnings: string[] = [];
        expect(structuralClasses({'--dd-outline':'wrong'}, s=>warnings.push(s))).toEqual([]);
        expect(warnings[0]).toContain('using the default');
    } finally { rmSync(root,{recursive:true,force:true}); }
});
