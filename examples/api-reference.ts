import { defineDocs } from "dopedocs";

/** Fictional API reference; replace all example URLs and credentials before use. */
export const docs = defineDocs({
    entity: { name: "Garden", url: "https://garden.example", notToBeConfusedWith: [] },
    title: "Garden API guide",
    lead: "Create a small task for your fictional shared garden.",
    facts: {},
    sections: [{ id: "first-task", title: "Your first task", question: "How do I create a Garden task?", answer: "Garden creates a task when you send its title to the tasks endpoint with your example token.", blocks: [{ kind: "p", text: "Choose a short title, then send the request shown in the API samples." }] }],
    api: {
        baseUrl: "https://api.garden.example/v1",
        authentication: "Send an example bearer token in the Authorization header.",
        groups: [{ id: "tasks", title: "Tasks", description: "Create and track garden tasks.", endpoints: [{
            id: "create-task", method: "POST", path: "/tasks", title: "Create a task", description: "Adds one task to the shared list.", guide: "first-task",
            parameters: [
                { name: "Authorization", type: "string", required: true, location: "header", description: "Your example bearer token.", example: "Bearer YOUR_TOKEN" },
                { name: "title", type: "string", required: true, location: "body", description: "A short task title.", example: "Water the mint" },
            ],
            exampleResponse: { status: 201, description: "The created task.", body: { id: "task-1", title: "Water the mint" } },
        }] }],
        errors: [{ status: 401, code: "unauthorized", description: "The example token is missing or invalid." }],
    },
});
