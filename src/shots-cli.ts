#!/usr/bin/env node
/**
 * dopedocs-shots: take the documentation screenshots a config declares.
 *
 *   dopedocs-shots [config] [--only a,b] [--out dir] [--list]
 *
 * The config defaults to dopedocs.shots.mjs (or .js) in the working directory
 * and default-exports `defineShots({...})`.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { captureShots, type ShotsConfig } from "./shots.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));

async function main(): Promise<void> {
    const candidates = positional.length ? positional : ["dopedocs.shots.mjs", "dopedocs.shots.js"];
    const path = candidates.map((file) => resolve(file)).find((file) => existsSync(file));
    if (!path) throw new Error(`No shots config found (looked for ${candidates.join(", ")}).`);
    const config = ((await import(pathToFileURL(path).href)) as { default: ShotsConfig }).default;
    if (!config?.shots) throw new Error(`${path} must default-export defineShots({ ... }).`);

    if (args.includes("--list")) {
        for (const shot of config.shots) {
            const viewport = shot.viewport ?? config.viewport ?? { width: 1280, height: 800 };
            console.log(`${shot.name.padEnd(24)} ${`${viewport.width}x${viewport.height}@${shot.dpr ?? 1}`.padEnd(14)} ${shot.serves ?? ""}`);
        }
        return;
    }
    const only = flag("only")?.split(",").map((name) => name.trim()).filter(Boolean);
    await captureShots(config, { only, out: flag("out"), log: (line) => console.log(line) });
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
