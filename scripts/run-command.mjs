import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

/** Run npm through Node: Windows .cmd shims cannot be spawned without a shell. */
export function spawnCommand(command, args, options) {
  let executable = command;
  let argv = args;
  if (command === 'npm') {
    const npmCli = [
      process.env.npm_execpath,
      resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
      resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
    ].find(path => path && basename(path) === 'npm-cli.js' && existsSync(path));
    if (npmCli) {
      executable = process.execPath;
      argv = [npmCli, ...args];
    }
  }
  const result = spawnSync(executable, argv, options);
  if (result.error) {
    throw new Error(
      `Unable to launch ${command} in ${options.cwd}: ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result;
}
