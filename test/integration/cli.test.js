/**
 * test/integration/cli.test.js
 * Runs the built CLI (bin/decode.js) as a subprocess and asserts on
 * stdout/stderr and exit codes (AGENTS.md rules 5 & 8).
 */
import { describe, it, expect } from 'vitest';
import { execa } from 'execa';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../bin/decode.js', import.meta.url));
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
);

function run(args, opts = {}) {
  return execa(process.execPath, [CLI, ...args], { reject: false, ...opts });
}

describe('decode CLI basics', () => {
  it('--version prints the package version and exits 0', async () => {
    const { stdout, exitCode } = await run(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(version);
  });

  it('help prints usage and the command list and exits 0', async () => {
    const { stdout, exitCode } = await run(['help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Usage');
    expect(stdout).toContain('init');
    expect(stdout).toContain('status');
  });

  it('an unknown command exits non-zero', async () => {
    const { exitCode, stderr } = await run(['definitely-not-a-command']);
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain('error');
  });
});
