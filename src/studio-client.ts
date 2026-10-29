/** Browser-only editor, serialized exclusively into the development Studio. */
export function studioClient(palettes: Record<string, Record<string, Record<string, string>>>, specs: import('./studio-controls.js').ControlSpec[], fontClient: typeof import('./studio-font-client.js').studioFontClient) {
    const $ = (selector: string) => document.querySelector(selector)!;
    const frame = $('#preview') as HTMLIFrameElement;
    let state: {
        css: string;
        tokens: Record<string, string>;
        classes: string[];
    } = { css: '', tokens: {}, classes: [] };
    let queue = Promise.resolve();
    const status = (text: string) => { $('#status').textContent = text; };
    const controls = new Map(specs.map(spec => [spec.token, spec]));
    let selectedPalette = false;
    function defaultValue(token: string): string {
        const skin = ($('#skin') as HTMLSelectElement).value;
        const mode = ($('#mode') as HTMLSelectElement).value;
        return (selectedPalette ? palettes[skin]?.[mode]?.[token] : undefined) ?? controls.get(token)?.default ?? '';
    }
    function preview() {
        const doc = frame.contentDocument;
        if (!doc?.body)
            return;
        let style = doc.querySelector('#studio-theme');
        if (!style) {
            style = doc.createElement('style');
            style.id = 'studio-theme';
            doc.head.append(style);
        }
        style.textContent = state.css;
        doc.body.className = 'dd-static ' + state.classes.join(' ');
    }
    function render() {
        document.querySelectorAll<HTMLElement>('[data-default]').forEach(label => {
            const token = label.dataset.default!;
            label.textContent = 'Default: ' + defaultValue(token);
            if (controls.get(token)?.kind === 'color') {
                const swatch = document.createElement('i');
                swatch.style.cssText = 'display:inline-block;width:10px;height:10px;margin-right:5px;border:1px solid currentColor';
                swatch.style.background = defaultValue(token);
                label.prepend(swatch);
            }
        });
        document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-token]').forEach(input => {
            const token = input.dataset.token!;
            const value = state.tokens[token] ?? defaultValue(token);
            if (input instanceof HTMLInputElement && input.type === 'checkbox')
                input.checked = value !== 'none';
            else
                input.value = value;
        });
        document.querySelectorAll<HTMLInputElement>('[data-color], [data-range]').forEach(input => {
            const token = input.dataset.color ?? input.dataset.range!;
            const value = state.tokens[token] ?? defaultValue(token);
            input.value = input.type === 'range' ? String(parseFloat(value)) : /^#[0-9a-f]{6}$/i.test(value) ? value : defaultValue(token);
        });
        document.querySelectorAll<HTMLElement>('[data-output]').forEach(output => {
            const token = output.dataset.output!;
            output.textContent = state.tokens[token] ?? defaultValue(token);
        });
        document.querySelectorAll<HTMLButtonElement>('[data-token-choice]').forEach(button => {
            const token = button.dataset.tokenChoice!;
            button.setAttribute('aria-pressed', String((state.tokens[token] ?? defaultValue(token)) === button.dataset.value));
        });
        document.querySelectorAll<HTMLButtonElement>('[data-reset]').forEach(button => {
            const token = button.dataset.reset!;
            button.disabled = !(token in state.tokens) || state.tokens[token] === defaultValue(token);
        });
        $('#export-css').textContent = state.css || '/* Choose a control to create your theme. */';
        preview();
        void fonts.refreshFontCapabilities();
    }
    async function request(path: string, data?: unknown) {
        const response = await fetch('/__dopedocs/' + path, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const result = await response.json();
        if (!response.ok)
            throw new Error(result.error || 'Studio request failed');
        return result;
    }
    function save(token: string, value?: string) {
        status('Saving…');
        queue = queue.then(async () => { state = await request('theme', { token, value }); render(); status('Saved to your theme file'); }).catch(error => status(error.message));
    }
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-token]').forEach(input => {
        input.addEventListener('change', () => {
            const token = input.dataset.token!;
            const value = input instanceof HTMLInputElement && input.type === 'checkbox'
                ? input.checked ? controls.get(token)!.default : 'none'
                : input.value;
            save(token, value || undefined);
        });
    });
    document.querySelectorAll<HTMLInputElement>('[data-color], [data-range]').forEach(input => {
        input.addEventListener('change', () => {
            const token = input.dataset.color ?? input.dataset.range!;
            save(token, input.value + (input.type === 'range' ? controls.get(token)!.unit ?? '' : ''));
        });
    });
    document.querySelectorAll<HTMLButtonElement>('[data-token-choice]').forEach(button => {
        button.onclick = () => save(button.dataset.tokenChoice!, button.dataset.value);
    });
    document.querySelectorAll<HTMLButtonElement>('[data-reset]').forEach(button => button.onclick = () => {
        const token = button.dataset.reset!;
        save(token, selectedPalette ? defaultValue(token) : undefined);
    });
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => button.onclick = () => {
        document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
        document.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => panel.hidden = panel.dataset.panel !== button.dataset.tab);
    });
    $('#reload').addEventListener('click', () => { request('theme').then(value => { state = value; fonts.clearFontPreview(); render(); status('Read from your theme file'); }).catch(error => status(error.message)); });
    function palette() {
        selectedPalette = true;
        const skin = ($('#skin') as HTMLSelectElement).value;
        const mode = ($('#mode') as HTMLSelectElement).value;
        for (const [token, value] of Object.entries(palettes[skin]?.[mode] ?? {}))
            save(token, value);
    }
    $('#mode').addEventListener('change', palette);
    $('#skin').addEventListener('change', palette);
    document.querySelectorAll<HTMLButtonElement>('[data-skin]').forEach(button => {
        button.onclick = () => {
            ($('#skin') as HTMLSelectElement).value = button.dataset.skin!;
            document.querySelectorAll('[data-skin]').forEach(card => card.setAttribute('aria-pressed', String(card === button)));
            palette();
        };
    });
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => {
        button.onclick = () => {
            const mode = button.dataset.mode!;
            ($('#mode') as HTMLSelectElement).value = mode;
            document.body.dataset.appearance = mode;
            document.querySelectorAll('[data-mode]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
            palette();
        };
    });
    const fonts = fontClient({
        frame,
        get state() { return state; },
        set state(value) { state = value; },
        get queue() { return queue; },
        set queue(value) { queue = value; },
        request, render, status,
    });
    frame.addEventListener('load', preview);
    request('theme').then(value => { state = value; render(); status('Ready — edits save automatically'); }).catch(error => status(error.message));
}
