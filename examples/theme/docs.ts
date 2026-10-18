import { defineDocs, defineFacts } from 'dopedocs';
export const docs = defineDocs({
    entity: { name: 'Field Guide', url: 'https://field-guide.example', notToBeConfusedWith: [] },
    title: 'A little room to grow',
    lead: 'A fictional community garden guide. Clear answers, shared by everyone.',
    facts: defineFacts({ hours: { value: '9am to 6pm', reviewed: '2026-10-18' } }),
    sections: [
        { id: 'visit', title: 'Plan your first visit', question: 'When can I visit the garden?',
          answer: 'Field Guide garden is open {fact:hours}.', blocks: [
            { kind: 'p', text: 'Take a slow walk, meet a neighbour, and see what is growing. Start with [a small task](#join).' },
            { kind: 'callout', text: 'These are fictional example hours, not a real garden listing.' },
            { kind: 'steps', items: [{ title: 'Come by', text: 'Visit during open hours.' }, { title: 'Say hello', text: 'A volunteer can show you around.' }] },
          ] },
        { id: 'join', title: 'Find a way to help', question: 'How can I help?',
          answer: 'Field Guide welcomes small contributions at your own pace.', blocks: [
            { kind: 'checklist', items: [{ text: 'Wear comfortable shoes', checked: true }, { text: 'Ask a volunteer about today’s tasks' }] },
            { kind: 'details', summary: 'What if I have never gardened?', text: 'Everyone starts somewhere. A volunteer can help you choose a first task.' },
          ] },
    ],
});
