import type { ApiEndpoint, ApiParameter, DocApi, Finding, FindingCode, JsonValue } from "./schema.js";

/** HTTP methods supported by the typed REST reference and executable request samples. */
export const API_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
export type ApiMethod = (typeof API_METHODS)[number];
/** One endpoint's build-time examples, ready for an optional reference renderer. */
export interface ApiSamples { curl: string; javascript: string; python: string; }
const locations = ["path", "query", "header", "body"];
const types = ["string", "number", "integer", "boolean", "object", "array"];
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const templateNames = (path: string) => [...path.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]);

/** Validate API ids, request shape and links against the document's actual guide pages. */
export function validateApi(api: DocApi, pageIds: ReadonlySet<string>): Finding[] {
    const findings: Finding[] = [];
    const report = (code: FindingCode, message: string, endpointId?: string) => findings.push({ code, severity: "fatal", message, ...(endpointId ? { endpointId } : {}) });
    try {
        const url = new URL(api.baseUrl);
        if (!["https:", "http:"].includes(url.protocol) || url.search || url.hash || url.username || url.password) throw new Error();
    } catch { report("invalid-api-url", `API baseUrl "${api.baseUrl}" must be an absolute HTTP(S) URL without credentials, query or fragment.`); }
    const seen = new Set<string>();
    const checkId = (id: string, endpointId?: string) => {
        if (!slug.test(id)) report("invalid-api-id", `API id "${id}" must be lowercase words joined by hyphens.`, endpointId);
        if (seen.has(id)) report("duplicate-api-id", `API id "${id}" is duplicated; resource and endpoint ids must be unique within the API.`, endpointId);
        seen.add(id);
    };
    for (const group of api.groups) {
        checkId(group.id);
        for (const endpoint of group.endpoints) {
            const id = endpoint.id;
            checkId(id, id);
            if (!API_METHODS.includes(endpoint.method)) report("unknown-api-method", `API endpoint "${id}" uses unknown method "${endpoint.method}"; use ${API_METHODS.join(", ")}.`, id);
            if (!/^\/(?!\/)/.test(endpoint.path) || /[?#\s]/.test(endpoint.path) || /[{}]/.test(endpoint.path.replace(/\{[^{}]+\}/g, ""))) report("invalid-api-url", `API endpoint "${id}" needs an absolute path such as /tasks/{id}, without a query or fragment.`, id);
            if (endpoint.guide !== undefined && !pageIds.has(endpoint.guide)) report("unknown-api-guide", `API endpoint "${id}" links to guide "${endpoint.guide}", which is not a documentation page.`, id);
            const params = endpoint.parameters ?? [];
            const names = new Set<string>();
            const placeholders = templateNames(endpoint.path);
            for (const parameter of params) {
                const key = `${parameter.location}:${parameter.location === "header" ? parameter.name.toLowerCase() : parameter.name}`;
                if (!parameter.name.trim() || names.has(key) || !locations.includes(parameter.location) || !types.includes(parameter.type)) report("invalid-api-parameter", `API endpoint "${id}" has an invalid or duplicate ${parameter.location} parameter "${parameter.name}".`, id);
                names.add(key);
                if (parameter.location === "path" && (!parameter.required || !placeholders.includes(parameter.name))) report("invalid-api-parameter", `API endpoint "${id}" path parameter "${parameter.name}" must be required and appear in its path.`, id);
                if (parameter.location === "header" && (!/^[!#$%&'*+.^_\x60|~0-9a-z-]+$/i.test(parameter.name) || /[\x00-\x08\x0a-\x1f\x7f\u0100-\uffff]/.test(textOf(exampleOf(parameter))))) report("invalid-api-parameter", `API endpoint "${id}" header "${parameter.name}" contains invalid header characters.`, id);
                if (parameter.location === "body" && ["GET", "HEAD"].includes(endpoint.method)) report("invalid-api-parameter", `API endpoint "${id}" cannot send body parameter "${parameter.name}" with ${endpoint.method}.`, id);
            }
            for (const name of placeholders) if (!params.some(parameter => parameter.location === "path" && parameter.name === name)) report("invalid-api-parameter", `API endpoint "${id}" path placeholder "${name}" has no declared path parameter.`, id);
            if (!validStatus(endpoint.exampleResponse.status)) report("invalid-api-response", `API endpoint "${id}" response status must be an integer from 100 to 599.`, id);
        }
    }
    for (const error of api.errors ?? []) if (!validStatus(error.status)) report("invalid-api-response", `API error "${error.code ?? error.description}" has invalid HTTP status ${error.status}.`);
    return findings;
}
function validStatus(status: number): boolean { return Number.isInteger(status) && status >= 100 && status <= 599; }
function exampleOf(parameter: ApiParameter): JsonValue {
    if (parameter.example !== undefined) return parameter.example;
    switch (parameter.type) {
        case "number": case "integer": return 1;
        case "boolean": return true;
        case "object": return {};
        case "array": return [];
        default: return `example-${parameter.name}`;
    }
}
const textOf = (value: JsonValue): string => typeof value === "object" ? JSON.stringify(value) : String(value);
// POSIX shell quoting: examples remain literal even with quotes or dollar signs.
const shell = (value: string): string => "'" + value.replaceAll("'", "'\"'\"'") + "'";
const quoted = (value: unknown): string => JSON.stringify(value);

function requestSamples(api: DocApi, endpoint: ApiEndpoint): ApiSamples {
    const parameters = endpoint.parameters ?? [];
    const path = endpoint.path.replace(/\{([^{}]+)\}/g, (_, name: string) => {
        const parameter = parameters.find(item => item.location === "path" && item.name === name);
        if (!parameter) throw new Error(`API endpoint "${endpoint.id}" has an undeclared path parameter "${name}"`);
        return encodeURIComponent(textOf(exampleOf(parameter)));
    });
    const url = new URL(api.baseUrl.replace(/\/+$/, "") + path);
    const included = parameters.filter(parameter => parameter.required || parameter.example !== undefined);
    for (const parameter of included.filter(item => item.location === "query")) url.searchParams.append(parameter.name, textOf(exampleOf(parameter)));
    const headers = Object.fromEntries(included.filter(item => item.location === "header").map(item => [item.name, textOf(exampleOf(item))]));
    const bodyParameters = included.filter(item => item.location === "body");
    const body = bodyParameters.length ? Object.fromEntries(bodyParameters.map(item => [item.name, exampleOf(item)])) : undefined;
    if (body && !Object.keys(headers).some(name => name.toLowerCase() === "content-type")) headers["Content-Type"] = "application/json";
    const curl = [`curl ${endpoint.method === "HEAD" ? "--head" : `--request ${shell(endpoint.method)}`} ${shell(url.href)}`,
        ...Object.entries(headers).map(([name, value]) => `  --header ${shell(`${name}: ${value}`)}`),
        ...(body ? [`  --data-raw ${shell(JSON.stringify(body))}`] : [])].join(" \\\n");
    const javascript = `const response = await fetch(${quoted(url.href)}, {\n${[
        `  method: ${quoted(endpoint.method)}`,
        ...(Object.keys(headers).length ? [`  headers: ${JSON.stringify(headers, null, 2).replaceAll("\n", "\n  ")}`] : []),
        ...(body ? [`  body: JSON.stringify(${JSON.stringify(body, null, 2).replaceAll("\n", "\n  ")})`] : []),
    ].join(",\n")}\n});\nconsole.log(await response.text());`;
    const python = `import json\nimport urllib.request\n\nrequest = urllib.request.Request(\n    ${quoted(url.href)},\n    method=${quoted(endpoint.method)},\n    headers={${Object.entries(headers).map(([name, value]) => `${quoted(name)}: ${quoted(value)}`).join(", ")}},${body ? `\n    data=json.dumps(json.loads(${quoted(JSON.stringify(body))})).encode("utf-8"),` : ""}\n)\nwith urllib.request.urlopen(request) as response:\n    print(response.read().decode("utf-8"))`;
    return { curl, javascript, python };
}

/** Generate deterministic examples from validated typed API data; no request is executed at build time. */
export function generateApiSamples(api: DocApi): Record<string, ApiSamples> {
    return Object.fromEntries(api.groups.flatMap(group => group.endpoints.map(endpoint => [endpoint.id, requestSamples(api, endpoint)])));
}
