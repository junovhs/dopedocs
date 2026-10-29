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
    number('Line length', 'measure', 'Type', '660px', 300, 1000),
    number('Sidebar width', 'rail', 'Layout', '224px', 160, 360),
    number('Column width', 'column', 'Layout', '752px', 480, 1200),
    number('Paragraph spacing', 'paragraph-gap', 'Type', '16px', 0, 48),
    ...[['Headings font', 'display'], ['Body font', 'body'], ['Interface font', 'ui'], ['Code font', 'mono']]
        .map(([label, name]) => ({ label, token: '--dd-' + name, tab: 'Type' as const, kind: 'text' as const, default: 'system-ui' })),
    number('Text size', 'text-size', 'Type', '15.5px', 12, 24, 0.5),
    { ...keyword('Type scale', 'scale-ratio', 'Type', ['1.125', '1.2', '1.25', '1.333', '1.5', '1.618'], '1.25') },
    { ...number('Title size', 'h1-size', 'Type', '38px', 20, 72), advanced: true },
    { ...number('Heading size', 'h2-size', 'Type', '24px', 16, 48), advanced: true },
    number('Heading weight', 'heading-weight', 'Type', '700', 100, 900, 50, ''),
    number('Line spacing', 'leading', 'Type', '1.75', 1, 2.5, 0.05, ''),
    number('Heading line spacing', 'heading-leading', 'Type', '1.3', 1, 2, 0.05, ''),
    number('Letter spacing', 'body-track', 'Type', '0em', -0.05, 0.2, 0.005, 'em'),
    number('Heading letter spacing', 'display-track', 'Type', '-0.025em', -0.08, 0.1, 0.005, 'em'),
    ...[['Navigation', 'show-nav'], ['Contents', 'show-contents'], ['Search', 'show-search'], ['Page navigation', 'show-pager'], ['Reading progress', 'show-progress'], ['Answer', 'show-answer']]
        .map(([label, name]) => ({ label, token: '--dd-' + name, tab: 'Pieces' as const, kind: 'toggle' as const, default: name === 'show-pager' ? 'grid' : 'block' })),
];

/** Existing native typography tokens: exact CSS remains available for expressions. */
const advancedNumbers: [string, string, string, number, number, number, string][] = [
    ['Subheading size', 'h3-size', '18px', 12, 36, 1, 'px'],
    ['Fourth-level heading size', 'h4-size', '16px', 12, 32, 1, 'px'],
    ['Navigation size', 'nav-size', '13px', 11, 20, 0.5, 'px'],
    ['Contents size', 'toc-size', '14px', 11, 22, 0.5, 'px'],
    ['Metadata size', 'meta-size', '12px', 10, 18, 0.5, 'px'],
    ['Code size', 'code-size', '13px', 10, 22, 0.5, 'px'],
    ['Navigation line spacing', 'nav-leading', '1.4', 1, 2, 0.05, ''],
    ['Label tracking', 'caps-track', '0.1em', 0, 0.3, 0.01, 'em'],
    ['Word spacing', 'word-spacing', '0px', -2, 10, 0.5, 'px'],
    ['Paragraph indent', 'paragraph-indent', '0em', 0, 4, 0.1, 'em'],
    ['Widow lines', 'widows', '2', 1, 6, 1, ''],
    ['Orphan lines', 'orphans', '2', 1, 6, 1, ''],
    ['Underline thickness', 'link-thickness', '1px', 0, 5, 0.5, 'px'],
    ['Underline offset', 'link-offset', '3px', 0, 10, 0.5, 'px'],
    ['List indent', 'list-indent', '19px', 0, 60, 1, 'px'],
    ['List item spacing', 'list-item-gap', '8px', 0, 32, 1, 'px'],
    ['Drop cap size', 'drop-cap-size', '1em', 1, 5, 0.1, 'em'],
    ['Code size ratio', 'code-ratio', '0.83871', 0.6, 1.2, 0.01, ''],
    ['Tab width', 'tab-size', '4', 1, 8, 1, ''],
];
for (const [label, token, value, min, max, step, unit] of advancedNumbers) {
    studioControls.push({ ...number(label, token, 'Type', value, min, max, step, unit), advanced: true });
}

