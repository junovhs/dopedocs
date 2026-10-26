import { mkdtempSync, cpSync, symlinkSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { spawnCommand } from '../scripts/run-command.mjs';

export function buildPackage() {
    const root = resolve(import.meta.dirname, '..');
    const scratch = mkdtempSync(join(tmpdir(), 'dopedocs-cli-'));
    const result = spawnCommand(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json', '--outDir', join(scratch, 'dist')], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) { rmSync(scratch, { recursive: true, force: true }); throw new Error(result.stdout + result.stderr); }
    cpSync(join(root, 'styles'), join(scratch, 'styles'), { recursive: true });
    writeFileSync(join(scratch, 'package.json'), readFileSync(join(root, 'package.json')));
    symlinkSync(join(root, 'node_modules'), join(scratch, 'node_modules'), 'junction');
    return {
        scratch,
        run: (args, cwd, env = {}) => spawnCommand(process.execPath, [join(scratch, 'dist/cli.js'), ...args], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' }),
        runAsync: (args, cwd) => new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [join(scratch, 'dist/cli.js'), ...args], { cwd, env: process.env });
            let stdout = '', stderr = '';
            child.stdout.on('data', chunk => { stdout += chunk; });
            child.stderr.on('data', chunk => { stderr += chunk; });
            child.on('error', reject);
            child.on('close', status => resolve({ status, stdout, stderr }));
        }),
        cleanup: () => rmSync(scratch, { recursive: true, force: true }),
    };
}
