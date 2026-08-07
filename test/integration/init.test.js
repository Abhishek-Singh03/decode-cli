/**
 * test/integration/init.test.js
 * `decode init` end-to-end: runs in a temp cwd so the real repo is untouched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../bin/decode.js', import.meta.url));
const CONFIG_FILE = 'decode.config.json';

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-init-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function run(args, opts = {}) {
  return execa(process.execPath, [CLI, ...args], { cwd: tmp, reject: false, ...opts });
}

describe('decode init', () => {
  it('writes a config file + .env, and status reflects the connection', async () => {
    const init = await run([
      'init',
      '--llm-provider',
      'anthropic',
      '--llm-api-key',
      'sk-test-123',
      '--github-token',
      'gh-test-456',
    ]);
    expect(init.exitCode).toBe(0);
    expect(init.stdout.toLowerCase()).toContain('configured');

    expect(fs.existsSync(path.join(tmp, CONFIG_FILE))).toBe(true);
    const env = fs.readFileSync(path.join(tmp, '.env'), 'utf8');
    expect(env).toContain('LLM_PROVIDER_API_KEY=sk-test-123');
    expect(env).toContain('GITHUB_TOKEN=gh-test-456');

    const status = await run(['status']);
    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain('anthropic');
    expect(status.stdout.toLowerCase()).toContain('configured');
    expect(status.stdout).toContain(CONFIG_FILE);
  });
});
