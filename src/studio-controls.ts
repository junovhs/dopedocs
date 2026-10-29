/** Development-only control specifications and renderers. */
import { escapeHtml } from './inline.js';

export interface ControlSpec {
    token: string;
    label: string;
    tab: 'Style' | 'Layout' | 'Type' | 'Pieces';
    kind: 'color' | 'number' | 'keyword' | 'toggle' | 'text';
    default: string;
    advanced?: boolean;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    options?: string[];
}

function number(label: string, name: string, tab: ControlSpec['tab'], value: string, min: number, max: number, step = 1, unit = 'px'): ControlSpec {
    return { label, token: '--dd-' + name, tab, kind: 'number', default: value, min, max, step, unit };
}

function keyword(label: string, name: string, tab: ControlSpec['tab'], values: string[], value = values[0]): ControlSpec {
    return { label, token: '--dd-' + name, tab, kind: 'keyword', default: value, options: values };
}

export const studioControls: ControlSpec[] = [
    ...Object.entries({ accent: '#18181b', bg: '#ffffff', text: '#18181b', 'text-soft': '#52525b', line: '#e4e4e7' })
        .map(([name, value]) => ({ token: '--dd-' + name, label: ({ accent: 'Accent', bg: 'Background', text: 'Text', 'text-soft': 'Secondary text', line: 'Border color' } as Record<string, string>)[name], tab: 'Style' as const, kind: 'color' as const, default: value })),
    keyword('Cards', 'card', 'Style', ['raised', 'outline', 'flat', 'tint'], 'outline'),
    number('Corners', 'radius', 'Style', '4px', 0, 24),
    number('Border width', 'border-width', 'Style', '1px', 0, 5),
    { token: '--dd-texture', label: 'Texture image', tab: 'Style', kind: 'text', default: 'none', advanced: true },
    { token: '--dd-card-shadow', label: 'Card shadow', tab: 'Style', kind: 'text', default: 'none', advanced: true },
    keyword('Sidebar side', 'sidebar-side', 'Layout', ['left', 'right']),
    keyword('Outline', 'outline', 'Layout', ['right', 'left', 'off']),
    keyword('Header', 'header', 'Layout', ['glass', 'solid', 'minimal'], 'solid'),
    keyword('Current page', 'current', 'Layout', ['pill', 'line', 'bold', 'solid'], 'line'),
    keyword('Motion', 'motion', 'Layout', ['calm', 'snappy', 'none'], 'calm'),
    number('Density', 'density', 'Layout', '1', 0.6, 1.5, 0.05, ''),
    number('Reading width', 'measure', 'Layout', '660px', 300, 1000),
    number('Sidebar width', 'rail', 'Layout', '224px', 160, 360),
    number('Column width', 'column', 'Layout', '752px', 480, 1200),
    number('Paragraph spacing', 'paragraph-gap', 'Layout', '16px', 0, 48),
    ...[['Headings font', 'display'], ['Body font', 'body'], ['Interface font', 'ui'], ['Code font', 'mono']]
        .map(([label, name]) => ({ label, token: '--dd-' + name, tab: 'Type' as const, kind: 'text' as const, default: 'system-ui' })),
    number('Text size', 'text-size', 'Type', '15.5px', 12, 24, 0.5),
    { ...keyword('Type scale', 'scale-ratio', 'Type', ['1.125', '1.2', '1.25', '1.333', '1.5', '1.618'], '1.25') },
    number('Title size', 'h1-size', 'Type', '38px', 20, 72),
    number('Heading size', 'h2-size', 'Type', '24px', 16, 48),
    number('Heading weight', 'heading-weight', 'Type', '700', 100, 900, 50, ''),
    number('Line spacing', 'leading', 'Type', '1.75', 1, 2.5, 0.05, ''),
    number('Heading line spacing', 'heading-leading', 'Type', '1.3', 1, 2, 0.05, ''),
    number('Letter spacing', 'body-track', 'Type', '0em', -0.05, 0.2, 0.005, 'em'),
    number('Heading letter spacing', 'display-track', 'Type', '-0.025em', -0.08, 0.1, 0.005, 'em'),
    ...[['Navigation', 'show-nav'], ['Contents', 'show-contents'], ['Search', 'show-search'], ['Page navigation', 'show-pager'], ['Reading progress', 'show-progress'], ['Answer', 'show-answer']]
        .map(([label, name]) => ({ label, token: '--dd-' + name, tab: 'Pieces' as const, kind: 'toggle' as const, default: name === 'show-pager' ? 'grid' : 'block' })),
];

function colorControl(spec: ControlSpec): string {
    return `<div class="color-fields"><input type="color" data-color="${spec.token}" aria-label="${spec.label} picker" value="${spec.default}"><input data-token="${spec.token}" aria-label="${spec.label}" spellcheck="false"></div>`;
}

function numberControl(spec: ControlSpec): string {
    const id = spec.token.slice(2);
    return `<div class="range-fields"><input type="range" data-range="${spec.token}" aria-label="${spec.label} slider" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${parseFloat(spec.default)}" list="${id}-default"><datalist id="${id}-default"><option value="${parseFloat(spec.default)}" label="Default"></option></datalist><input data-token="${spec.token}" aria-label="${spec.label}" spellcheck="false"><output data-output="${spec.token}">${spec.default}</output></div>`;
}

function keywordControl(spec: ControlSpec): string {
    return `<div class="seg" role="group" aria-label="${spec.label}">${spec.options!.map(value => `<button data-token-choice="${spec.token}" data-value="${value}" aria-pressed="false">${value}${value === spec.default ? '<small>Default</small>' : ''}</button>`).join('')}</div>`;
}

function toggleControl(spec: ControlSpec): string {
    return `<label class="switch"><input type="checkbox" role="switch" data-token="${spec.token}" aria-label="${spec.label}"><span>Visible</span></label>`;
}

export function renderControl(spec: ControlSpec): string {
    const renderers = { color: colorControl, number: numberControl, keyword: keywordControl, toggle: toggleControl,
        text: (item: ControlSpec) => `<input data-token="${item.token}" aria-label="${item.label}" spellcheck="false">` };
    return `<div class="control" data-control="${spec.token}"><div class="control-heading"><label>${escapeHtml(spec.label)}<small>${spec.token}</small></label><button data-reset="${spec.token}" aria-label="Reset ${escapeHtml(spec.label)}" disabled>Reset</button></div>${renderers[spec.kind](spec)}<small class="default-value" data-default="${spec.token}">Default: ${escapeHtml(spec.default)}</small></div>`;
}
