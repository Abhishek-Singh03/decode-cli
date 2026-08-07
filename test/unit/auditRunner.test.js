/**
 * test/unit/auditRunner.test.js
 * Unit tests for the composite audit runner. The API check reaches a local
 * http server (hermetic), while docs and repo checks run against a throwaway
 * temp directory. Covers the status model: pass / fail / skipped.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { runAudit } from '../../src/services/auditRunner.js';
import { writeConfig } from '../../src/services/configStore.js';

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
    if (req.url === '/fail') {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end('{"error":"boom"}');
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
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-audit-unit-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function git(args) {
  return execFileSync('git', args, { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** Makes the temp dir a healthy repo: origin remote + a recent commit. */
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

function configureRoutes(routes) {
  writeConfig({ routes }, { cwd: tmp });
}

describe('runAudit', () => {
  it('passes all three checks when everything is healthy', async () => {
    makeHealthyRepo();
    addFreshDocs();
    configureRoutes([`${baseUrl}/ok`]);

    const result = await runAudit({ cwd: tmp });
    expect(result.api.status).toBe('pass');
    expect(result.docs.status).toBe('pass');
    expect(result.repo.status).toBe('pass');
    expect(result.summary).toEqual({ total: 3, passed: 3, failed: 0, skipped: 0, ok: true });
  });

  it('fails the audit when an API route fails', async () => {
    makeHealthyRepo();
    addFreshDocs();
    configureRoutes([`${baseUrl}/fail`]);

    const result = await runAudit({ cwd: tmp });
    expect(result.api.status).toBe('fail');
    expect(result.api.detail).toContain('1 of 1');
    expect(result.docs.status).toBe('pass');
    expect(result.repo.status).toBe('pass');
    expect(result.summary.ok).toBe(false);
    expect(result.summary.failed).toBe(1);
  });

  it('skips checks that are not applicable and still reports the docs failure', async () => {
    const result = await runAudit({ cwd: tmp });
    expect(result.api.status).toBe('skipped');
    expect(result.api.detail).toContain('no routes configured');
    expect(result.docs.status).toBe('fail');
    expect(result.repo.status).toBe('skipped');
    expect(result.summary.failed).toBe(1);
    expect(result.summary.skipped).toBe(2);
    expect(result.summary.ok).toBe(false);
  });

  it('fails the docs check when no documentation exists', async () => {
    makeHealthyRepo();
    const result = await runAudit({ cwd: tmp });
    expect(result.docs.status).toBe('fail');
    expect(result.docs.detail).toBe('no documentation found');
    expect(result.repo.status).toBe('pass');
    expect(result.summary.ok).toBe(false);
  });
});
