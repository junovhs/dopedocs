import {beforeAll,afterAll,test,expect} from 'vitest';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import{buildPackage}from'./built-package.mjs';
let pkg,features;const fixture=readFileSync(new URL('./fixtures/type-features.ttf',import.meta.url));
beforeAll(async()=>{pkg=buildPackage();features=await import(pathToFileURL(join(pkg.scratch,'dist/font-features.js')).href);},30000);
afterAll(()=>pkg.cleanup());
test('actual font tables expose exactly small caps and two named sets, no old-style numbers, plus real axes',()=>{
    const result=features.detectFontCapabilities(fixture);
    expect(result.family).toBe('Dopedocs Type Fixture');
    expect(result.features).toEqual([{tag:'smcp',name:'Small capitals'},{tag:'ss01',name:'Round forms'},{tag:'ss02',name:'Square forms'}]);
    expect(result.axes).toEqual([{tag:'wght',name:'Weight',min:100,default:400,max:900}]);
});
test('selected role resolves its first local face; unknown/system fonts are not guessed and paths cannot escape public root',()=>{
    const pub=join(pkg.scratch,'public');mkdirSync(pub);writeFileSync(join(pub,'fixture.ttf'),fixture);
    const file=join(pkg.scratch,'theme.css');
    writeFileSync(file,':root {--dd-display: "Dopedocs Type Fixture", serif;} @font-face {font-family:"Dopedocs Type Fixture";src:url("/fixture.ttf")}');
    expect(features.installedFontCapabilities(file,pub,'display').features.map(f=>f.tag)).toEqual(['smcp','ss01','ss02']);
    expect(features.installedFontCapabilities(file,pub,'body')).toBeNull();
    writeFileSync(file,readFileSync(file,'utf8').replace('/fixture.ttf','/../package.json'));
    expect(()=>features.installedFontCapabilities(file,pub,'display')).toThrow('public directory');
});

test('variable fixture survives the actual upload/conversion/install path with features and axes intact',async()=>{
    const {installStudioFont}=await import(pathToFileURL(join(pkg.scratch,'dist/studio-fonts.js')).href);
    const file=join(pkg.scratch,'uploaded-theme.css'),pub=join(pkg.scratch,'uploaded-public');
    await installStudioFont({name:'type-features.ttf',bytes:fixture.toString('base64'),license:'MIT — original dopedocs fixture',role:'display'},{file,publicDir:pub});
    const result=features.installedFontCapabilities(file,pub,'display');
    expect(result.features.map(feature=>feature.tag)).toEqual(['smcp','ss01','ss02']);
    expect(result.axes[0].tag).toBe('wght');
});
