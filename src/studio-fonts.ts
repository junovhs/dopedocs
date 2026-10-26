/** Catalog and temporary preview downloads only run in the local development server. */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { addFont, type FontOptions } from './fonts.js';

export interface CatalogFont {id:string;family:string;category:string;variable:boolean;weights:number[];subsets:string[];defSubset:string;type:string}
let catalog: Promise<CatalogFont[]> | undefined;
export async function fontCatalog(): Promise<CatalogFont[]> {
    return catalog ??= fetch('https://api.fontsource.org/v1/fonts?type=google',{signal:AbortSignal.timeout(30000)}).then(async response=>{
        if (!response.ok) throw new Error(`Font catalog unavailable (${response.status})`);
        const result=await response.json() as CatalogFont[];
        if (!Array.isArray(result)) throw new Error('Invalid font catalog');
        return result.filter(font=>font.type==='google' && /^[a-z0-9-]+$/.test(font.id));
    }).catch(error=>{catalog=undefined;throw error;});
}
export async function catalogChoice(id:string,weight:number,subset:string): Promise<CatalogFont> {
    const font=(await fontCatalog()).find(font=>font.id===id);
    if(!font || !font.weights.includes(weight) || !font.subsets.includes(subset)) throw new Error('Choose an available family, weight and subset');
    return font;
}
export async function previewFont(id:string,weight:number,subset:string):Promise<Buffer> {
    await catalogChoice(id,weight,subset);
    const response=await fetch(`https://cdn.jsdelivr.net/npm/@fontsource/${id}@latest/files/${id}-${subset}-${weight}-normal.woff2`,{signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error(`Font preview unavailable (${response.status})`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.subarray(0,4).toString()!=='wOF2') throw new Error('Invalid preview font');
    return bytes;
}
export async function installStudioFont(data: {id?:string;role?:FontOptions['role'];weights?:number[];subset?:string;name?:string;bytes?:string;license?:string}, options:FontOptions):Promise<void> {
    if(!['display','body','ui','mono'].includes(data.role??'')) throw new Error('Choose a font role');
    if(data.id) {
        const weights=data.weights??[400];
        for(const weight of weights) await catalogChoice(data.id,weight,data.subset??'latin');
        await addFont(data.id,{...options,role:data.role,weights,subset:data.subset??'latin'});
    } else {
        const ext=extname(data.name??'').toLowerCase();
        if(!['.otf','.ttf','.woff2'].includes(ext) || !data.bytes || !data.license?.trim()) throw new Error('Drop a font file and include its licence text');
        const scratch=mkdtempSync(join(tmpdir(),'dopedocs-studio-font-'));
        try {
            const path=join(scratch,'font'+ext);
            writeFileSync(path,Buffer.from(data.bytes,'base64'));
            writeFileSync(join(scratch,'OFL.txt'),data.license);
            await addFont(path,{...options,role:data.role});
        } finally {rmSync(scratch,{recursive:true,force:true});}
    }
}
