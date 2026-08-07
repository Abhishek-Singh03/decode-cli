/**
 * test/unit/routeDetector.test.js
 * Unit tests for Express route detection against a tiny fixture app.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  detectRoutes,
  detectRoutingFramework,
  isDynamicPath,
  resolveBackendBaseUrl,
  scanRoutes,
} from '../../src/services/routeDetector.js';

let baseDir;

const EXPRESS_APP = `const express = require('express');
const app = express();

app.get('/health', (req, res) => res.json({ ok: true }));
app.post('/tasks', (req, res) => res.json({ id: 1 }));
app.get('/tasks/:id', (req, res) => res.json({ id: req.params.id }));
app.put('/users/:id', (req, res) => res.json({ ok: true }));
app.delete('/users/:id', (req, res) => res.json({ ok: true }));
`;

function writeFixture({ appSource = EXPRESS_APP, express = true } = {}) {
  baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-routes-'));
  const deps = express ? { dependencies: { express: '^4.19.0' } } : { dependencies: {} };
  fs.writeFileSync(path.join(baseDir, 'package.json'), JSON.stringify({ name: 'fixture', ...deps }));
  fs.mkdirSync(path.join(baseDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(baseDir, 'src', 'app.js'), appSource);
}

beforeEach(() => {
  baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-routes-tmp-'));
  process.env.DECODE_GLOBAL_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-global-routes-'));
});

afterEach(() => {
  delete process.env.DECODE_GLOBAL_CONFIG_DIR;
  fs.rmSync(baseDir, { recursive: true, force: true });
});

describe('detectRoutingFramework', () => {
  it('returns express when express is in dependencies', () => {
    writeFixture();
    expect(detectRoutingFramework({ cwd: baseDir })).toBe('express');
  });

  it('returns null for projects without a supported framework', () => {
    writeFixture({ express: false });
    expect(detectRoutingFramework({ cwd: baseDir })).toBeNull();
  });
});

describe('detectRoutes', () => {
  it('extracts app.get/post/put/delete/patch routes with source + flags', () => {
    writeFixture();
    const { framework, routes } = detectRoutes({ cwd: baseDir });

    expect(framework).toBe('express');
    expect(routes).toHaveLength(5);
    expect(routes[0]).toMatchObject({ method: 'get', path: '/health', file: 'src/app.js', line: 4, hasParams: false });
    expect(routes.map((r) => r.method)).toEqual(['get', 'post', 'get', 'put', 'delete']);
    expect(routes[2]).toMatchObject({ method: 'get', path: '/tasks/:id', hasParams: true });
    expect(routes[1].hasParams).toBe(false);
  });

  it('flags dynamic routes with hasParams instead of guessing test data', () => {
    writeFixture();
    const { routes } = detectRoutes({ cwd: baseDir });
    expect(routes.filter((r) => r.hasParams).map((r) => r.path)).toEqual(['/tasks/:id', '/users/:id', '/users/:id']);
  });

  it('returns zero routes for source with no route declarations', () => {
    writeFixture({ appSource: 'module.exports = {};\n' });
    const { framework, routes } = detectRoutes({ cwd: baseDir });
    expect(framework).toBe('express');
    expect(routes).toEqual([]);
  });
});

describe('isDynamicPath', () => {
  it('detects colon segments', () => {
    expect(isDynamicPath('/tasks/:id')).toBe(true);
    expect(isDynamicPath('/health')).toBe(false);
  });
});

describe('scanRoutes caching', () => {
  it('caches routes and reuses them while sources are unchanged', () => {
    writeFixture();
    const first = scanRoutes({ cwd: baseDir });
    expect(first.cached).toBe(false);
    expect(first.routes).toHaveLength(5);

    const second = scanRoutes({ cwd: baseDir });
    expect(second.cached).toBe(true);
    expect(second.routes).toEqual(first.routes);

    // --refresh always rescans
    const refreshed = scanRoutes({ cwd: baseDir, refresh: true });
    expect(refreshed.cached).toBe(false);
  });

  it('rescans automatically when the source changes (fingerprint mismatch)', () => {
    writeFixture();
    const first = scanRoutes({ cwd: baseDir });
    expect(first.routes).toHaveLength(5);

    const appPath = path.join(baseDir, 'src', 'app.js');
    fs.appendFileSync(appPath, "\napp.get('/new', (req, res) => res.json({}));\n");
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(appPath, future, future);

    const second = scanRoutes({ cwd: baseDir });
    expect(second.cached).toBe(false);
    expect(second.routes).toHaveLength(6);
    expect(second.routes.some((r) => r.path === '/new')).toBe(true);
  });
});

describe('resolveBackendBaseUrl', () => {
  it('prioritizes --base-url', async () => {
    const base = await resolveBackendBaseUrl({ baseUrl: 'http://example.test:9999/' });
    expect(base).toBe('http://example.test:9999');
  });

  it('uses PORT from .env when present', async () => {
    writeFixture();
    fs.writeFileSync(path.join(baseDir, '.env'), 'PORT=43123\n', 'utf8');
    const base = await resolveBackendBaseUrl({ cwd: baseDir });
    expect(base).toBe('http://127.0.0.1:43123');
  });

  it('returns null when no default port is reachable', async () => {
    writeFixture();
    const neverReachable = async () => {
      throw new Error('refused');
    };
    const base = await resolveBackendBaseUrl({ cwd: baseDir, fetchImpl: neverReachable });
    expect(base).toBeNull();
  });
});