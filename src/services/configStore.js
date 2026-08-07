/**
 * src/services/configStore.js
 * Reads and writes DeCode's config store — a two-tier model:
 *
 *   global  ~/.decode/config.json  (machine-wide, applies to every project)
 *   local   <project-root>/decode.config.json (optional; overrides global)
 *
 * Resolution rules:
 *  - `readConfig` returns the *effective* merged config: defaults ← global ←
 *    local, with local overriding global field-by-field (never file-at-lime).
 *  - The project root is found by walking up from the working directory to the
 *    nearest decode.config.json (mirrors how git finds .git) — so commands run
 *    from a subdirectory still resolve the right local config. When none exists
 *    the filesystem path is used so a brand-new project writes there.
 *  - `scope: 'local' | 'global'` on writes targets one tier only.
 *
 * Security model (ARCHITECTURE.md "Data Model" + AGENTS.md rule 3):
 *  - Any decode.config.json holds only metadata and *references* (the provider
 *    name + the env var that carries the real key). It contains no secrets.
 *  - Actual API keys / tokens are written to a `.env` (gitignored) beside the
 *    config: `~/.decode/.env` for global, `<project-root>/.env` for local.
 *    Local env entries override global entries key-by-key.
 *
 * Paths resolve relative to `cwd` (default: process.cwd()) so the store is
 * testable against temporary directories. `DECODE_GLOBAL_CONFIG_DIR` overrides
 * the global directory so tests can keep machine state out of the way.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CONFIG_FILE_NAME = 'decode.config.json';
export const ENV_FILE_NAME = '.env';

export const ENV_LLM_KEY = 'LLM_PROVIDER_API_KEY';
export const ENV_GITHUB_TOKEN = 'GITHUB_TOKEN';

export const SCOPE_LOCAL = 'local';
export const SCOPE_GLOBAL = 'global';

function defaultConfig() {
  return {
    llm: { provider: null, apiKeyRef: ENV_LLM_KEY },
    github: { tokenRef: ENV_GITHUB_TOKEN },
    routes: [],
  };
}

// ---- paths ----

/** Directory holding the machine-wide config. Overridable for hermetic tests. */
export function getGlobalConfigDir() {
  return process.env.DECODE_GLOBAL_CONFIG_DIR || path.join(os.homedir(), '.decode');
}

export function getGlobalConfigPath() {
  return path.join(getGlobalConfigDir(), CONFIG_FILE_NAME);
}

export function getGlobalEnvPath() {
  return path.join(getGlobalConfigDir(), ENV_FILE_NAME);
}

/**
 * Resolves the project-local root: walks upward from `cwd` to the nearest
 * decode.config.json so subdirectory invocations still find the project config
 * (mirrors how git walks up to .git). Falls back to `cwd` when no config file
 * exists anywhere up the tree, so a brand-new project's first write lands here.
 */
export function findProjectRoot({ cwd } = {}) {
  let dir = path.resolve(cwd || process.cwd());
  const globalDir = path.resolve(getGlobalConfigDir());
  for (;;) {
    if (existsSync(path.join(dir, CONFIG_FILE_NAME))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir || dir === globalDir) return path.resolve(cwd || process.cwd());
    dir = parent;
  }
}

function isGlobalScope(scope) {
  return scope === SCOPE_GLOBAL;
}

/** The config file path for a given scope + cwd. */
export function getConfigPath(opts = {}) {
  return isGlobalScope(opts.scope)
    ? getGlobalConfigPath()
    : path.join(findProjectRoot({ cwd: opts.cwd }), CONFIG_FILE_NAME);
}

/** The .env file path for a given scope + cwd. */
export function getEnvPath(opts = {}) {
  return isGlobalScope(opts.scope)
    ? getGlobalEnvPath()
    : path.join(findProjectRoot({ cwd: opts.cwd }), ENV_FILE_NAME);
}

// ---- filesystem helpers ----

