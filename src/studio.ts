/** Development-only editing routes. No Studio HTML or script enters buildStatic. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { documentedThemeTokens, parseTheme, readThemeFile, writeThemeToken } from './theme.js';
import { structuralClasses } from './structure.js';
import { studioPalettes } from './studio-palettes.js';
import { studioClient } from './studio-client.js';
import type { DevServerLike } from './host.js';

const PREFIX = '/__dopedocs/';
type Control = [string, string, string?];
const groups: Record<string, Control[]> = {
    Style: [['Accent','accent'],['Cards','card','raised|outline|flat|tint'],['Texture','texture'],['Corners','radius'],['Card shadow','card-shadow'],['Border color','line'],['Border width','border-width'],['Background','bg'],['Text','text'],['Secondary text','text-soft']],
    Layout: [['Sidebar side','sidebar-side','left|right'],['Outline','outline','right|left|off'],['Header','header','glass|solid|minimal'],['Current page','current','pill|line|bold|solid'],['Reading width','measure'],['Sidebar width','rail'],['Column width','column'],['Paragraph spacing','paragraph-gap']],
    Type: [['Headings font','display'],['Body font','body'],['Interface font','sans'],['Code font','mono'],['Text size','text-size'],['Type scale','scale-ratio'],['Title size','h1-size'],['Heading size','h2-size'],['Heading weight','heading-weight'],['Line spacing','leading'],['Heading line spacing','heading-leading'],['Letter spacing','body-track'],['Heading letter spacing','display-track']],
    Pieces: [['Navigation','show-nav','block|none'],['Contents','show-contents','block|none'],['Search','show-search','block|none'],['Page navigation','show-pager','grid|none'],['Reading progress','show-progress','block|none'],['Answer','show-answer','block|none']],
};
function studioHtml() {
    const controls = (items: Control[]) => items.map(([label,name,options])=>`<div class="control"><label>${label}<small>--dd-${name}</small>${options?`<select data-token="--dd-${name}"><option value="">Default</option>${options.split('|').map(value=>`<option>${value}</option>`).join('')}</select>`:`<input data-token="--dd-${name}" placeholder="Default" spellcheck="false">`}</label><button data-reset="--dd-${name}" aria-label="Reset ${label}">↺</button></div>`).join('');
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>dopedocs Studio</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f7f7f8;color:#202126;font:14px system-ui}header{height:64px;padding:12px 24px;display:flex;align-items:center;gap:16px;border-bottom:1px solid #dedee3;background:white}h1{font-size:18px;margin:0}header small{color:#666}#status{margin-left:auto;font-size:12px;color:#62636b}button,select,input{font:inherit}button{cursor:pointer;border:1px solid #dedee3;border-radius:6px;background:white;padding:7px 10px}main{display:grid;grid-template-columns:minmax(0,1fr) 340px;height:calc(100dvh - 64px)}iframe{border:0;width:100%;height:100%;background:white}aside{border-left:1px solid #dedee3;background:white;overflow:auto}nav{display:flex;position:sticky;top:0;background:white;border-bottom:1px solid #dedee3;padding:12px 8px;gap:3px}nav button{border:0;padding:8px}[aria-selected=true]{background:#202126;color:white}section{padding:20px}section[hidden]{display:none}h2{font-size:18px;margin:0 0 20px}.control{display:flex;align-items:end;gap:6px;margin:0 0 16px}label{display:block;flex:1;min-width:0;font-weight:550}label small{display:block;font:11px ui-monospace,monospace;color:#797983;margin:4px 0 7px}input,select{display:block;width:100%;min-width:0;border:1px solid #d4d4db;border-radius:6px;background:#fafafa;padding:9px;color:inherit}.control button{margin-bottom:1px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 ui-monospace,monospace}#mode{margin-bottom:20px}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #6157e8;outline-offset:2px}@media(max-width:780px){main{grid-template-columns:minmax(0,1fr) 280px}header small{display:none}}
</style><header><h1>dopedocs <span style="font-weight:400">Studio</span></h1><small>Your content. Your theme.</small><span id="status" role="status">Opening…</span><button id="reload">Reload file</button></header>
<main><iframe id="preview" title="Your documentation preview" src="/__dopedocs/preview"></iframe><aside><nav role="tablist" aria-label="Remix controls">${[...Object.keys(groups),'Export'].map((tab,i)=>`<button role="tab" data-tab="${tab}" aria-selected="${i===0}">${tab}</button>`).join('')}</nav>${Object.entries(groups).map(([tab,items],i)=>`<section role="tabpanel" data-panel="${tab}" ${i?'hidden':''}><h2>${tab}</h2>${tab==='Style'?'<label>Skin<select id="skin">'+Object.keys(studioPalettes).map(name=>'<option>'+name+'</option>').join('')+'</select></label><label>Mode<select id="mode"><option value="light">Light</option><option value="dark">Dark</option></select></label>':''}${controls(items)}</section>`).join('')}<section role="tabpanel" data-panel="Export" hidden><h2>Your theme CSS</h2><p>Edits save automatically. Hand-written CSS stays in place.</p><pre id="export-css"></pre></section></aside></main><script>(${studioClient.toString()})(${JSON.stringify(studioPalettes)});</script></html>`;
}

export function serveStudio(server: DevServerLike, options: {file: string; build: () => Record<string,string>; basePath: string}) {
    const file = resolve(options.file);
    const state = () => { const css=readThemeFile(file); const tokens=parseTheme(css); return {css,tokens,classes:structuralClasses(tokens)}; };
    server.middlewares.use((incoming,outgoing,next)=>{
        const req=incoming as IncomingMessage, res=outgoing as ServerResponse;
        const path=(req.url??'').split('?')[0];
        if (!path?.startsWith(PREFIX)) return next();
        const send=(body:string,type='application/json',code=200)=>{res.statusCode=code;res.setHeader('Content-Type',type+'; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(body);};
        // Restrict local editing to local hosts and same-origin JSON requests.
        const host=req.headers.host??'';
        if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) return send(JSON.stringify({error:'Studio requires a loopback host'}),'application/json',403);
        if (req.method==='POST' && (req.headers.origin && req.headers.origin!==`http://${host}` && req.headers.origin!==`https://${host}` || !req.headers['content-type']?.startsWith('application/json'))) return send(JSON.stringify({error:'Same-origin JSON required'}),'application/json',403);
        void (async()=>{
            if (req.method==='GET' && path===PREFIX+'studio') return send(studioHtml(),'text/html');
            if (req.method==='GET' && path===PREFIX+'preview') {
                const tree=options.build();
                const html=tree[options.basePath.replace(/^\/+|\/+$/g,'')+'/index.html'];
                if (!html) throw new Error('No generated manual to preview');
                return send(html.replace('</head>',`<link rel="stylesheet" href="${PREFIX}theme.css"></head>`),'text/html');
            }
            if (req.method==='GET' && path===PREFIX+'theme.css') return send(readThemeFile(file),'text/css');
            if (req.method==='GET' && path===PREFIX+'theme') return send(JSON.stringify(state()));
            if (req.method==='POST' && path===PREFIX+'theme') {
                let body=''; for await (const part of req) { body+=part; if(body.length>65536) throw new Error('Request too large'); }
                const {token,value}=JSON.parse(body) as {token:string;value?:string};
                if (!documentedThemeTokens().includes(token) || value!==undefined && typeof value!=='string') throw new Error('Unknown token or invalid value');
                writeThemeToken(file,token,value);
                return send(JSON.stringify(state()));
            }
            send(JSON.stringify({error:'Unknown Studio route'}),'application/json',404);
        })().catch(error=>send(JSON.stringify({error:(error as Error).message}),'application/json',400));
    });
}
