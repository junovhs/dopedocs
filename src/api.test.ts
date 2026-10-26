import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { defineDocs, validate, type DocApi, type DocSet } from "./schema.js";
import { generateApiSamples } from "./index.js";
import { buildStatic, InvalidDocumentError } from "./static.js";

const api: DocApi = {
    baseUrl: "https://api.garden.example/v1",
    authentication: "Send your example token as an Authorization header.",
    groups: [{ id: "tasks", title: "Tasks", endpoints: [{
        id: "create-task", method: "POST", path: "/gardens/{garden}/tasks", title: "Create a task", description: "Adds one garden task.", guide: "start",
        parameters: [
            { name: "garden", type: "string", required: true, location: "path", description: "Garden id", example: "plot/a b" },
            { name: "dryRun", type: "boolean", required: false, location: "query", description: "Preview only", example: false },
            { name: "Authorization", type: "string", required: true, location: "header", description: "Example token", example: "Bearer O'Reilly $HOME" },
            { name: "title", type: "string", required: true, location: "body", description: "Task title", example: 'Grow "mint"\nwith care' },
            { name: "optional", type: "number", required: false, location: "query", description: "Omitted when no example" },
        ],
        exampleResponse: { status: 201, body: { id: "task-1" } },
    }] }],
    errors: [{ status: 401, code: "unauthorized", description: "Token is missing or invalid." }],
};
const doc = (value = structuredClone(api)): DocSet => defineDocs({
    entity: { name: "Garden", url: "https://garden.example", notToBeConfusedWith: [] }, title: "Garden guide", lead: "", facts: {},
    sections: [{ id: "start", title: "Start", question: "How do I start?", answer: "Garden starts with one small task.", blocks: [] }], api: value,
});

describe("typed API authoring and validation", () => {
    it("accepts optional API data and emits samples at the real static build surface", () => {
        expect(validate(doc())).toEqual([]);
        const tree = buildStatic(doc(), { now: new Date("2026-10-18") });
        const samples = JSON.parse(tree["api-samples.json"]);
        expect(Object.keys(samples)).toEqual(["create-task"]);
        expect(samples["create-task"]).toEqual(generateApiSamples(api)["create-task"]);
        const without = doc(); delete without.api;
        expect(buildStatic(without)["api-samples.json"]).toBeUndefined();
    });
    it("names a broken guide link and blocks the static build", () => {
        const broken = doc(); broken.api!.groups[0].endpoints[0].guide = "missing-guide";
        expect(validate(broken)).toContainEqual(expect.objectContaining({ code: "unknown-api-guide", severity: "fatal", endpointId: "create-task", message: expect.stringContaining("missing-guide") }));
        expect(() => buildStatic(broken)).toThrow(InvalidDocumentError);
    });
    it("rejects duplicate API ids, unknown methods and unresolved path parameters", () => {
        const broken = doc();
        const endpoint = broken.api!.groups[0].endpoints[0];
        broken.api!.groups[0].endpoints.push({ ...endpoint, method: "INVENTED" as typeof endpoint.method });
        endpoint.path = "/tasks/{missing}";
        const codes = validate(broken).map(finding => finding.code);
        expect(codes).toContain("duplicate-api-id");
        expect(codes).toContain("unknown-api-method");
        expect(codes).toContain("invalid-api-parameter");
    });
    it("fills required examples deterministically and rejects GET bodies and invalid header values", () => {
        const reference = structuredClone(api);
        const endpoint = reference.groups[0].endpoints[0];
        endpoint.path = "/tasks";
        endpoint.parameters = [
            { name: "count", type: "integer", location: "query", required: true, description: "Count" },
            { name: "enabled", type: "boolean", location: "query", required: true, description: "Enabled" },
            { name: "tags", type: "array", location: "body", required: true, description: "Tags" },
        ];
        const samples = generateApiSamples(reference)["create-task"];
        expect(samples.curl).toContain("?count=1&enabled=true");
        expect(samples.curl).toContain('{"tags":[]}');
        endpoint.method = "GET";
        endpoint.parameters.push({ name: "X-Test", type: "string", location: "header", required: true, description: "Invalid", example: "bad\nheader" });
        expect(validate(doc(reference)).filter(finding => finding.code === "invalid-api-parameter")).toHaveLength(2);
    });
    it("reports invalid URLs, response status, ids and duplicate parameters together", () => {
        const broken = doc(); broken.api!.baseUrl = "javascript:bad";
        const endpoint = broken.api!.groups[0].endpoints[0];
        endpoint.id = "Bad ID"; endpoint.exampleResponse.status = 999;
        endpoint.parameters!.push({ ...endpoint.parameters![0] });
        const codes = validate(broken).map(finding => finding.code);
        expect(codes).toEqual(expect.arrayContaining(["invalid-api-url", "invalid-api-id", "invalid-api-response", "invalid-api-parameter"]));
    });
});

function execute(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args); let stdout = "", stderr = "";
        child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
        child.on("error", reject);
        child.on("close", code => code === 0 ? resolve(stdout) : reject(new Error(`${command} exited ${code}: ${stderr}`)));
    });
}

describe("generated requests against a local endpoint", () => {
    let server: Server;
    let reference: DocApi;
    const received: { url: string; method?: string; auth?: string; body: unknown }[] = [];
    beforeAll(async () => {
        server = createServer((request, response) => {
            let body = ""; request.on("data", chunk => { body += chunk; }); request.on("end", () => {
                received.push({ url: request.url!, method: request.method, auth: request.headers.authorization, body: body ? JSON.parse(body) : undefined });
                response.setHeader("Content-Type", "application/json"); response.end('{"id":"task-1"}');
            });
        });
        await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
        reference = structuredClone(api);
        reference.baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
    });
    afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
    const expected = { method: "POST", url: "/v1/gardens/plot%2Fa%20b/tasks?dryRun=false", auth: "Bearer O'Reilly $HOME", body: { title: 'Grow "mint"\nwith care' } };
    it("JavaScript performs the documented request with encoded parameters and JSON body", async () => {
        const { javascript } = generateApiSamples(reference)["create-task"];
        const run = new (Object.getPrototypeOf(async function () {}).constructor)("fetch", "console", javascript);
        await run(fetch, { log() {} });
        expect(received.at(-1)).toEqual(expected);
    });
    it.runIf(process.platform !== "win32" && spawnSync("curl", ["--version"]).status === 0)("cURL quoting preserves literal quotes, dollars and JSON", async () => {
        const { curl } = generateApiSamples(reference)["create-task"];
        await execute("sh", ["-c", curl]);
        expect(received.at(-1)).toEqual(expected);
    });
    it.runIf(spawnSync("python3", ["--version"]).status === 0)("Python uses only its standard library and sends the same request", async () => {
        const { python } = generateApiSamples(reference)["create-task"];
        await execute("python3", ["-c", python]);
        expect(received.at(-1)).toEqual(expected);
    });
});
