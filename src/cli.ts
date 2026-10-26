#!/usr/bin/env node
import { resolve } from "node:path";
import { documentedThemeTokens, normalizeThemeToken, parseTheme, readThemeFile, writeThemeToken } from "./theme.js";

const usage = "Usage: dopedocs fonts add|list|remove (use README for font options); dopedocs theme list|get <token>|set <token> <value>|unset <token> [--file docs-theme.css]";
try {
    const args = process.argv.slice(2);
    if (!args.length || args.includes("--help") || args.includes("-h")) {
        console.log(usage);
    } else if (args[0] === "fonts") {
        await (await import("./fonts.js")).fontsCommand(args.slice(1));
    } else {
        let file = "docs-theme.css";
        const index = args.indexOf("--file");
        if (index >= 0) {
            if (!args[index + 1]) throw new Error("--file needs a path");
            file = args[index + 1];
            args.splice(index, 2);
        }
        const [command, action, token, value] = args;
        if (command !== "theme" || !["list", "get", "set", "unset"].includes(action) || args.length !== (action === "list" ? 2 : action === "set" ? 4 : 3)) throw new Error(usage);
        const path = resolve(file);
        const known = documentedThemeTokens();
        if (action === "list") {
            const values = parseTheme(readThemeFile(path));
            for (const name of known) if (name in values) console.log(`${name}: ${values[name]}`);
        } else {
            const name = normalizeThemeToken(token);
            if (!known.includes(name)) console.error(`Warning: unknown dopedocs token ${name}; check styles/TOKENS.md`);
            if (action === "get") {
                const found = parseTheme(readThemeFile(path))[name];
                if (found === undefined) process.exitCode = 1;
                else console.log(found);
            } else writeThemeToken(path, name, action === "set" ? value : undefined);
        }
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