const advancedKeywords: [string, string, string[], string?][] = [
    ['Small capitals', 'small-caps', ['normal', 'small-caps', 'all-small-caps', 'petite-caps', 'titling-caps']],
    ['Number style', 'number-style', ['normal', 'lining-nums', 'oldstyle-nums', 'tabular-nums', 'proportional-nums']],
    ['Ligatures', 'ligatures', ['normal', 'none', 'common-ligatures', 'discretionary-ligatures']],
    ['Optical sizing', 'optical-sizing', ['auto', 'none']],
    ['Synthesized styles', 'font-synthesis', ['weight style small-caps', 'none']],
    ['Kerning', 'kerning', ['auto', 'normal', 'none']],
    ['Hyphenation', 'hyphens', ['manual', 'auto', 'none']],
    ['Alignment', 'text-align', ['start', 'justify']],
    ['Justification', 'text-justify', ['auto', 'inter-word']],
    ['Hanging punctuation', 'hanging-punctuation', ['none', 'first', 'last', 'allow-end']],
    ['Link underline', 'link-decoration', ['underline', 'none']],
    ['Hover underline', 'link-hover-decoration', ['underline', 'none']],
    ['Underline style', 'link-style', ['solid', 'dotted', 'dashed', 'wavy']],
    ['Skip letter descenders', 'link-skip-ink', ['auto', 'none']],
    ['Bullet style', 'bullet-style', ['disc', 'circle', 'square', 'none']],
    ['List numbering', 'list-number-style', ['decimal', 'lower-alpha', 'lower-roman', 'upper-roman']],
    ['Drop cap lines', 'drop-cap', ['normal', '2', '3']],
    ['Numbered headings', 'heading-number', ['none', 'counter(dd-h2) ". "']],
    ['Numbered subheadings', 'subheading-number', ['none', 'counter(dd-h2) "." counter(dd-h3) " "']],
    ['Code ligatures', 'code-ligatures', ['normal', 'none']],
    ['Table numbers', 'table-numbers', ['tabular-nums', 'normal', 'oldstyle-nums']],
];
for (const [label, token, values, value] of advancedKeywords) {
    studioControls.push({ ...keyword(label, token, 'Type', values, value), advanced: true });
}
for (const [label, token, value] of [
    ['Base font family', 'sans', 'system-ui'], ['Caption font', 'caption', 'system-ui'],
    ['Hyphenation limits', 'hyphen-limit', 'auto'], ['OpenType features', 'features', 'normal'],
    ['Variable axes', 'variations', 'normal'],
]) {
    studioControls.push({ label, token: '--dd-' + token, tab: 'Type', kind: 'text', default: value, advanced: true });
}
studioControls.push({ label: 'Underline color', token: '--dd-link-underline-color', tab: 'Type', kind: 'color', default: '#18181b', advanced: true });
for (const role of ['display', 'body', 'ui', 'mono']) {
    for (const setting of ['features', 'variations']) {
        studioControls.push({ label: `${role === 'display' ? 'Heading' : role === 'ui' ? 'Interface' : role === 'mono' ? 'Code' : 'Body'} ${setting === 'features' ? 'OpenType settings' : 'variable axes'}`,
            token: `--dd-${role}-${setting}`, tab: 'Type', kind: 'text', default: 'normal', advanced: true });
    }
}

function colorControl(spec: ControlSpec): string {
    return `<div class="color-fields"><input type="color" data-color="${spec.token}" aria-label="${spec.label} picker" value="${spec.default}"><input data-token="${spec.token}" aria-label="${spec.label}" spellcheck="false"></div>`;
}

function numberControl(spec: ControlSpec): string {
    const id = spec.token.slice(2);
    return `<div class="range-fields"><input type="range" data-range="${spec.token}" aria-label="${spec.label} slider" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${parseFloat(spec.default)}" list="${id}-default"><datalist id="${id}-default"><option value="${parseFloat(spec.default)}" label="Default"></option></datalist><input data-token="${spec.token}" aria-label="${spec.label}" spellcheck="false"><output data-output="${spec.token}">${spec.default}</output></div>`;
}

function keywordControl(spec: ControlSpec): string {
    const names: Record<string, string> = { '1.125': 'Minor second', '1.2': 'Minor third', '1.25': 'Major third', '1.333': 'Fourth', '1.5': 'Fifth', '1.618': 'Golden' };
    return `<div class="seg" role="group" aria-label="${spec.label}">${spec.options!.map(value => `<button data-token-choice="${spec.token}" data-value="${escapeHtml(value)}" aria-pressed="false">${escapeHtml(spec.token === '--dd-scale-ratio' ? names[value] + ' · ' + value : value)}${value === spec.default ? '<small>Default</small>' : ''}</button>`).join('')}</div><input class="keyword-exact" data-token="${spec.token}" aria-label="${spec.label} exact CSS value" spellcheck="false">`;
}

function toggleControl(spec: ControlSpec): string {
    return `<label class="switch"><input type="checkbox" role="switch" data-token="${spec.token}" aria-label="${spec.label}"><span>Visible</span></label>`;
}

export function renderControl(spec: ControlSpec): string {
    const renderers = { color: colorControl, number: numberControl, keyword: keywordControl, toggle: toggleControl,
        text: (item: ControlSpec) => `<input data-token="${item.token}" aria-label="${item.label}" spellcheck="false">` };
    return `<div class="control" data-control="${spec.token}"><div class="control-heading"><label>${escapeHtml(spec.label)}<small>${spec.token}</small></label><button data-reset="${spec.token}" aria-label="Reset ${escapeHtml(spec.label)}" disabled>Reset</button></div>${renderers[spec.kind](spec)}<small class="default-value" data-default="${spec.token}">Default: ${escapeHtml(spec.default)}</small></div>`;
}
