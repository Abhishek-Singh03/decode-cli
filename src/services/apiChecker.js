/**
 * src/services/apiChecker.js
 * The "API Contract Verifier" skill (see AGENTS_AND_SKILLS.md).
 *
 * Given a route (and optionally an OpenAPI spec), fires the request,
 * measures response time, and compares status + response shape against
 * expectations, producing a plain-English diagnosis per failure.
 *
 * Scope & access: network access to the target API only; no filesystem or
 * repo access beyond optionally reading a local --spec file. No data is ever
 * fabricated — network errors/timeouts report clearly (AGENTS.md rule 9).
 *
 * Pass/fail model:
 *  - Without a spec, a route fails on non-2xx status, timeout, or network
 *    error. Content-type is treated leniently: a 2xx text/plain response
 *    passes; a response whose content-type claims JSON but whose body won't
 *    parse fails as an unambiguous breakage.
 *  - With a spec, response shape is validated shallowly (see validateSchema)
 *    and any mismatch is a hard failure.
 */
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

import { API_CHECK_TIMEOUT_MS } from '../constants.js';

/** Depth cap so a pathological/cyclic schema can't recurse forever. */
const MAX_SCHEMA_DEPTH = 6;

/**
 * Loads an OpenAPI spec from a file path or an http(s) URL.
 * @returns {Promise<object>} parsed spec object
 */
export async function loadSpec(source) {
  const text = /^https?:\/\//i.test(source)
    ? await (await fetch(source)).text()
    : readFileSync(source, 'utf8');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Could not parse OpenAPI spec: ${err.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.paths) {
    throw new Error('OpenAPI spec must contain a "paths" object.');
  }
  return parsed;
}

/**
 * Checks a single route. Never rejects — failures are reported in the result.
 * @param {string} route
 * @param {{ spec?: object|null, timeoutMs?: number, fetchImpl?: typeof fetch }} options
 * @returns {Promise<{route: string, status: number|null, responseTimeMs: number, ok: boolean, diagnoses: string[]}>}
 */
export async function checkRoute(route, options = {}) {
  const { spec = null, timeoutMs = API_CHECK_TIMEOUT_MS, fetchImpl = fetch } = options;
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const result = { route, status: null, responseTimeMs: 0, ok: false, diagnoses: [] };

  try {
    const res = await fetchImpl(route, { signal: controller.signal });
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    result.responseTimeMs = Math.round(performance.now() - started);
    result.status = res.status;

    if (res.status >= 200 && res.status < 300) {
      let body = null;
      let bodyParseFailed = false;
      if (isJsonContentType(contentType) && !isBodylessStatus(res.status) && text.trim() !== '') {
        try {
          body = JSON.parse(text);
        } catch {
          bodyParseFailed = true;
          result.diagnoses.push('response body is not valid JSON');
        }
      }
      if (spec && !bodyParseFailed) {
        result.diagnoses.push(...validateAgainstSpec({ route, status: res.status, body, spec }));
      }
    } else {
      result.diagnoses.push(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`);
    }
  } catch (err) {
    result.responseTimeMs = Math.round(performance.now() - started);
    if (err.name === 'AbortError') {
      result.diagnoses.push(`request timed out after ${timeoutMs}ms`);
    } else {
      result.diagnoses.push(`network error: ${err.message}`);
    }
  } finally {
    clearTimeout(timer);
  }

  result.ok = result.diagnoses.length === 0;
  return result;
}

/** Checks many routes in parallel. All errors are handled inside checkRoute. */
export function checkRoutes(routes, options = {}) {
  return Promise.all(routes.map((route) => checkRoute(route, options)));
}

export function summarize(results) {
  const failed = results.filter((r) => !r.ok).length;
  return { total: results.length, passed: results.length - failed, failed, ok: failed === 0 };
}

function isJsonContentType(contentType) {
  return /json/i.test(contentType);
}

function isBodylessStatus(status) {
  return status === 204 || status === 205 || status === 304;
}

// ---- OpenAPI response-shape validation (lightweight, hand-rolled) ----

/**
 * Compares a live response against the spec's path/operation for the route.
 * Produces plain-English diagnoses; the route being absent from the spec
 * counts as a (failing) diagnosis rather than silent pass.
 */
function validateAgainstSpec({ route, status, body, spec }) {
  const diagnoses = [];

  let pathname;
  try {
    pathname = new URL(route).pathname;
  } catch {
    return ['invalid route URL'];
  }

  const pathItem = spec.paths[pathname];
  if (!pathItem) {
    diagnoses.push(`no OpenAPI definition found for path "${pathname}"`);
    return diagnoses;
  }

  const operation = pathItem.get || pathItem.post || Object.values(pathItem).find((v) => v && v.responses);
  const response = operation && operation.responses
    ? operation.responses[String(status)] || operation.responses.default
    : undefined;
  if (!response) return diagnoses;

  const content = response.content && response.content['application/json'];
  if (!content || !content.schema) return diagnoses;

  if (body === null) {
    diagnoses.push(`expected JSON response body per OpenAPI spec for ${status}, none received`);
    return diagnoses;
  }

  diagnoses.push(...validateSchema(body, content.schema, `response (${status})`, spec));
  return diagnoses;
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesType(value, type) {
  switch (type) {
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number';
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true; // unknown type — don't fail on it
  }
}

function lookupRef(spec, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#')) return null; // external refs unsupported
  const parts = ref.slice(2).split('/');
  let node = spec;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return null;
    node = node[part];
  }
  return node && typeof node === 'object' ? node : null;
}

/**
 * Shallow response-schema validation. Deliberately NOT full OpenAPI/JSON
 * Schema compliance: no external $ref, no oneOf/anyOf/allOf/not, no format/
 * minimum/pattern; depth is capped at MAX_SCHEMA_DEPTH.
 */
function validateSchema(value, schema, path, spec, seen = new Set(), depth = 0) {
  if (depth > MAX_SCHEMA_DEPTH) return [];
  if (!schema || typeof schema !== 'object') return [];

  let node = schema;
  if (node.$ref) {
    if (seen.has(node.$ref)) return []; // cycle guard
    seen = new Set(seen).add(node.$ref);
    const resolved = lookupRef(spec, node.$ref);
    if (!resolved) return []; // unresolvable ref — treat as opaque
    node = resolved;
  }

  const diagnoses = [];
  const actualType = typeOf(value);
  const expectedTypes = Array.isArray(node.type) ? node.type : node.type ? [node.type] : [];
  const typeMatches =
    expectedTypes.length === 0 || expectedTypes.some((t) => matchesType(value, t));

  if (!typeMatches && !(node.nullable === true && value === null)) {
    diagnoses.push(`expected ${path} to be of type ${node.type}, received ${actualType}`);
    return diagnoses;
  }

  if (Array.isArray(node.enum) && !node.enum.includes(value)) {
    diagnoses.push(`expected ${path} to be one of [${node.enum.join(', ')}], received ${JSON.stringify(value)}`);
  }

  if (actualType === 'object' && value !== null) {
    for (const field of node.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, field)) {
        diagnoses.push(`missing required field "${field}" in ${path}`);
      }
    }
    for (const [key, propSchema] of Object.entries(node.properties || {})) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        diagnoses.push(...validateSchema(value[key], propSchema, `${path}.${key}`, spec, seen, depth + 1));
      }
    }
  }

  if (actualType === 'array' && Array.isArray(value)) {
    value.forEach((item, i) => {
      diagnoses.push(...validateSchema(item, node.items, `${path}[${i}]`, spec, seen, depth + 1));
    });
  }

  return diagnoses;
}
