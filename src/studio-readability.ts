/** Studio-only advisory checks; these never prevent a theme save. */
export interface ReadabilityInput {
    size: number;
    measure: number;
    leading: number;
    modes: Record<'light' | 'dark', { text: string; link: string; background: string }>;
}
export interface ReadabilityWarning {
    id: string;
    token: string;
    message: string;
    value: string;
    mode?: 'light' | 'dark';
}

/** WCAG contrast formula: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html */
export function checkReadability(input: ReadabilityInput): ReadabilityWarning[] {
    function channels(value: string): number[] | undefined {
        const hex = value.trim().match(/^#([a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i)?.[1];
        if (hex) {
            const full = hex.length <= 4 ? [...hex].map(char => char + char).join('') : hex;
            const values = full.match(/../g)!.map(part => parseInt(part, 16) / 255);
            return values.length === 3 ? [...values, 1] : values;
        }
        if (/^rgba?\(/i.test(value)) {
            const values = value.match(/[\d.]+%?/g)?.map((part, index) => part.endsWith('%') ? parseFloat(part) / 100 : Number(part) / (index < 3 ? 255 : 1));
            if (values && values.length >= 3) return values.length === 3 ? [...values, 1] : values;
        }
        return undefined;
    }
    function luminance(rgb: number[]): number {
        const linear = rgb.slice(0, 3).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }
    function contrast(foreground: number[], background: number[]): number {
        const alpha = foreground[3] ?? 1;
        const painted = foreground.slice(0, 3).map((value, index) => value * alpha + background[index] * (1 - alpha));
        const a = luminance(painted), b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    const warnings: ReadabilityWarning[] = [];
    for (const mode of ['light', 'dark'] as const) {
        const colors = input.modes[mode];
        const background = channels(colors.background);
        if (!background) continue;
        const ground = background.slice(0, 3).map(value => value * background[3] + (mode === 'light' ? 1 : 0) * (1 - background[3]));
        const fix = contrast([0, 0, 0, 1], ground) >= contrast([1, 1, 1, 1], ground) ? '#000000' : '#ffffff';
        for (const [name, token] of [['text', '--dd-text-soft'], ['link', '--dd-accent']] as const) {
            const foreground = channels(colors[name]);
            if (!foreground) continue;
            const ratio = contrast(foreground, ground);
            if (ratio < 4.5) warnings.push({ id: `${mode}-${name}-contrast`, token, mode,
                message: `${mode === 'light' ? 'Light' : 'Dark'} ${name} contrast is ${ratio.toFixed(2)}:1; aim for at least 4.5:1.`, value: fix });
        }
    }
    if (input.size < 15) warnings.push({ id: 'body-size', token: '--dd-text-size', message: 'Body text is below 15px. Try 15.5px for easier reading.', value: '15.5px' });
    if (input.measure < 45 || input.measure > 90) warnings.push({ id: 'line-length', token: '--dd-measure', message: `Line length is about ${Math.round(input.measure)} characters. Aim for 45–90.`, value: '65ch' });
    if (input.leading < 1.3) warnings.push({ id: 'body-leading', token: '--dd-leading', message: 'Body line spacing is below 1.3. Try 1.75 for easier reading.', value: '1.75' });
    return warnings;
}
