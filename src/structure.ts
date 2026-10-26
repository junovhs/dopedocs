/** Structural keywords shared by build hosts and the browser panel. */
export const structuralKeywords = {
    '--dd-sidebar-side': ['left', 'right'],
    '--dd-outline': ['right', 'left', 'off'],
    '--dd-header': ['glass', 'solid', 'minimal'],
    '--dd-current': ['pill', 'line', 'bold', 'solid'],
    '--dd-card': ['raised', 'outline', 'flat', 'tint'],
} as const;

export function structuralClasses(values: Record<string, string>, warn: (message: string) => void = console.warn): string[] {
    const classes: string[] = [];
    for (const [token, allowed] of Object.entries(structuralKeywords)) {
        const value = values[token]?.replace(/\s*!important\s*$/, '').trim();
        if (!value) continue;
        if (!(allowed as readonly string[]).includes(value)) {
            warn(`[dopedocs] Unknown ${token} value: ${value}; using the default`);
            continue;
        }
        classes.push(`dd-${token.slice(5)}-${value}`);
    }
    return classes;
}
