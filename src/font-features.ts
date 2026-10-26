/** Inspect actual installed font bytes, never infer capabilities from a family name. */
import { create, type Font } from 'fontkit';
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { parse } from 'postcss';
import { parseTheme, readThemeFile } from './theme.js';

export interface FontCapabilities {
    family: string;
    features: {tag:string; name:string}[];
    axes: {tag:string; name:string; min:number; default:number; max:number}[];
}
const names: Record<string,string> = {smcp:'Small capitals',c2sc:'Capitals to small caps',pcap:'Petite capitals',c2pc:'Capitals to petite caps',unic:'Unicase',titl:'Titling capitals',onum:'Old-style numbers',lnum:'Lining numbers',tnum:'Tabular numbers',pnum:'Proportional numbers',zero:'Slashed zero',frac:'Fractions',ordn:'Ordinals',liga:'Common ligatures',dlig:'Discretionary ligatures',hlig:'Historical ligatures',clig:'Contextual ligatures',calt:'Contextual alternates',case:'Case-sensitive forms',sups:'Superscripts',subs:'Subscripts',swsh:'Swashes',cswh:'Contextual swashes',salt:'Stylistic alternates',kern:'Kerning'};
type FeatureTable={featureList?:{tag:string;feature:{featureParams?:{nameID:number}}}[]};
type NamedFont=Font&{GSUB?:FeatureTable;GPOS?:FeatureTable;name?:{records?:{fontFeatures?:Record<string,Record<string,string>>}}};
export function detectFontCapabilities(bytes: Uint8Array): FontCapabilities {
    const parsed=create(Buffer.from(bytes));
    if(!('availableFeatures' in parsed)) throw new Error('Choose one font face, not a collection');
    const font=parsed as NamedFont;
    const featureNames=new Map<string,string>();
    for(const table of [font.GSUB,font.GPOS]) for(const feature of table?.featureList??[]) {
        const id=feature.feature.featureParams?.nameID;
        const labels=id===undefined?undefined:font.name?.records?.fontFeatures?.[id];
        const label=labels?.en??Object.values(labels??{})[0];
        if(label) featureNames.set(feature.tag,label);
    }
    return {
        family:font.familyName,
        features:[...new Set(font.availableFeatures)].filter(tag=>names[tag]||/^(ss|cv)\d\d$/.test(tag)).sort().map(tag=>({tag,name:featureNames.get(tag)??names[tag]??(tag.startsWith('ss')?'Stylistic set ':'Character variant ')+Number(tag.slice(2))})),
        axes:Object.entries(font.variationAxes).flatMap(([tag,axis])=>axis?[{tag,...axis}]:[]),
    };
}
/** Resolve only first-choice, local @font-face files within the host public directory. */
export function installedFontCapabilities(file:string, publicDir:string, role:string): FontCapabilities | null {
    if(!['display','body','ui','mono'].includes(role)) throw new Error('Unknown font role');
    const css=readThemeFile(file), stack=parseTheme(css)['--dd-'+role];
    if(!stack) return null;
    const family=stack.match(/^\s*(?:"([^"\\]+)"|'([^'\\]+)'|([^,]+))/)?.slice(1).find(Boolean)?.trim();
    if(!family) return null;
    let source:string|undefined;
    parse(css).walkAtRules('font-face',rule=>{
        let name='',src='';rule.walkDecls(decl=>{if(decl.prop==='font-family')name=decl.value.replace(/^['"]|['"]$/g,'');if(decl.prop==='src')src=decl.value;});
        if(name!==family||source) return;
        source=src.match(/url\(\s*['"]?(\/[^)'"\s]+)['"]?\s*\)/)?.[1];
    });
    if(!source||source.startsWith('//')) return null;
    const root=resolve(publicDir),path=resolve(root,'.'+decodeURIComponent(source));
    if(!path.startsWith(root+sep)) throw new Error('Font source must stay in the public directory');
    return detectFontCapabilities(readFileSync(path));
}
