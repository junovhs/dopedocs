/** Browser-only editor, serialized exclusively into the development Studio. */
export function studioClient(palettes: Record<string, Record<string, Record<string, string>>>, specs: import('./studio-controls.js').ControlSpec[], fontClient: typeof import('./studio-font-client.js').studioFontClient, checkReadability: typeof import('./studio-readability.js').checkReadability, presets: typeof import('./studio-controls.js').studioPresets) {
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
    let pending: Record<string, string | null> = {};
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const temporary = new Map<string, string | null>();
    function currentValue(token: string): string {
        return (temporary.has(token) ? temporary.get(token) : state.tokens[token]) ?? defaultValue(token);
    }
    function colorHex(value: string): string {
        const doc = frame.contentDocument ?? document;
        const probe = doc.createElement('span');
        probe.style.color = value;
        doc.body.append(probe);
        const rgb = doc.defaultView!.getComputedStyle(probe).color.match(/[\d.]+/g);
        probe.remove();
        return rgb && rgb.length >= 3 ? '#' + rgb.slice(0, 3).map(channel => Math.round(Number(channel)).toString(16).padStart(2, '0')).join('') : '#000000';
    }
    function sliderValue(token: string, value: string): number | undefined {
        const unit = controls.get(token)?.unit ?? '';
        if (/^-?[\d.]+$/.test(value) && !unit || unit && value.endsWith(unit) && /^-?[\d.]+$/.test(value.slice(0, -unit.length))) return parseFloat(value);
        if (unit === 's' && value.endsWith('ms')) return parseFloat(value) / 1000;
        if (unit !== 'px') return undefined;
        const doc = frame.contentDocument;
        if (!doc?.body) return undefined;
        const ruler = doc.createElement('span');
        ruler.style.cssText = 'position:absolute;visibility:hidden;display:block';
        ruler.style.width = value;
        if (!ruler.style.width || value === 'auto') return undefined;
        doc.body.append(ruler);
        const pixels = ruler.getBoundingClientRect().width;
        ruler.remove();
        return pixels;
    }
    function readability() {
        const doc = frame.contentDocument;
        const body = doc?.querySelector<HTMLElement>('.dd-p');
        if (!doc?.body || !body) return;
        const style = doc.defaultView!.getComputedStyle(body);
        const ruler = doc.createElement('span');
        ruler.style.cssText = 'position:absolute;visibility:hidden;display:block';
        ruler.style.font = style.font;
        ruler.style.width = '1ch';
        doc.body.append(ruler);
        const character = ruler.getBoundingClientRect().width;
        ruler.style.width = currentValue('--dd-measure');
        const measure = ruler.getBoundingClientRect().width / character;
        ruler.remove();
        const active = ($('#mode') as HTMLSelectElement).value as 'light' | 'dark';
        const skin = ($('#skin') as HTMLSelectElement).value;
        const modes = {} as import('./studio-readability.js').ReadabilityInput['modes'];
        function color(value: string): string {
            const probe = doc!.createElement('span');
            probe.style.color = value;
            doc!.body.append(probe);
            const resolved = doc!.defaultView!.getComputedStyle(probe).color;
            probe.remove();
            return resolved;
        }
        for (const mode of ['light', 'dark'] as const) {
            const palette = selectedPalette && mode !== active ? palettes[skin]?.[mode] : undefined;
            modes[mode] = {
                text: color(palette?.['--dd-text-soft'] ?? currentValue('--dd-text-soft')),
                link: color(palette?.['--dd-accent'] ?? currentValue('--dd-accent')),
                background: color(palette?.['--dd-bg'] ?? currentValue('--dd-bg')),
            };
        }
        const warnings = checkReadability({ size: parseFloat(style.fontSize), leading: parseFloat(style.lineHeight) / parseFloat(style.fontSize), measure, modes });
        document.querySelectorAll('.readability-warning').forEach(node => node.remove());
        for (const warning of warnings) {
            const control = document.querySelector(`[data-control="${warning.token}"]`);
            if (!control) continue;
            const row = document.createElement('div');
            row.className = 'readability-warning';
            row.dataset.warning = warning.id;
            row.setAttribute('role', 'status');
            const message = document.createElement('span');
            message.textContent = warning.message;
            const fix = document.createElement('button');
            fix.textContent = 'Use ' + warning.value;
            fix.setAttribute('aria-label', 'Fix ' + warning.id);
            fix.onclick = () => {
                let changes: Record<string, string> = {};
                if (warning.mode && warning.mode !== active && selectedPalette) {
                    ($('#mode') as HTMLSelectElement).value = warning.mode;
                    changes = palettes[skin]?.[warning.mode] ?? {};
                    document.querySelectorAll<HTMLElement>('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === warning.mode)));
                }
                saveTokens({ ...changes, [warning.token]: warning.value });
            };
            row.append(message, fix);
            control.append(row);
        }
    }
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
        for (const [token, value] of temporary) {
            doc.documentElement.style.setProperty(token, value ?? defaultValue(token), 'important');
            if (['sidebar-side', 'outline', 'header', 'current', 'card', 'motion'].includes(token.slice(5))) {
                const prefix = 'dd-' + token.slice(5) + '-';
                for (const name of [...doc.body.classList]) if (name.startsWith(prefix)) doc.body.classList.remove(name);
                doc.body.classList.add(prefix + (value ?? defaultValue(token)));
            }
        }
        readability();
    }
    function render() {
        const mode = ($('#mode') as HTMLSelectElement).value;
        const skin = ($('#skin') as HTMLSelectElement).value;
        $('#panel-subtitle').textContent = (selectedPalette ? skin + ' skin' : 'Your theme') + ' · Local fonts · Live preview';
        document.querySelectorAll<HTMLElement>('[data-skin-preview]').forEach(card => {
            const colors = palettes[card.dataset.skinPreview!]?.[mode];
            if (!colors) return;
            card.style.background = colors['--dd-bg'];
            card.style.color = colors['--dd-text'];
            card.querySelector<HTMLElement>('.skin-accent')!.style.background = colors['--dd-accent'];
        });
        document.querySelectorAll<HTMLElement>('[data-skin]').forEach(button => button.setAttribute('aria-pressed', String(selectedPalette && button.dataset.skin === skin)));
        document.querySelectorAll<HTMLElement>('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
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
            const value = currentValue(token);
            if (input instanceof HTMLInputElement && input.type === 'checkbox')
                input.checked = value !== 'none';
            else
                input.value = value;
        });
        document.querySelectorAll<HTMLInputElement>('[data-color], [data-range]').forEach(input => {
            const token = input.dataset.color ?? input.dataset.range!;
            const value = currentValue(token);
            if (input.type === 'range') {
                const number = sliderValue(token, value);
                input.disabled = number === undefined || !Number.isFinite(number) || number < Number(input.min) || number > Number(input.max);
                if (!input.disabled) input.value = String(number);
            } else input.value = colorHex(value);
        });
        document.querySelectorAll<HTMLElement>('[data-output]').forEach(output => {
            const token = output.dataset.output!;
            output.textContent = currentValue(token);
        });
        document.querySelectorAll<HTMLButtonElement>('[data-token-choice]').forEach(button => {
            const token = button.dataset.tokenChoice!;
            button.setAttribute('aria-pressed', String(currentValue(token) === button.dataset.value));
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
        saveTokens({ [token]: value ?? null });
    }
    function saveTokens(tokens: Record<string, string | null>) {
        for (const [token, value] of Object.entries(tokens)) temporary.set(token, value);
        Object.assign(pending, tokens);
        preview();
        status('Saving…');
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            const batch = pending;
            pending = {};
            queue = queue.then(async () => {
                state = await request('theme', { tokens: batch });
                for (const [token, value] of Object.entries(batch)) {
                    if (temporary.get(token) === value) {
                        temporary.delete(token);
                        frame.contentDocument?.documentElement.style.removeProperty(token);
                    }
                }
                render();
                if (!temporary.size) status('Saved to your theme file');
            }).catch(error => status(error.message));
        }, 120);
    }
    function livePreview(token: string, value: string) {
        temporary.set(token, value);
        preview();
        const output = document.querySelector<HTMLElement>(`[data-output="${token}"]`);
        if (output) output.textContent = value;
        const field = document.querySelector<HTMLInputElement>(`[data-token="${token}"]`);
        if (field && field !== document.activeElement) field.value = value;
    }
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-token]').forEach(input => {
        input.addEventListener('input', () => {
            if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox')
                livePreview(input.dataset.token!, input.value);
        });
        input.addEventListener('change', () => {
            const token = input.dataset.token!;
            const value = input instanceof HTMLInputElement && input.type === 'checkbox'
                ? input.checked ? controls.get(token)!.default : 'none'
                : input.value;
            save(token, value || undefined);
        });
    });
    document.querySelectorAll<HTMLInputElement>('[data-color], [data-range]').forEach(input => {
        input.addEventListener('input', () => {
            const token = input.dataset.color ?? input.dataset.range!;
            livePreview(token, input.value + (input.type === 'range' ? controls.get(token)!.unit ?? '' : ''));
        });
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
        saveTokens(palettes[skin]?.[mode] ?? {});
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
            document.querySelectorAll('[data-mode]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
            palette();
        };
    });
    $('#appearance').addEventListener('click', () => {
        document.body.dataset.appearance = document.body.dataset.appearance === 'dark' ? 'light' : 'dark';
    });
    document.querySelectorAll<HTMLButtonElement>('[data-toggle-panel]').forEach(button => {
        button.onclick = () => {
            const closed = document.body.classList.toggle('panel-collapsed');
            document.querySelector('.remix-button')!.setAttribute('aria-pressed', String(!closed));
        };
    });
    document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => {
        button.onclick = () => {
            const preset = presets[Number(button.dataset.preset)];
            selectedPalette = true;
            ($('#skin') as HTMLSelectElement).value = preset.skin;
            ($('#mode') as HTMLSelectElement).value = preset.mode;
            saveTokens({ ...palettes[preset.skin][preset.mode], ...preset.tokens });
        };
    });
    $('#surprise').addEventListener('click', () => {
        const names = Object.keys(palettes);
        ($('#skin') as HTMLSelectElement).value = names[Math.floor(Math.random() * names.length)];
        palette();
    });
    $('#reset-theme').addEventListener('click', () => {
        selectedPalette = false;
        saveTokens(Object.fromEntries(specs.map(spec => [spec.token, null])));
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
