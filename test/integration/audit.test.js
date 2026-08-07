/**
 * test/integration/audit.test.js
 * `decode audit` end-to-end. Runs the real CLI in a temp cwd that contains a
 * healthy throwaway git repo, fresh docs, and a route pointing at a local
 * http server (hermetic). Verifies the combined summary, the CI exit code,
 * and the --json / --ci output formats.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const CLI = fileURLToPath(new URL('../../bin/decode.js', import.meta.url));

let server;
let baseUrl;
let tmp;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/ok') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"error":"not found"}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  server.closeAllConnections?.();
  return new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-audit-it-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function run(args, opts = {}) {
  return execa(process.execPath, [CLI, ...args], { cwd: tmp, reject: false, ...opts });
}

function git(args) {
  return execFileSync('git', args, { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** Turns the temp cwd into a healthy repo: origin remote + a recent commit. */
function makeHealthyRepo() {
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(tmp, 'a.txt'), 'x\n');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'init']);
  git(['remote', 'add', 'origin', 'https://github.com/example/decode-test.git']);
}

/** Adds fresh docs (no source files, so docs can't be stale). */
function addFreshDocs() {
  fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'docs', 'architecture.md'), '# Docs\n');
}

describe('decode audit', () => {
  it('reports a combined pass and exits 0 when everything is healthy', async () => {
    makeHealthyRepo();
    addFreshDocs();
    await run(['api', 'add', `${baseUrl}/ok`]);

    const audit = await run(['audit']);
    expect(audit.exitCode).toBe(0);
    expect(audit.stdout.toUpperCase()).toContain('PASS');
    expect(audit.stdout).toContain('Audit passed');
  });

  it('exits non-zero when a check fails', async () => {
    makeHealthyRepo();
    // No docs → docs check fails, repo passes, api is skipped.
    const audit = await run(['audit']);
    expect(audit.exitCode).toBe(1);
    expect(audit.stdout.toUpperCase()).toContain('FAIL');
    expect(audit.stdout).toContain('Audit failed');
  });

  it('emits a machine-readable summary with --json', async () => {
    makeHealthyRepo();
    addFreshDocs();
    await run(['api', 'add', `${baseUrl}/ok`]);

    const audit = await run(['audit', '--json']);
    expect(audit.exitCode).toBe(0);
    const parsed = JSON.parse(audit.stdout);
    expect(parsed.summary.ok).toBe(true);
    expect(parsed.summary.passed).toBe(3);
    expect(parsed.api.status).toBe('pass');
    expect(parsed.docs.status).toBe('pass');
    expect(parsed.repo.status).toBe('pass');
  });

  it('reports failures in --json too', async () => {
    makeHealthyRepo();
    const audit = await run(['audit', '--json']);
    expect(audit.exitCode).toBe(1);
    const parsed = JSON.parse(audit.stdout);
    expect(parsed.summary.ok).toBe(false);
    expect(parsed.docs.status).toBe('fail');
    expect(parsed.repo.status).toBe('pass');
  });

  it('--ci prints plain PASS/FAIL lines with a summary and the same exit code', async () => {
    makeHealthyRepo();
    addFreshDocs();
    await run(['api', 'add', `${baseUrl}/ok`]);

    const audit = await run(['audit', '--ci']);
    expect(audit.exitCode).toBe(0);
    expect(audit.stdout.toUpperCase()).toContain('PASS');
    expect(audit.stdout).toContain('Summary: 3 passed, 0 failed, 0 skipped');
  });
});
