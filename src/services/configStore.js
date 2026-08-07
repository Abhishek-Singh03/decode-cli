/**
 * src/services/configStore.js
 * Reads and writes DeCode's config store.
 *
 * Security model (ARCHITECTURE.md "Data Model" + AGENTS.md rule 3):
 *  - decode.config.json holds only metadata and *references* (the provider
 *    name and the env var that carries the real key). It contains no secrets.
 *  - Actual API keys / tokens are written to a local `.env` (gitignored), so
 *    credentials are never stored in plaintext in the repo and never committed.
 *
 * Paths resolve relative to `cwd` (default: process.cwd()) so the store is
 * testable against temporary directories and stays project-local.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const CONFIG_FILE_NAME = 'decode.config.json';
export const ENV_FILE_NAME = '.env';

export const ENV_LLM_KEY = 'LLM_PROVIDER_API_KEY';
export const ENV_GITHUB_TOKEN = 'GITHUB_TOKEN';

function defaultConfig() {
  return {
    llm: { provider: null, apiKeyRef: ENV_LLM_KEY },
    github: { tokenRef: ENV_GITHUB_TOKEN },
    routes: [],
  };
}

function resolveBase({ cwd } = {}) {
  return cwd || process.cwd();
}

export function getConfigPath(opts = {}) {
  return path.join(resolveBase(opts), CONFIG_FILE_NAME);
}

export function getEnvPath(opts = {}) {
  return path.join(resolveBase(opts), ENV_FILE_NAME);
}

function mergeConfig(parsed) {
  const defaults = defaultConfig();
  const merged = {
    ...defaults,
    ...(parsed || {}),
    llm: { ...defaults.llm, ...((parsed && parsed.llm) || {}) },
    github: { ...defaults.github, ...((parsed && parsed.github) || {}) },
  };
  merged.routes = Array.isArray(merged.routes) ? merged.routes : [];
  return merged;
}

export function readConfig(opts = {}) {
  const file = getConfigPath(opts);
  if (!existsSync(file)) return defaultConfig();
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Could not parse config file at ${file}: ${err.message}`);
  }
  return mergeConfig(parsed);
}

export function writeConfig(config, opts = {}) {
  const file = getConfigPath(opts);
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

// ---- .env helpers (dependency-free, so we don't need dotenv) ----

export function parseEnv(content) {
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    let key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function readEnv(opts = {}) {
  const envPath = getEnvPath(opts);
  if (!existsSync(envPath)) return {};
  return parseEnv(readFileSync(envPath, 'utf8'));
}

function writeEnv(env, opts = {}) {
  const envPath = getEnvPath(opts);
  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`);
  writeFileSync(envPath, lines.length ? `${lines.join('\n')}\n` : '', 'utf8');
}

function setEnvEntries(entries, opts = {}) {
  const env = readEnv(opts);
  for (const [key, value] of Object.entries(entries)) env[key] = value;
  writeEnv(env, opts);
}

function unsetEnvKeys(keys, opts = {}) {
  const envPath = getEnvPath(opts);
  if (!existsSync(envPath)) return;
  const env = readEnv(opts);
  for (const key of keys) delete env[key];
  writeEnv(env, opts);
}

// ---- connection lifecycle ----

/**
 * Persists a connection. Secrets go to .env; provider metadata + env-var
 * references go to decode.config.json. Returns the resulting connection.
 */
export function saveConnection({ llmProvider, llmApiKey, githubToken } = {}, opts = {}) {
  const envEntries = {};
  if (llmApiKey) envEntries[ENV_LLM_KEY] = llmApiKey;
  if (githubToken) envEntries[ENV_GITHUB_TOKEN] = githubToken;
  if (Object.keys(envEntries).length > 0) setEnvEntries(envEntries, opts);

  const config = readConfig(opts);
  if (llmProvider) config.llm.provider = llmProvider;
  config.updatedAt = new Date().toISOString();
  writeConfig(config, opts);

  return getConnection(opts);
}

/** Removes all stored credentials (secrets from .env + connection metadata). */
export function disconnect(opts = {}) {
  unsetEnvKeys([ENV_LLM_KEY, ENV_GITHUB_TOKEN], opts);
  const config = readConfig(opts);
  config.llm.provider = null;
  config.updatedAt = new Date().toISOString();
  writeConfig(config, opts);
}

/** Reports current connection state. Secrets are read fresh from .env. */
export function getConnection(opts = {}) {
  const config = readConfig(opts);
  const env = readEnv(opts);
  const llmConfigured = Boolean(env[ENV_LLM_KEY]);
  const githubConfigured = Boolean(env[ENV_GITHUB_TOKEN]);
  return {
    llmProvider: config.llm.provider,
    llmConfigured,
    githubConfigured,
    connected: llmConfigured || githubConfigured,
    configPath: getConfigPath(opts),
  };
}

export function isConfigured(opts = {}) {
  return getConnection(opts).connected;
}

// ---- configured API routes ----

export function getRoutes(opts = {}) {
  return [...readConfig(opts).routes];
}

