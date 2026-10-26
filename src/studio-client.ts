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
    frame.addEventListener('load',preview);
    request('theme').then(value=>{state=value;render();status('Ready — edits save automatically');}).catch(error=>status(error.message));
}