function readJsonFile(file) {
  if (!existsSync(file)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Could not parse config file at ${file}: ${err.message}`);
  }
  return parsed;
}

function writeJsonFile(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Fills missing nested fields of a single scope's raw config. */
function normalizeConfig(raw) {
  if (!raw) return defaultConfig();
  return {
    ...defaultConfig(),
    ...raw,
    llm: { ...defaultConfig().llm, ...(raw.llm || {}) },
    github: { ...defaultConfig().github, ...(raw.github || {}) },
    routes: Array.isArray(raw.routes) ? raw.routes : [],
  };
}

/** Reads a single scope's raw config file (or null when absent). */
function readScopeConfig(scope, opts = {}) {
  return readJsonFile(getConfigPath({ ...opts, scope }));
}

/**
 * Merges raw global + local configs into the effective config. Merge is
 * field-by-field: a field that is EXPLICITLY PRESENT in the local raw file
 * wins over global; absent local fields fall through to global and then to
 * defaults. (This is why we merge from the raw shapes and never from the
 * default-filled normalized shape — `normalizeConfig` stamps `provider: null`,
 * which must not count as "explicitly set locally".)
 */
function mergeConfigs(globalRaw, localRaw) {
  const defaults = defaultConfig();
  const g = globalRaw || {};
  const l = localRaw || {};

  const llm = { ...defaults.llm, ...(g.llm || {}), ...(l.llm || {}) };
  const github = { ...defaults.github, ...(g.github || {}), ...(l.github || {}) };

  // Routes are a list — "local wins" means replace wholesale; only when the
  // local file doesn't define them at all do we fall through to global.
  const routes = Array.isArray(l.routes) ? l.routes : Array.isArray(g.routes) ? g.routes : [];

  const merged = { llm, github, routes };
  // Top-level state keys: local if explicitly present, else global.
  for (const key of ['updatedAt', 'audit', 'routeCache']) {
    if (l[key] !== undefined) merged[key] = l[key];
    else if (g[key] !== undefined) merged[key] = g[key];
  }
  return merged;
}

export function readConfig(opts = {}) {
  return mergeConfigs(readScopeConfig(SCOPE_GLOBAL, opts), readScopeConfig(SCOPE_LOCAL, opts));
}

/** Writes a config to one scope (default local). */
export function writeConfig(config, opts = {}) {
  const scope = opts.scope || SCOPE_LOCAL;
  writeJsonFile(getConfigPath({ ...opts, scope }), config);
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

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  return parseEnv(readFileSync(file, 'utf8'));
}

function writeEnvFile(env, file) {
  mkdirSync(path.dirname(file), { recursive: true });
  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`);
  writeFileSync(file, lines.length ? `${lines.join('\n')}\n` : '', 'utf8');
}

function readScopeEnv(scope, opts = {}) {
  return readEnvFile(getEnvPath({ ...opts, scope }));
}

/**
 * Effective environment: global .env merged with local .env (local wins per key).
 * Pass `{ scope }` to read a single tier directly.
 */
export function readEnv(opts = {}) {
  if (isGlobalScope(opts.scope)) return readScopeEnv(SCOPE_GLOBAL, opts);
  return { ...readScopeEnv(SCOPE_GLOBAL, opts), ...readScopeEnv(SCOPE_LOCAL, opts) };
}

function setEnvEntries(entries, opts = {}) {
  const scope = opts.scope || SCOPE_LOCAL;
  const env = readScopeEnv(scope, opts);
  for (const [key, value] of Object.entries(entries)) env[key] = value;
  writeEnvFile(env, getEnvPath({ ...opts, scope }));
}

function unsetEnvKeys(keys, opts = {}) {
  const scope = opts.scope || SCOPE_LOCAL;
  const env = readScopeEnv(scope, opts);
  for (const key of keys) delete env[key];
  writeEnvFile(env, getEnvPath({ ...opts, scope }));
}

// ---- connection lifecycle ----

/**
 * Persists a connection. Secrets go to .env; provider metadata + env-var
 * references go to the config file. `opts.scope` (default 'local') selects the
 * tier that is written. Returns the effective connection state.
 */
