/** Browser-only editor, serialized exclusively into the development Studio. */
export function studioClient(palettes: Record<string, Record<string, Record<string,string>>>) {
    const $ = (selector: string) => document.querySelector(selector)!;
    const frame = $('#preview') as HTMLIFrameElement;
    let state: {css: string; tokens: Record<string, string>; classes: string[]} = {css:'', tokens:{}, classes:[]};
    let queue = Promise.resolve();
    const status = (text: string) => { $('#status').textContent = text; };
    function preview() {
        const doc = frame.contentDocument;
        if (!doc?.body) return;
        let style = doc.querySelector('#studio-theme');
        if (!style) { style=doc.createElement('style'); style.id='studio-theme'; doc.head.append(style); }
        style.textContent=state.css;
        doc.body.className = 'dd-static ' + state.classes.join(' ');
    }
    function render() {
        document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-token]').forEach(input => {
            input.value = state.tokens[input.dataset.token!] ?? '';
        });
        $('#export-css').textContent = state.css || '/* Choose a control to create your theme. */';
        preview();
    }
    async function request(path: string, data?: unknown) {
        const response = await fetch('/__dopedocs/' + path, data === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Studio request failed');
        return result;
    }
    function save(token: string, value?: string) {
        status('Saving…');
        queue = queue.then(async () => { state = await request('theme',{token,value}); render(); status('Saved to your theme file'); }).catch(error => status(error.message));
    }
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-token]').forEach(input => {
        input.addEventListener('change', () => save(input.dataset.token!,input.value || undefined));
    });
    document.querySelectorAll<HTMLButtonElement>('[data-reset]').forEach(button => button.onclick=()=>save(button.dataset.reset!));
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => button.onclick=()=>{
        document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(tab=>tab.setAttribute('aria-selected',String(tab===button)));
        document.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==button.dataset.tab);
    });
    $('#reload').addEventListener('click', () => { request('theme').then(value=>{state=value;render();status('Read from your theme file');}).catch(error=>status(error.message)); });
    function palette() {
        const skin = ($('#skin') as HTMLSelectElement).value;
        const mode = ($('#mode') as HTMLSelectElement).value;
        for (const [token,value] of Object.entries(palettes[skin]?.[mode] ?? {})) save(token,value);
    }
    $('#mode').addEventListener('change',palette);
    $('#skin').addEventListener('change',palette);
    type FontEntry = {id:string;family:string;category:string;variable:boolean;weights:number[];subsets:string[];defSubset:string};
    let catalog: FontEntry[] | undefined;
    let upload: File | undefined;
    const fontMessage=(text:string)=>{$('#font-message').textContent=text;};
    const field=(selector:string)=>($(selector) as HTMLInputElement).value;
    const roleToken=()=> '--dd-'+field('#font-role');
    let temporaryFont: FontFace | undefined;
    function clearFontPreview() {
        for (const role of ['display','body','ui','mono']) frame.contentDocument?.documentElement.style.removeProperty('--dd-'+role);
    }
    $('#font-role').addEventListener('change',clearFontPreview);
    async function fontSearch() {
        fontMessage('Loading catalog…');
        try {
            catalog ??= await request('fonts');
            const query=field('#font-search').toLowerCase(),category=field('#font-category'),variable=($('#font-variable') as HTMLInputElement).checked;
            const matches=catalog!.filter(font=>font.family.toLowerCase().includes(query)&&(!category||font.category===category)&&(!variable||font.variable));
            const container=$('#font-results'); container.replaceChildren();
            for (const font of matches.slice(0,40)) {
                const row=document.createElement('div'); row.className='font-result';
                const title=document.createElement('strong');title.textContent=font.family;
                const desc=document.createElement('small');desc.textContent=' · '+font.category+(font.variable?' · variable':'')+' · weights '+font.weights.join(', ')+' · '+font.subsets.join(', ');
                const previewButton=document.createElement('button');previewButton.textContent='Preview';
                const installButton=document.createElement('button');installButton.textContent='Use font';
                previewButton.onclick=async()=>{
                    fontMessage('Loading '+font.family+' preview…');
                    try {
                        const doc=frame.contentDocument!,weight=font.weights.includes(400)?400:font.weights[0],subset=font.defSubset;
                        const face=new FontFace('Studio Preview',`url("/__dopedocs/font-preview?id=${encodeURIComponent(font.id)}&weight=${weight}&subset=${encodeURIComponent(subset)}")`);
                        await face.load();if(temporaryFont) doc.fonts.delete(temporaryFont);doc.fonts.add(face);temporaryFont=face;
                        clearFontPreview();
                        doc.documentElement.style.setProperty(roleToken(),'"Studio Preview", sans-serif');
                        ($('#font-weights') as HTMLInputElement).value=String(weight);($('#font-subset') as HTMLInputElement).value=subset;
                        fontMessage('Previewing '+font.family+' on your text. Use font to save.');
                    } catch(error) {fontMessage((error as Error).message);}
                };
                installButton.onclick=()=>{
                    queue=queue.then(async()=>{
                        fontMessage('Installing '+font.family+'…');
                        state=await request('fonts',{id:font.id,role:field('#font-role'),weights:field('#font-weights').split(',').map(Number),subset:field('#font-subset')});
                        clearFontPreview();render();fontMessage('Installed '+font.family+' locally');
                    }).catch(error=>fontMessage(error.message));
                };
                row.append(title,desc,document.createElement('br'),previewButton,installButton);container.append(row);
            }
            fontMessage(matches.length+' matching families'+(matches.length>40?' — showing 40; narrow your search':''));
        } catch(error) {fontMessage((error as Error).message);}
    }
    $('#font-search-button').addEventListener('click',fontSearch);
    $('#font-search').addEventListener('keydown',event=>{if((event as KeyboardEvent).key==='Enter') void fontSearch();});
    $('#font-file').addEventListener('change',()=>{upload=($('#font-file') as HTMLInputElement).files?.[0];fontMessage(upload?'Selected '+upload.name:'Choose a font');});
    $('#font-drop').addEventListener('dragover',event=>event.preventDefault());
    $('#font-drop').addEventListener('drop',event=>{event.preventDefault();upload=(event as DragEvent).dataTransfer?.files[0];fontMessage(upload?'Selected '+upload.name:'Choose a font');});
    $('#font-upload').addEventListener('click',()=>{
        queue=queue.then(async()=>{
            if(!upload) throw new Error('Choose or drop a font file first');
            if(upload.size>16*1024*1024) throw new Error('Choose a font smaller than 16 MB');
            fontMessage('Installing your font…');
            const bytes=new Uint8Array(await upload.arrayBuffer());let binary='';for(const byte of bytes) binary+=String.fromCharCode(byte);
            state=await request('fonts',{name:upload.name,bytes:btoa(binary),license:field('#font-license'),role:field('#font-role')});
            clearFontPreview();render();fontMessage('Installed your font locally');
        }).catch(error=>fontMessage(error.message));
    });
    frame.addEventListener('load',preview);
    request('theme').then(value=>{state=value;render();status('Ready — edits save automatically');}).catch(error=>status(error.message));
}