/**
 * Adds a route to the configured list. Returns the updated routes.
 * Routes are plain URLs (not secrets), so they live in the config file.
 */
export function addRoute(url, opts = {}) {
  const clean = String(url).trim();
  if (!clean) throw new Error('Route URL is required.');

  let parsed;
  try {
    parsed = new URL(clean);
  } catch {
    throw new Error(`Invalid route URL: ${clean}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Route URL must use http or https.');
  }

  const config = readConfig(opts);
  if (config.routes.includes(clean)) {
    throw new Error(`Route already configured: ${clean}`);
  }
  config.routes.push(clean);
  config.updatedAt = new Date().toISOString();
  writeConfig(config, opts);
  return getRoutes(opts);
}

/** Removes a route from the configured list. Returns the updated routes. */
export function removeRoute(url, opts = {}) {
  const clean = String(url).trim();
  const config = readConfig(opts);
  const index = config.routes.indexOf(clean);
  if (index === -1) throw new Error(`Route not found: ${clean}`);
  config.routes.splice(index, 1);
  config.updatedAt = new Date().toISOString();
  writeConfig(config, opts);
  return getRoutes(opts);
}

// ---- config value management (`decode config list / set / reset`) ----

/** Key segments that signal a credential — these belong in .env, not the config file. */
const SECRET_HINTS = /key|token|secret|password|credential/i;

const ALLOWED_ROOTS = new Set(['llm', 'github']);

/**
 * Sets a non-secret config value by dotted path (e.g. "llm.provider").
 * Rejects secret-looking keys and any root outside llm/github so credentials
 * can never leak into decode.config.json (AGENTS.md rule 3).
 */
export function setConfigKey(key, value, opts = {}) {
  const cleanKey = String(key || '').trim();
  const cleanValue = String(value ?? '').trim();
  if (!cleanKey || !cleanValue) throw new Error('Usage: decode config set <key> <value>');

  const segments = cleanKey.split('.').map((s) => s.trim()).filter(Boolean);
  const root = segments[0];
  if (!ALLOWED_ROOTS.has(root)) {
    throw new Error(`Invalid config key "${cleanKey}" — only llm.* and github.* paths are settable.`);
  }
  if (SECRET_HINTS.test(cleanKey)) {
    throw new Error(
      `"${cleanKey}" looks like a credential. Credentials are managed by \`decode init\` / \`decode connect\` and stored in .env.`,
    );
  }
  if (segments.length < 2) {
    throw new Error(`Invalid config key "${cleanKey}" — expected a dotted path like "llm.provider".`);
  }

  const config = readConfig(opts);
  let target = config[root];
  for (let i = 1; i < segments.length - 1; i += 1) {
    if (target[segments[i]] == null || typeof target[segments[i]] !== 'object') {
      target[segments[i]] = {};
    }
    target = target[segments[i]];
  }
  target[segments[segments.length - 1]] = cleanValue;

  config.updatedAt = new Date().toISOString();
  writeConfig(config, opts);
  return config;
}

/**
 * Resets the config file to defaults (metadata + routes cleared). Credentials
 * in .env are intentionally untouched — `decode disconnect` removes those.
 */
export function resetConfig(opts = {}) {
  const config = defaultConfig();
  config.updatedAt = new Date().toISOString();
  writeConfig(config, opts);
  return config;
}

/** A clean, secret-free summary of the config for display / --json. */
export function getConfigSummary(opts = {}) {
  const config = readConfig(opts);
  const env = readEnv(opts);
  return {
    llm: {
      provider: config.llm.provider,
      apiKeyRef: config.llm.apiKeyRef,
      configured: Boolean(env[ENV_LLM_KEY]),
    },
    github: {
      tokenRef: config.github.tokenRef,
      configured: Boolean(env[ENV_GITHUB_TOKEN]),
    },
    routes: [...config.routes],
    configPath: getConfigPath(opts),
    updatedAt: config.updatedAt || null,
  };
}
// ---- last audit result (`decode status` reads this) ----
/**
 * Returns the most recent audit summary saved by `decode audit`, or null if
 * an audit has never run. Stored under `config.audit` alongside the other
 * project-local state (e.g. `updatedAt`).
 * @param {{ cwd?: string }} opts
 * @returns {null | { ranAt: string, total: number, passed: number, failed: number, skipped: number, ok: boolean }}
 */
export function getLastAudit(opts = {}) {
  const config = readConfig(opts);
  return config.audit || null;
}

/**
 * Persists the summary of a completed audit run so `decode status` can report
 * it. `ranAt` is stamped here. `decode config reset` clears it with the rest
 * of the config.
 * @param {{ total: number, passed: number, failed: number, skipped: number, ok: boolean }} summary
 * @param {{ cwd?: string }} opts
 */
export function saveLastAudit(summary, opts = {}) {
  const config = readConfig(opts);
  config.audit = { ...summary, ranAt: new Date().toISOString() };
  config.updatedAt = new Date().toISOString();
  writeConfig(config, opts);
  return config.audit;
}
