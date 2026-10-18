import { defineDocs, defineFacts } from "dopedocs";

/** Fictional product manual. Replace the product, facts and media before publishing. */
export const docs = defineDocs({
    entity: { name: "Lumen Desk", url: "https://lumen-desk.example", notToBeConfusedWith: ["Other products named Lumen"] },
    identity: { name: "Lumen Desk", version: "1.0", channel: "Example" },
    title: "Make room for focused work",
    lead: "Set up your fictional desk lamp, choose comfortable light, and keep it ready for tomorrow.",
    facts: defineFacts({ timer: { value: "25 minutes", reviewed: "2026-10-18" } }),
    sections: [{ id: "daily-use", title: "Daily use", children: [
        { id: "light", title: "Find comfortable light", question: "How do I adjust the Lumen Desk lamp?",
          answer: "Lumen Desk adjusts with the brightness dial and the warm-light button.", blocks: [
            { kind: "p", text: "Turn the dial slowly until the page is easy to read. Then [start a focus session](#focus)." },
            { kind: "image", src: "/manual-assets/lamp.svg", alt: "A lamp with its brightness dial beside the base", width: 640, height: 360,
              srcset: "/manual-assets/lamp.svg 640w", sizes: "(max-width: 640px) 100vw, 640px",
              sources: [{ srcset: "/manual-assets/lamp-compact.svg", media: "(max-width: 480px)", type: "image/svg+xml" }], caption: "The dial changes brightness; the small button changes warmth.", href: "/manual-assets/lamp.svg" },
            { kind: "steps", items: [{ title: "Place the lamp", text: "Keep the base on a level surface." }, { title: "Choose the light", text: "Turn the dial and press the warmth button once." }] },
            { kind: "callout", tone: "warn", text: "Keep the fictional lamp away from water. Follow your real product's safety instructions." },
            { kind: "table", head: ["Control", "Result"], rows: [["Dial", "Brighter or dimmer light"], ["Small button", "Warmer or cooler light"]] },
            { kind: "keys", rows: [["Space", "Pause the companion timer"], ["Esc", "Close settings"]] },
          ] },
        { id: "focus", title: "Begin a focus session", question: "How long is a Lumen Desk focus session?",
          answer: "Lumen Desk's example focus session lasts {fact:timer}.", blocks: [
            { kind: "checklist", items: [{ text: "Clear enough room for the task", checked: true }, { text: "Put a glass of water away from the lamp" }, { text: "Choose one task" }] },
            { kind: "metrics", items: [{ value: "{fact:timer}", label: "Focus", detail: "Stop earlier whenever you need a break." }, { value: "5 minutes", label: "Example break" }] },
            { kind: "compare", before: { title: "Before", text: "Several unfinished tasks compete for attention." }, after: { title: "After", text: "One small task has your attention." } },
            { kind: "quote", text: "Choose a task small enough to finish comfortably.", attribution: "Fictional Lumen Desk guide" },
            { kind: "facts", title: "Your session", rows: [["Duration", "{fact:timer}"], ["Storage", "Only on this fictional device"]] },
            { kind: "cards", items: [{ title: "First setup", text: "Use the onboarding walkthrough before your first session.", href: "https://lumen-desk.example/start", label: "Open walkthrough" }, { title: "Need a pause?", text: "Take a break whenever you need one." }] },
          ] },
    ] }, { id: "care", title: "Care and help", children: [
        { id: "clean", title: "Keep the lamp ready", question: "How do I clean the Lumen Desk lamp?",
          answer: "Lumen Desk's example cleaning routine uses a soft, dry cloth after the lamp is unplugged and cool.", blocks: [
            { kind: "list", ordered: true, items: ["Unplug the lamp.", "Wait until it is cool.", "Wipe with a soft, dry cloth."] },
            { kind: "details", summary: "The light does not turn on", text: "Check the plug and try the power button. Stop using a damaged cable." },
            { kind: "gallery", columns: 2, label: "Lamp controls", images: [
                { src: "/manual-assets/lamp.svg", alt: "Full lamp and base", width: 640, height: 360 },
                { src: "/manual-assets/lamp-compact.svg", alt: "Close view of the brightness dial and warmth button", width: 320, height: 240 },
            ] },
            { kind: "video", src: "/manual-assets/dial.webm", poster: "/manual-assets/lamp.svg", caption: "Silent demonstration: the circle brightens as the dial is turned. The written instructions above contain every step." },
            { kind: "code", language: "text", caption: "Example pairing code shown on the base", code: "LUMEN-DEMO\n" },
          ] },
    ] }],
});
