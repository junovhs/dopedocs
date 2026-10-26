import {beforeAll,afterAll,test,expect,vi} from 'vitest';
import {readFileSync,mkdirSync,readdirSync} from 'node:fs';import {dirname,join} from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import {buildPackage} from './built-package.mjs';
let pkg,fonts;const fixture=dirname(createRequire(import.meta.url).resolve('@fontsource/fraunces/package.json'));
beforeAll(async()=>{
    pkg=buildPackage();fonts=await import(pathToFileURL(join(pkg.scratch,'dist/studio-fonts.js')).href);
    vi.stubGlobal('fetch',vi.fn(async url=>{
        if(String(url).startsWith('https://api.fontsource.org/')) return new Response(JSON.stringify([{id:'fraunces',family:'Fraunces',type:'google',category:'serif',variable:true,weights:[400,600],subsets:['latin'],defSubset:'latin'}]));
        const path=String(url).replace(/^.*\/@fontsource\/fraunces@(?:latest|5\.3\.0)\//,'');
        if(path==='package.json') return new Response(JSON.stringify({version:'5.3.0'}));
        try{return new Response(readFileSync(join(fixture,path)));}catch{return new Response('missing',{status:404});}
    }));
},30000);
afterAll(()=>{vi.unstubAllGlobals();pkg.cleanup();});
test('catalog preview leaves host untouched; picking or uploading installs local files and licence',async()=>{
    const host=join(pkg.scratch,'host');mkdirSync(host);const options={file:join(host,'theme.css'),publicDir:join(host,'public')};
    expect((await fonts.fontCatalog())[0].family).toBe('Fraunces');
    expect((await fonts.previewFont('fraunces',400,'latin')).subarray(0,4).toString()).toBe('wOF2');expect(readdirSync(host)).toEqual([]);
    await expect(fonts.previewFont('../other',400,'latin')).rejects.toThrow('available');
    await fonts.installStudioFont({id:'fraunces',weights:[400,600],subset:'latin',role:'display'},options);
    let css=readFileSync(options.file,'utf8');expect(css).toContain('--dd-display: "Fraunces"');expect(css).not.toContain('https://');
    expect(readdirSync(join(host,'public/fonts/dopedocs/fraunces'))).toContain('LICENSE.txt');
    await fonts.installStudioFont({name:'font.woff2',bytes:readFileSync(join(fixture,'files/fraunces-latin-400-normal.woff2')).toString('base64'),license:readFileSync(join(fixture,'LICENSE'),'utf8'),role:'body'},options);
    css=readFileSync(options.file,'utf8');expect(css).toContain('--dd-body: "Fraunces"');
    await expect(fonts.installStudioFont({name:'font.woff2',bytes:'AAAA',role:'body'},options)).rejects.toThrow('licence');
});
