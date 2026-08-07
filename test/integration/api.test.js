/**
 * test/integration/api.test.js
 * `decode api` end-to-end for auto-detected routes. The CLI child (execa, temp
 * cwd) runs against a fixture Express backend whose source lives in the temp
 * project, and reaches a local http server on a random port (via PORT in .env) —
 * hermetic, no real network.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../bin/decode.js', import.meta.url));

const EXPRESS_APP = `const express = require('express');
const app = express();
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/fail', (req, res) => res.json({ error: 'boom' }));
app.get('/tasks/:id', (req, res) => res.json({ id: req.params.id }));
`;

let server;
let port;
let tmp;
let globalDir;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/health') {
      res.writeHead(200);
      res.end('{"ok":true}');
      return;
    }
    if (req.url === '/fail') {
      res.writeHead(500);
      res.end('{"error":"boom"}');
      return;
    }
    res.writeHead(404);
    res.end('{"error":"not found"}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});

afterAll(() => {
  server.closeAllConnections?.();
  return new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-api-it-'));
  globalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-global-it-'));
  process.env.DECODE_GLOBAL_CONFIG_DIR = globalDir;
  fs.writeFileSync(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'api-fixture', dependencies: { express: '^4.19.0' } }),
  );
  fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'src', 'app.js'), EXPRESS_APP);
});

afterEach(() => {
  delete process.env.DECODE_GLOBAL_CONFIG_DIR;
  fs.rmSync(globalDir, { recursive: true, force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
});

function run(args, opts = {}) {
  return execa(process.execPath, [CLI, ...args], { cwd: tmp, reject: false, ...opts });
}

function pointAtTestServer() {
  fs.writeFileSync(path.join(tmp, '.env'), `PORT=${port}\n`, 'utf8');
}

describe('decode api list (auto-detection)', () => {
  it('scans the fixture Express source and lists detected routes', async () => {
    const list = await run(['api', 'list']);

    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain('express');
    expect(list.stdout).toContain('/health');
    expect(list.stdout).toContain('/fail');
    expect(list.stdout).toContain('/tasks/:id');
    expect(list.stdout.toLowerCase()).not.toContain('api add');
  });

  it('flags dynamic-segment routes instead of pretending they are static', async () => {
    const list = await run(['api', 'list']);
    expect(list.stdout).toContain('⚠ has params');
  });

  it('caches the scan and reuses it on a repeated run', async () => {
    await run(['api', 'list']);
    const second = await run(['api', 'list']);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain('cached');
  });

  it('emits a machine-readable scan with --json', async () => {
    const list = await run(['api', 'list', '--json']);
    expect(list.exitCode).toBe(0);

    const parsed = JSON.parse(list.stdout);
    expect(parsed.framework).toBe('express');
    expect(parsed.routes).toHaveLength(3);
    expect(parsed.routes.map((r) => r.path)).toEqual(['/health', '/fail', '/tasks/:id']);
    expect(parsed.routes[2].hasParams).toBe(true);
  });

  it('rescans when the source changes', async () => {
    await run(['api', 'list']);
    const appPath = path.join(tmp, 'src', 'app.js');
    fs.appendFileSync(appPath, "\napp.get('/new', (req, res) => res.json({}));\n");
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(appPath, future, future);

    const list = await run(['api', 'list']);
    expect(list.stdout).toContain('/new');
  });

  it('errors on unknown api subcommands', async () => {
    const bogus = await run(['api', 'bogus']);
    expect(bogus.exitCode).toBe(1);
    expect(`${bogus.stdout} ${bogus.stderr}`.toLowerCase()).toContain('unknown command');
  });
});

describe('decode api check (live backend)', () => {
  it('checks detected routes against a running backend, skipping dynamic params', async () => {
    pointAtTestServer();
    const check = await run(['api', 'check']);

    expect(check.exitCode).toBe(1); // /fail is a 500
    expect(check.stdout.toUpperCase()).toContain('PASS');
    expect(check.stdout.toUpperCase()).toContain('FAIL');
    expect(check.stdout).toContain('skipped — dynamic param, no test data');
  });

  it('--json reports per-route results including skipped dynamic params', async () => {
    pointAtTestServer();
    const check = await run(['api', 'check', '--json']);
    expect(check.exitCode).toBe(1);

    const parsed = JSON.parse(check.stdout);
    expect(parsed.summary).toMatchObject({ total: 3, passed: 1, failed: 1, skipped: 1 });
    const skipped = parsed.results.find((r) => r.skipped);
    expect(skipped.path).toBe('/tasks/:id');
    expect(skipped.diagnoses.join(' ')).toContain('dynamic param');
  });

  it('filters to a matching path with positional args', async () => {
    pointAtTestServer();
    const check = await run(['api', 'check', '/health']);
    expect(check.exitCode).toBe(0);
    expect(check.stdout.toUpperCase()).toContain('PASS');
  });

  it('fails with a friendly message when the backend is unreachable', async () => {
    fs.writeFileSync(path.join(tmp, '.env'), 'PORT=1\n'); // almost certainly closed
    const check = await run(['api', 'check']);
    expect(check.exitCode).toBe(1);
    expect(`${check.stdout} ${check.stderr}`).toContain('Backend not reachable at http://127.0.0.1:1');
  });
});