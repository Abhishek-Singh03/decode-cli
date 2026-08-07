/**
 * src/services/routeDetector.js
 * Auto-detects a project's backend API routes from source, replacing the old
 * manual `api add <url>` flow. Powers `decode api list` / `decode api check`
 * (and feeds the composite audit).
 *
 * Scope today: Express only. Framework is inferred from package.json
 * dependencies; routes are extracted with a light regex over the project's
 * source files. Dynamic segments (e.g. /tasks/:id) are FLAGGED — never
 * silently skipped or blindly requested against test data.
 *
 * File walking is reused from projectScanner.listSourceFiles so traversal
 * rules stay in one place. Scan results are cached in the project-local config
 * (`routeCache`) and invalidated by a fingerprint of the scanned sources'
 * mtimes; `--refresh` forces a rescan.
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { getRouteCache, readEnv, saveRouteCache } from './configStore.js';
import { listSourceFiles } from './projectScanner.js';

/** Matches `app.get('/path', ...)`, `router.post("...")`, etc. */
const ROUTE_RE = /\b(app|router)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`]/g;

/** Common dev-server ports probed when no PORT is set in .env. */
const DEFAULT_PORTS = [3000, 8080, 5000];

const BASE_PROBE_TIMEOUT_MS = 1500;

/**
 * Detects the backend framework from package.json dependencies.
 * @returns {'express' | null}
 */
export function detectRoutingFramework({ cwd } = {}) {
  const root = cwd || process.cwd();
  const pkgPath = path.join(root, 'package.json');
  let pkg = null;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return null; // missing or unparsable package.json → not a detected backend
  }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  return deps.express ? 'express' : null;
}

/**
 * Extracts routes from the project's source files.
 * @returns {{ framework: string|null, routes: Array<{ method: string, path: string, file: string, line: number, hasParams: boolean }> }}
 */
export function detectRoutes({ cwd } = {}) {
  const framework = detectRoutingFramework({ cwd });
  const root = cwd || process.cwd();
  const routes = [];

  for (const relFile of listSourceFiles({ cwd })) {
    const fullPath = path.join(root, relFile);
    let content;
    try {
      content = readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }
    ROUTE_RE.lastIndex = 0;
    let match;
    while ((match = ROUTE_RE.exec(content)) !== null) {
      routes.push({
        method: match[2].toLowerCase(),
        path: match[3],
        file: relFile,
        line: lineAt(content, match.index),
        hasParams: isDynamicPath(match[3]),
      });
    }
  }

  routes.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
  return { framework, routes };
}

/** Returns the 1-based line number for a character index within `content`. */
function lineAt(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === '\n') line += 1;
  }
  return line;
}

/** Dynamic segments are anything containing a colon (e.g. /tasks/:id). */
export function isDynamicPath(requestPath) {
  return requestPath.includes(':');
}

/**
 * Fingerprint for cache invalidation: mtimes of package.json, package-lock.json
 * and every scanned source file, joined. Any edit invalidates the cache.
 */
export function computeScanFingerprint({ cwd } = {}) {
  const root = cwd || process.cwd();
  const sourceFiles = listSourceFiles({ cwd }).map((rel) => path.join(root, rel));
  const files = [path.join(root, 'package.json'), path.join(root, 'package-lock.json'), ...sourceFiles];
  return files
    .map((file) => {
      const rel = path.relative(root, file);
      try {
        return `${rel}:${statSync(file).mtimeMs}`;
      } catch {
        return `${rel}:missing`;
      }
    })
    .join(',');
}

/**
 * Scans routes with caching. A repeat call with an unchanged source fingerprint
 * returns the cached result; `--refresh` always rescans and re-saves. Returns
 * the scan result plus a `cached` flag.
 */
export function scanRoutes({ cwd, refresh = false } = {}) {
  const fingerprint = computeScanFingerprint({ cwd });
  const cached = getRouteCache({ cwd });

  if (!refresh && cached && cached.fingerprint === fingerprint) {
    return { ...cached, cached: true };
  }

  const detected = detectRoutes({ cwd });
  const result = { ...detected, fingerprint, scannedAt: new Date().toISOString() };
  saveRouteCache(result, { cwd });
  return { ...result, cached: false };
}

/**
 * Resolves the backend base URL for `api check`:
 *   1. an explicit `--base-url`,
 *   2. the PORT variable in the local/global .env,
 *   3. a reachable common default port (3000, 8080, 5000).
 * Returns null when none could be determined.
 */
export async function resolveBackendBaseUrl({ cwd, baseUrl } = {}, options = {}) {
  const { fetchImpl = fetch } = options;
  if (baseUrl) return String(baseUrl).replace(/\/+$/, '');

  const env = readEnv({ cwd });
  if (env.PORT) return `http://127.0.0.1:${env.PORT}`;

  for (const port of DEFAULT_PORTS) {
    const candidate = `http://127.0.0.1:${port}`;
    if (await isBackendReachable(candidate, { fetchImpl })) return candidate;
  }
  return null;
}

/** True when the server answers with ANY http status (even 404 means it's up). */
export async function isBackendReachable(url, { fetchImpl = fetch, timeoutMs = BASE_PROBE_TIMEOUT_MS } = {}) {
  try {
    const res = await fetchImpl(url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
    return res.status > 0;
  } catch {
    return false; // network refused / timeout — not reachable
  }
}