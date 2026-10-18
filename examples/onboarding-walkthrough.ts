import { defineDocs, defineFacts } from "dopedocs";

/** A complete, fictional first-use flow. All claims are example content. */
export const docs = defineDocs({
    entity: { name: "Lumen Desk", url: "https://lumen-desk.example", notToBeConfusedWith: ["Other products named Lumen"] },
    title: "Your first comfortable workspace",
    lead: "Three short tasks take you from the box to a workspace that is ready to use.",
    facts: defineFacts({ setup: { value: "about five minutes", reviewed: "2026-10-18" } }),
    sections: [
        { id: "before-starting", title: "1. Before you start", question: "What do I need to set up Lumen Desk?",
          answer: "Lumen Desk's example setup needs a clear desk, a nearby socket and {fact:setup}.", blocks: [
            { kind: "callout", text: "This is a fictional walkthrough. Use the instructions supplied with your real device." },
            { kind: "checklist", items: [{ text: "The lamp and cable are present" }, { text: "The desk is dry and level" }, { text: "The cable is undamaged" }] },
            { kind: "image", src: "/manual-assets/lamp.svg", alt: "The example lamp standing beside its controls", width: 640, height: 360 },
          ] },
        { id: "connect", title: "2. Connect and adjust", question: "How do I connect Lumen Desk for the first time?",
          answer: "Lumen Desk's example setup places the lamp, connects power and adjusts the dial to comfortable brightness.", blocks: [
            { kind: "steps", items: [{ title: "Place", text: "Set the base on the desk." }, { title: "Connect", text: "Connect the supplied cable with dry hands." }, { title: "Adjust", text: "Turn the dial until the light is comfortable." }] },
            { kind: "details", summary: "The light is too bright", text: "Turn the dial back a little and move the lamp farther from your page." },
            { kind: "video", src: "/manual-assets/dial.webm", poster: "/manual-assets/lamp.svg", caption: "Silent animation of increasing brightness. Turn the dial slowly to adjust." },
          ] },
        { id: "ready", title: "3. Try one task", question: "How do I know my Lumen Desk setup is ready?",
          answer: "Lumen Desk's example workspace is ready when the page is easy to read and the cable is clear of your chair.", blocks: [
            { kind: "checklist", items: [{ text: "The page is evenly lit" }, { text: "The cable is clear of moving furniture" }] },
            { kind: "p", text: "Try reading one page. Adjust the light whenever your position changes." },
            { kind: "cards", items: [{ title: "Continue with daily use", text: "Learn focus sessions and care in the accompanying product manual.", href: "https://lumen-desk.example/docs/light/", label: "Read the manual" }] },
          ] },
    ],
});