export function saveConnection({ llmProvider, llmApiKey, githubToken } = {}, opts = {}) {
  const scope = opts.scope || SCOPE_LOCAL;
  const envEntries = {};
  if (llmApiKey) envEntries[ENV_LLM_KEY] = llmApiKey;
  if (githubToken) envEntries[ENV_GITHUB_TOKEN] = githubToken;
  if (Object.keys(envEntries).length > 0) setEnvEntries(envEntries, { ...opts, scope });

  const config = normalizeConfig(readScopeConfig(scope, opts));
  if (llmProvider) config.llm.provider = llmProvider;
  config.updatedAt = new Date().toISOString();
  writeConfig(config, { ...opts, scope });

  return getConnection(opts);
}

/** Removes stored credentials (secrets from .env + connection metadata) at scope. */
export function disconnect(opts = {}) {
  const scope = opts.scope || SCOPE_LOCAL;
  unsetEnvKeys([ENV_LLM_KEY, ENV_GITHUB_TOKEN], { ...opts, scope });
  const config = normalizeConfig(readScopeConfig(scope, opts));
  config.llm.provider = null;
  config.updatedAt = new Date().toISOString();
  writeConfig(config, { ...opts, scope });
}

/**
 * Effective connection state, plus — for `decode status` — the source scope of
 * each credential so the user never misreads origin of the key in use.
 */
export function getConnection(opts = {}) {
  const config = readConfig(opts);
  const env = readEnv(opts);
  const localEnv = readScopeEnv(SCOPE_LOCAL, opts);
  const globalEnv = readScopeEnv(SCOPE_GLOBAL, opts);
  const localCfg = normalizeConfig(readScopeConfig(SCOPE_LOCAL, opts));
  const globalCfg = normalizeConfig(readScopeConfig(SCOPE_GLOBAL, opts));

  const llmConfigured = Boolean(env[ENV_LLM_KEY]);
  const githubConfigured = Boolean(env[ENV_GITHUB_TOKEN]);
  const llmProviderScope =
    localCfg.llm.provider != null ? SCOPE_LOCAL : globalCfg.llm.provider != null ? SCOPE_GLOBAL : null;
  const llmKeyScope = localEnv[ENV_LLM_KEY] != null ? SCOPE_LOCAL : globalEnv[ENV_LLM_KEY] != null ? SCOPE_GLOBAL : null;
  const githubKeyScope = localEnv[ENV_GITHUB_TOKEN] != null ? SCOPE_LOCAL : globalEnv[ENV_GITHUB_TOKEN] != null ? SCOPE_GLOBAL : null;

  return {
    llmProvider: config.llm.provider,
    llmProviderScope,
    llmConfigured,
    llmKeyScope,
    githubConfigured,
    githubKeyScope,
    connected: llmConfigured || githubConfigured,
    configPath: getConfigPath({ ...opts, scope: SCOPE_LOCAL }),
    globalConfigPath: getGlobalConfigPath(),
  };
}

export function isConfigured(opts = {}) {
  return getConnection(opts).connected;
}

// ---- auto-detected route scan cache (see src/services/routeDetector.js) ----
// `decode api list` scans the project's backend source and caches the result in
// the project-local config so repeated calls don't rescan (until --refresh).

/** Returns the cached route scan (from local config), or null when absent. */
export function getRouteCache(opts = {}) {
  return readConfig(opts).routeCache || null;
}

/** Persists a route scan into the project-local config tier. */
export function saveRouteCache(cache, opts = {}) {
  const config = normalizeConfig(readScopeConfig(SCOPE_LOCAL, opts));
  config.routeCache = cache;
  config.updatedAt = new Date().toISOString();
  writeConfig(config, { ...opts, scope: SCOPE_LOCAL });
  return cache;
}

/** Read-only access to the (legacy) `routes` list stored in the config. */
export function getRoutes(opts = {}) {
  return [...readConfig(opts).routes];
}

