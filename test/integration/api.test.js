/**
 * test/integration/api.test.js
 * `decode api` end-to-end. The CLI child (execa, temp cwd) reaches a local
 * http server started in the test process on a random port — hermetic.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../bin/decode.js', import.meta.url));
const CONFIG_FILE = 'decode.config.json';

const userSchema = {
  type: 'object',
  required: ['id', 'name'],
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
  },
};

const SPEC = {
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: { responses: { 200: { description: 'ok', content: { 'application/json': { schema: userSchema } } } } },
    },
    '/users-wrong': {
      get: { responses: { 200: { description: 'ok', content: { 'application/json': { schema: userSchema } } } } },
    },
  },
};

let server;
let baseUrl;
let tmp;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    switch (req.url) {
      case '/ok':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
        break;
      case '/fail':
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end('{"error":"boom"}');
        break;
      case '/users':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"id":1,"name":"ada"}');
        break;
      case '/users-wrong':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"id":"nope","name":"ada"}');
        break;
      case '/spec':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(SPEC));
        break;
      default:
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end('{"error":"not found"}');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  server.closeAllConnections?.();
  return new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-api-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function run(args, opts = {}) {
  return execa(process.execPath, [CLI, ...args], { cwd: tmp, reject: false, ...opts });
}

describe('decode api', () => {
  it('adds and lists a route, storing it in the config file (not .env)', async () => {
    const add = await run(['api', 'add', `${baseUrl}/ok`]);
    expect(add.exitCode).toBe(0);
    expect(add.stdout.toLowerCase()).toContain('added');

    const list = await run(['api', 'list']);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain(`${baseUrl}/ok`);

    const config = fs.readFileSync(path.join(tmp, CONFIG_FILE), 'utf8');
    expect(config).toContain(`${baseUrl}/ok`);
    expect(fs.existsSync(path.join(tmp, '.env'))).toBe(false);
  });

  it('checks a configured healthy route and exits 0', async () => {
    await run(['api', 'add', `${baseUrl}/ok`]);
    const check = await run(['api', 'check']);
    expect(check.exitCode).toBe(0);
    expect(check.stdout.toUpperCase()).toContain('PASS');
  });

  it('checks routes passed as arguments without any configuration', async () => {
    const check = await run(['api', 'check', `${baseUrl}/ok`]);
    expect(check.exitCode).toBe(0);
    expect(check.stdout.toUpperCase()).toContain('PASS');
  });

  it('emits machine-readable JSON with --json', async () => {
    await run(['api', 'add', `${baseUrl}/ok`]);
    const check = await run(['api', 'check', '--json']);
    expect(check.exitCode).toBe(0);
    const parsed = JSON.parse(check.stdout);
    expect(parsed.summary.ok).toBe(true);
    expect(parsed.summary.total).toBe(1);
    expect(parsed.results[0].route).toBe(`${baseUrl}/ok`);
    expect(parsed.results[0].ok).toBe(true);
    expect(parsed.results[0].diagnoses).toEqual([]);
  });

  it('exits non-zero on a failing route while keeping stdout valid JSON', async () => {
    await run(['api', 'add', `${baseUrl}/fail`]);
    const check = await run(['api', 'check', '--json']);
    expect(check.exitCode).toBe(1);
    const parsed = JSON.parse(check.stdout);
    expect(parsed.summary.ok).toBe(false);
    expect(parsed.summary.failed).toBe(1);
    expect(parsed.results[0].ok).toBe(false);
    expect(parsed.results[0].diagnoses.length).toBeGreaterThan(0);
  });

  it('validates responses against a local OpenAPI spec file', async () => {
    const specPath = path.join(tmp, 'openapi.json');
    fs.writeFileSync(specPath, JSON.stringify(SPEC));

    await run(['api', 'add', `${baseUrl}/users`]);
    const ok = await run(['api', 'check', '--json', '--spec', specPath]);
    expect(ok.exitCode).toBe(0);
    expect(JSON.parse(ok.stdout).summary.ok).toBe(true);

    await run(['api', 'add', `${baseUrl}/users-wrong`]);
    const bad = await run(['api', 'check', '--json', '--spec', specPath]);
    expect(bad.exitCode).toBe(1);
    const parsed = JSON.parse(bad.stdout);
    const failure = parsed.results.find((r) => !r.ok);
    expect(failure).toBeDefined();
    expect(failure.diagnoses.join(' ')).toContain('integer');
  });

  it('exits 1 with a hint when no routes are configured or passed', async () => {
    const check = await run(['api', 'check']);
    expect(check.exitCode).toBe(1);
    expect(check.stderr.toLowerCase()).toContain('no routes');
  });

  it('removes a route and reflects it in list', async () => {
    await run(['api', 'add', `${baseUrl}/ok`]);
    const remove = await run(['api', 'remove', `${baseUrl}/ok`]);
    expect(remove.exitCode).toBe(0);
    expect(remove.stdout.toLowerCase()).toContain('removed');

    const list = await run(['api', 'list']);
    expect(list.exitCode).toBe(0);
    expect(list.stdout.toLowerCase()).toContain('no api routes configured');
  });

  it('fails when removing an unknown route', async () => {
    const remove = await run(['api', 'remove', `${baseUrl}/unknown`]);
    expect(remove.exitCode).toBe(1);
    expect(remove.stderr.toLowerCase()).toContain('not found');
  });

  it('fails when adding a duplicate route', async () => {
    await run(['api', 'add', `${baseUrl}/ok`]);
    const dup = await run(['api', 'add', `${baseUrl}/ok`]);
    expect(dup.exitCode).toBe(1);
    expect(dup.stderr.toLowerCase()).toContain('already configured');
  });

  it('shows group help for bare decode api and errors on unknown subcommands', async () => {
    const bare = await run(['api']);
    const bareOut = `${bare.stdout} ${bare.stderr}`.toLowerCase();
    expect(bareOut).toContain('check');
    expect(bareOut).toContain('list');

    const bogus = await run(['api', 'bogus']);
    expect(bogus.exitCode).toBe(1);
    expect(`${bogus.stdout} ${bogus.stderr}`.toLowerCase()).toContain('unknown command');
  });

  it('--ci prints plain PASS/FAIL lines with no spinner', async () => {
    await run(['api', 'add', `${baseUrl}/ok`]);
    const ci = await run(['api', 'check', '--ci']);
    expect(ci.exitCode).toBe(0);
    expect(ci.stdout.toUpperCase()).toContain('PASS');
    expect(ci.stdout).not.toContain('Checking');
  });
});
