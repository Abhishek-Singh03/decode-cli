/**
 * test/integration/init.test.js
 * `decode init` end-to-end: runs in a temp cwd so the real repo is untouched,
 * with DECODE_GLOBAL_CONFIG_DIR isolated so the machine-wide store is hermetic.
 * Covers the interactive-scope defaults (global on first run / local once a
 * global setup exists) via the non-interactive flag path.
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
let globalDir;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-init-test-'));
  globalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-global-it-'));
  process.env.DECODE_GLOBAL_CONFIG_DIR = globalDir;
});

afterEach(() => {
  delete process.env.DECODE_GLOBAL_CONFIG_DIR;
  fs.rmSync(globalDir, { recursive: true, force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
});

function run(args, opts = {}) {
  return execa(process.execPath, [CLI, ...args], { cwd: tmp, reject: false, ...opts });
}

const INIT_FLAGS = ['--llm-provider', 'anthropic', '--llm-api-key', 'sk-test-123', '--github-token', 'gh-test-456'];

describe('decode init', () => {
  it('defaults to a GLOBAL config on the first-ever run (no global config yet)', async () => {
    const init = await run(['init', ...INIT_FLAGS]);
    expect(init.exitCode).toBe(0);
    expect(init.stdout.toLowerCase()).toContain('global');
    expect(init.stdout.toLowerCase()).toContain('configured');

    // The config + secrets went to the global tier, not the project dir.
    expect(fs.existsSync(path.join(globalDir, CONFIG_FILE))).toBe(true);
    expect(fs.readFileSync(path.join(globalDir, '.env'), 'utf8')).toContain('LLM_PROVIDER_API_KEY=sk-test-123');
    expect(fs.existsSync(path.join(tmp, CONFIG_FILE))).toBe(false);

    const status = await run(['status']);
    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain('anthropic');
    expect(status.stdout.toLowerCase()).toContain('(global)');
  });

  it('writes a project-LOCAL config + .env when --scope local is passed', async () => {
    const init = await run(['init', ...INIT_FLAGS, '--scope', 'local']);
    expect(init.exitCode).toBe(0);
    expect(init.stdout.toLowerCase()).toContain('(local)');

    expect(fs.existsSync(path.join(tmp, CONFIG_FILE))).toBe(true);
    const env = fs.readFileSync(path.join(tmp, '.env'), 'utf8');
    expect(env).toContain('LLM_PROVIDER_API_KEY=sk-test-123');
    expect(env).toContain('GITHUB_TOKEN=gh-test-456');

    const status = await run(['status']);
    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain('anthropic');
    expect(status.stdout.toLowerCase()).toContain('configured');
    expect(status.stdout.toLowerCase()).toContain('(local)');
  });

  it('defaults to a LOCAL config once a global config already exists', async () => {
    // Pre-seed the global tier so the first-run heuristic flips to local.
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(path.join(globalDir, CONFIG_FILE), '{"llm":{"provider":"groq","apiKeyRef":"LLM_PROVIDER_API_KEY"}}\n', 'utf8');

    const init = await run(['init', ...INIT_FLAGS]);
    expect(init.exitCode).toBe(0);
    expect(init.stdout.toLowerCase()).toContain('(local)');

    expect(fs.existsSync(path.join(tmp, CONFIG_FILE))).toBe(true);
    expect(fs.readFileSync(path.join(tmp, '.env'), 'utf8')).toContain('GITHUB_TOKEN=gh-test-456');
  });
});