/** Flattens a route scan cache into plain route paths for `config list`. */
function detectedRoutePaths(cache) {
  if (!cache || !Array.isArray(cache.routes)) return [];
  return cache.routes.map((r) => r.path);
}

// ---- config value management (`decode config list / set / reset`) ----

/** Key segments that signal a credential — these belong in .env, not config. */
const SECRET_HINTS = /key|token|secret|password|credential/i;

const ALLOWED_ROOTS = new Set(['llm', 'github']);

/**
 * Sets a non-secret config value by dotted path (e.g. "llm.provider").
 * `opts.scope` (default 'local') selects the tier the value is written to.
 * Rejects secret-looking keys and any root outside llm/github so credentials
 * can never leak into a decode.config.json (AGENTS.md rule 3).
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

  const scope = opts.scope || SCOPE_LOCAL;
  const config = normalizeConfig(readScopeConfig(scope, opts));
  let target = config[root];
  for (let i = 1; i < segments.length - 1; i += 1) {
    if (target[segments[i]] == null || typeof target[segments[i]] !== 'object') {
      target[segments[i]] = {};
    }
    target = target[segments[i]];
  }
  target[segments[segments.length - 1]] = cleanValue;

  config.updatedAt = new Date().toISOString();
  writeConfig(config, { ...opts, scope });
  return config;
}

/**
 * Resets one scope's config to defaults (`opts.scope`, default 'local').
 * Credentials in .env are intentionally untouched — `decode disconnect`
 * removes those.
 */
export function resetConfig(opts = {}) {
  const scope = opts.scope || SCOPE_LOCAL;
  const config = defaultConfig();
  config.updatedAt = new Date().toISOString();
  writeConfig(config, { ...opts, scope });
  return config;
}

/**
 * A clean, secret-free summary of the *effective* config plus the source scope
 * of each value, for `decode config list` (display + --json).
 */
export function getConfigSummary(opts = {}) {
  const config = readConfig(opts);
  const env = readEnv(opts);
  const localCfg = normalizeConfig(readScopeConfig(SCOPE_LOCAL, opts));
  const globalCfg = normalizeConfig(readScopeConfig(SCOPE_GLOBAL, opts));
  const localEnv = readScopeEnv(SCOPE_LOCAL, opts);
  const globalEnv = readScopeEnv(SCOPE_GLOBAL, opts);

  const providerScope =
    localCfg.llm.provider != null ? SCOPE_LOCAL : globalCfg.llm.provider != null ? SCOPE_GLOBAL : 'default';
  const keyScope =
    localEnv[ENV_LLM_KEY] != null ? SCOPE_LOCAL : globalEnv[ENV_LLM_KEY] != null ? SCOPE_GLOBAL : 'default';
  const tokenScope =
    localEnv[ENV_GITHUB_TOKEN] != null ? SCOPE_LOCAL : globalEnv[ENV_GITHUB_TOKEN] != null ? SCOPE_GLOBAL : 'default';

  return {
    llm: {
      provider: config.llm.provider,
      providerScope,
      apiKeyRef: config.llm.apiKeyRef,
      configured: Boolean(env[ENV_LLM_KEY]),
      keyScope,
    },
    github: {
      tokenRef: config.github.tokenRef,
      configured: Boolean(env[ENV_GITHUB_TOKEN]),
      tokenScope,
    },
    routes: detectedRoutePaths(config.routeCache),
    configPath: getConfigPath({ ...opts, scope: SCOPE_LOCAL }),
    globalConfigPath: getGlobalConfigPath(),
    updatedAt: config.updatedAt || null,
  };
}

// ---- last audit result (`decode status` reads this) ----

export function getLastAudit(opts = {}) {
  const config = readConfig(opts);
  return config.audit || null;
}

export function saveLastAudit(summary, opts = {}) {
  const config = normalizeConfig(readScopeConfig(SCOPE_LOCAL, opts));
  config.audit = { ...summary, ranAt: new Date().toISOString() };
  config.updatedAt = new Date().toISOString();
  writeConfig(config, { ...opts, scope: SCOPE_LOCAL });
  return config.audit;
}