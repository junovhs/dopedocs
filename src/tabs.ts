/** Progressive tabs: the authored HTML always contains every labelled pane. */
export function mountTabs(root: ParentNode): () => void {
    const cleanups: (() => void)[] = [];
    const groups = new Map<string, string>();
    const sets: { group?: string; select: (key: string) => void }[] = [];
    let nextId = 0;
    function uniqueId(): string {
        let id: string;
        do { id = `dd-tab-${++nextId}`; } while (document.getElementById(id));
        return id;
    }
    for (const region of root.querySelectorAll<HTMLElement>("[data-dd-tabs]")) {
        const label = region.querySelector<HTMLElement>(":scope > .dd-tabs-label")!;
        const panes = [...region.querySelectorAll<HTMLElement>(":scope > [data-dd-pane]")];
        if (!panes.length) continue;
        const list = document.createElement("div");
        list.className = "dd-tab-list";
        list.setAttribute("role", "tablist");
        list.setAttribute("aria-label", label.textContent ?? "");
        const buttons = panes.map(pane => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "dd-tab";
            button.id = uniqueId();
            button.textContent = pane.querySelector(":scope > .dd-tab-label")!.textContent;
            pane.id = uniqueId();
            pane.setAttribute("role", "tabpanel");
            pane.setAttribute("aria-labelledby", button.id);
            pane.tabIndex = 0;
            button.setAttribute("role", "tab");
            button.setAttribute("aria-controls", pane.id);
            list.append(button);
            return button;
        });
        const group = region.dataset.ddTabGroup;
        function select(key: string): void {
            if (!panes.some(pane => pane.dataset.ddPane === key)) return;
            panes.forEach((pane, index) => {
                const selected = pane.dataset.ddPane === key;
                pane.hidden = !selected;
                buttons[index]!.setAttribute("aria-selected", String(selected));
                buttons[index]!.tabIndex = selected ? 0 : -1;
            });
        }
        function activate(index: number): void {
            const key = panes[index]!.dataset.ddPane!;
            select(key);
            if (group) {
                groups.set(group, key);
                sets.filter(set => set.group === group).forEach(set => set.select(key));
            }
        }
        const listeners = buttons.map((button, index) => {
            const click = () => activate(index);
            const keydown = (event: KeyboardEvent) => {
                const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                const target = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
                    offset ? (index + offset + buttons.length) % buttons.length : undefined;
                if (target === undefined) return;
                event.preventDefault();
                activate(target);
                buttons[target]!.focus();
            };
            button.addEventListener("click", click);
            button.addEventListener("keydown", keydown);
            return () => {
                button.removeEventListener("click", click);
                button.removeEventListener("keydown", keydown);
            };
        });
        sets.push({ group, select });
        const initial = (group && groups.get(group)) || panes[0]!.dataset.ddPane!;
        select(panes[0]!.dataset.ddPane!);
        select(initial);
        if (group && !groups.has(group)) groups.set(group, initial);
        label.after(list);
        region.classList.add("dd-tabs--enhanced");
        cleanups.push(() => {
            listeners.forEach(cleanup => cleanup());
            list.remove();
            region.classList.remove("dd-tabs--enhanced");
            panes.forEach(pane => {
                pane.hidden = false;
                ["id", "role", "aria-labelledby", "tabindex"].forEach(attr => pane.removeAttribute(attr));
            });
        });
    }
    return () => cleanups.forEach(cleanup => cleanup());
}

/** Self-hosted static enhancement; no runtime imports. */
export const tabsScript = () => `(${mountTabs.toString()})(document);`;
