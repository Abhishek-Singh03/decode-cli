/**
 * test/unit/apiChecker.test.js
 * Unit tests for the API Contract Verifier service — hermetic local http
 * server (random port), no external network.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { checkRoute, checkRoutes, loadSpec, summarize } from '../../src/services/apiChecker.js';

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
      case '/text':
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('OK');
        break;
      case '/badjson':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('this is not json');
        break;
      case '/slow':
        // deliberately never respond
        break;
      case '/users':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"id":1,"name":"ada"}');
        break;
      case '/users-wrong':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"id":"not-a-number","name":"ada"}');
        break;
      case '/spec':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(SPEC));
        break;
      case '/nocontent':
        res.writeHead(204);
        res.end();
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
  server.closeAllConnections?.(); // release the hanging /slow socket
  return new Promise((resolve) => server.close(resolve));
});

describe('apiChecker', () => {
  it('passes a healthy 2xx JSON route', async () => {
    const r = await checkRoute(`${baseUrl}/ok`);
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(typeof r.responseTimeMs).toBe('number');
    expect(r.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(r.diagnoses).toEqual([]);
  });

  it('fails a non-2xx route with the received status', async () => {
    const r = await checkRoute(`${baseUrl}/fail`);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(500);
    expect(r.diagnoses.join(' ')).toContain('HTTP 500');
  });

  it('reports a timeout as a hard failure', async () => {
    const r = await checkRoute(`${baseUrl}/slow`, { timeoutMs: 100 });
    expect(r.ok).toBe(false);
    expect(r.status).toBeNull();
    expect(r.diagnoses.join(' ')).toContain('timed out');
  });

  it('reports a network error without fabricating output', async () => {
    const r = await checkRoute('http://127.0.0.1:1/x', { timeoutMs: 500 });
    expect(r.ok).toBe(false);
    expect(r.status).toBeNull();
    expect(r.diagnoses.join(' ')).toContain('network error');
  });

  it('passes a 2xx text/plain response when no spec is given (leniency)', async () => {
    const r = await checkRoute(`${baseUrl}/text`);
    expect(r.ok).toBe(true);
    expect(r.diagnoses).toEqual([]);
  });

  it('fails when a JSON content-type response does not parse', async () => {
    const r = await checkRoute(`${baseUrl}/badjson`);
    expect(r.ok).toBe(false);
    expect(r.diagnoses.join(' ')).toContain('not valid JSON');
  });

  it('passes a 204 no-content response', async () => {
    const r = await checkRoute(`${baseUrl}/nocontent`);
    expect(r.ok).toBe(true);
    expect(r.status).toBe(204);
  });

  it('validates a matching response against an OpenAPI spec', async () => {
    const r = await checkRoute(`${baseUrl}/users`, { spec: SPEC });
    expect(r.ok).toBe(true);
    expect(r.diagnoses).toEqual([]);
  });

  it('diagnoses a type mismatch against the spec', async () => {
    const r = await checkRoute(`${baseUrl}/users-wrong`, { spec: SPEC });
    expect(r.ok).toBe(false);
    expect(r.diagnoses.join(' ')).toContain(
      'expected response (200).id to be of type integer, received string',
    );
  });

  it('flags a path that is not defined in the spec', async () => {
    const r = await checkRoute(`${baseUrl}/ok`, { spec: SPEC });
    expect(r.ok).toBe(false);
    expect(r.diagnoses.join(' ')).toContain('no OpenAPI definition found for path "/ok"');
  });

  it('loadSpec rejects a non-JSON file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-spec-'));
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, 'not json');
    await expect(loadSpec(file)).rejects.toThrow('Could not parse OpenAPI spec');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loadSpec accepts an http URL', async () => {
    const spec = await loadSpec(`${baseUrl}/spec`);
    expect(spec.paths['/users']).toBeDefined();
  });

  it('checkRoutes fans out and returns one result per route', async () => {
    const results = await checkRoutes([`${baseUrl}/ok`, `${baseUrl}/fail`]);
    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
  });

  it('summarize computes totals', () => {
    const results = [{ ok: true }, { ok: false }, { ok: true }];
    expect(summarize(results)).toEqual({ total: 3, passed: 2, failed: 1, ok: false });
    expect(summarize([{ ok: true }])).toEqual({ total: 1, passed: 1, failed: 0, ok: true });
  });
});
