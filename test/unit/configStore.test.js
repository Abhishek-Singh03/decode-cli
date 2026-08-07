/**
 * test/unit/configStore.test.js
 * Unit tests for the config store service — runs against a throwaway temp
 * directory so the real repo is never touched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readConfig,
  writeConfig,
  saveConnection,
  getConnection,
  disconnect,
  isConfigured,
  getConfigPath,
  getEnvPath,
  readEnv,
  getRoutes,
  addRoute,
  removeRoute,
  setConfigKey,
  resetConfig,
  getConfigSummary,
  getLastAudit,
  saveLastAudit,
  findProjectRoot,
  SCOPE_GLOBAL,
  SCOPE_LOCAL,
  ENV_LLM_KEY,
  ENV_GITHUB_TOKEN,
} from '../../src/services/configStore.js';

let tmp;
let globalDir;
let opts;
let gopts;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-config-store-'));
  globalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-global-store-'));
  process.env.DECODE_GLOBAL_CONFIG_DIR = globalDir;
  opts = { cwd: tmp };
  gopts = { scope: SCOPE_GLOBAL };
});

afterEach(() => {
  delete process.env.DECODE_GLOBAL_CONFIG_DIR;
  fs.rmSync(globalDir, { recursive: true, force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('configStore', () => {
  it('returns defaults when no config file exists yet', () => {
    const config = readConfig(opts);
    expect(config.llm.provider).toBeNull();
    expect(config.llm.apiKeyRef).toBe(ENV_LLM_KEY);
    expect(config.github.tokenRef).toBe(ENV_GITHUB_TOKEN);
  });

  it('reports nothing configured before any credentials are saved', () => {
    const conn = getConnection(opts);
    expect(conn.connected).toBe(false);
    expect(conn.llmConfigured).toBe(false);
    expect(conn.githubConfigured).toBe(false);
    expect(isConfigured(opts)).toBe(false);
  });

  it('saveConnection writes secrets to .env and metadata to the config file', () => {
    saveConnection(
      { llmProvider: 'anthropic', llmApiKey: 'sk-test-123', githubToken: 'gh-test-456' },
      opts,
    );

    expect(fs.existsSync(getConfigPath(opts))).toBe(true);
    expect(fs.existsSync(getEnvPath(opts))).toBe(true);

    const env = readEnv(opts);
    expect(env[ENV_LLM_KEY]).toBe('sk-test-123');
    expect(env[ENV_GITHUB_TOKEN]).toBe('gh-test-456');

    const config = readConfig(opts);
    expect(config.llm.provider).toBe('anthropic');

    const conn = getConnection(opts);
    expect(conn.llmConfigured).toBe(true);
    expect(conn.githubConfigured).toBe(true);
    expect(conn.connected).toBe(true);
    expect(isConfigured(opts)).toBe(true);
  });

  it('never stores the raw secret inside decode.config.json', () => {
    saveConnection({ llmApiKey: 'sk-super-secret', githubToken: 'gh-super-secret' }, opts);
    const raw = fs.readFileSync(getConfigPath(opts), 'utf8');
    expect(raw).not.toContain('sk-super-secret');
    expect(raw).not.toContain('gh-super-secret');
  });

  it('preserves unrelated entries already present in .env', () => {
    fs.writeFileSync(getEnvPath(opts), 'SOME_OTHER_VAR=keep-me\n', 'utf8');
    saveConnection({ llmApiKey: 'sk-test' }, opts);
    const env = readEnv(opts);
    expect(env.SOME_OTHER_VAR).toBe('keep-me');
    expect(env[ENV_LLM_KEY]).toBe('sk-test');
  });

  it('disconnect removes secrets and resets the stored provider', () => {
    saveConnection({ llmProvider: 'openai', llmApiKey: 'sk-x', githubToken: 'gh-y' }, opts);
    disconnect(opts);

    expect(isConfigured(opts)).toBe(false);
    const env = readEnv(opts);
    expect(env[ENV_LLM_KEY]).toBeUndefined();
    expect(env[ENV_GITHUB_TOKEN]).toBeUndefined();
    const config = readConfig(opts);
    expect(config.llm.provider).toBeNull();
  });

  it('writeConfig round-trips through readConfig', () => {
    const config = readConfig(opts);
    config.llm.provider = 'groq';
    writeConfig(config, opts);
    expect(readConfig(opts).llm.provider).toBe('groq');
  });
});

describe('configStore routes', () => {
  it('getRoutes returns an empty array by default', () => {
    expect(getRoutes(opts)).toEqual([]);
  });

  it('addRoute persists the route and returns the updated list', () => {
    const routes = addRoute('http://127.0.0.1:3000/health', opts);
    expect(routes).toEqual(['http://127.0.0.1:3000/health']);
    expect(readConfig(opts).routes).toEqual(['http://127.0.0.1:3000/health']);
    expect(fs.readFileSync(getConfigPath(opts), 'utf8')).toContain('http://127.0.0.1:3000/health');
  });

  it('addRoute rejects duplicates', () => {
    addRoute('http://a.test/x', opts);
    expect(() => addRoute('http://a.test/x', opts)).toThrow(/already configured/i);
  });

  it('addRoute rejects malformed, relative, and non-http(s) URLs', () => {
    expect(() => addRoute('not-a-url', opts)).toThrow();
    expect(() => addRoute('/health', opts)).toThrow();
    expect(() => addRoute('ftp://a.test/x', opts)).toThrow(/http or https/i);
  });

  it('removeRoute removes a configured route', () => {
    addRoute('http://a.test/x', opts);
    const routes = removeRoute('http://a.test/x', opts);
    expect(routes).toEqual([]);
    expect(readConfig(opts).routes).toEqual([]);
  });

  it('removeRoute throws for an unknown route', () => {
    expect(() => removeRoute('http://nope.test/x', opts)).toThrow(/not found/i);
  });

  it('routes survive saveConnection and disconnect', () => {
    addRoute('http://a.test/x', opts);
    saveConnection({ llmApiKey: 'sk-test' }, opts);
    expect(getRoutes(opts)).toEqual(['http://a.test/x']);
    disconnect(opts);
    expect(getRoutes(opts)).toEqual(['http://a.test/x']);
  });

  it('normalizes a pre-existing null routes field to an empty array', () => {
    writeConfig({ llm: { provider: null }, github: {}, routes: null }, opts);
    expect(getRoutes(opts)).toEqual([]);
  });
});

describe('configStore set/reset/summary', () => {
  it('setConfigKey persists a dotted-path value and bumps updatedAt', () => {
    setConfigKey('llm.provider', 'openai', opts);
    const config = readConfig(opts);
    expect(config.llm.provider).toBe('openai');
    expect(config.updatedAt).toBeTruthy();
  });

  it('setConfigKey rejects secret-looking keys', () => {
    for (const key of ['llm.apiKey', 'github.token', 'llm.apiKeyRef', 'github.password']) {
      expect(() => setConfigKey(key, 'x', opts)).toThrow(/credential/i);
    }
  });

  it('setConfigKey rejects unknown roots and missing values', () => {
    expect(() => setConfigKey('routes.foo', 'x', opts)).toThrow(/llm|github/);
    expect(() => setConfigKey('foo.bar', 'x', opts)).toThrow(/llm|github/);
    expect(() => setConfigKey('', 'x', opts)).toThrow(/Usage/);
    expect(() => setConfigKey('llm.provider', '  ', opts)).toThrow(/Usage/);
  });

  it('setConfigKey rejects a bare root without a leaf', () => {
    expect(() => setConfigKey('llm', 'openai', opts)).toThrow(/dotted path/);
  });

  it('resetConfig restores defaults but leaves .env credentials intact', () => {
    saveConnection({ llmProvider: 'anthropic', llmApiKey: 'sk-test', githubToken: 'gh-test' }, opts);
    addRoute('http://a.test/x', opts);

    resetConfig(opts);

    const config = readConfig(opts);
    expect(config.llm.provider).toBeNull();
    expect(config.routes).toEqual([]);

    const env = readEnv(opts);
    expect(env[ENV_LLM_KEY]).toBe('sk-test');
    expect(env[ENV_GITHUB_TOKEN]).toBe('gh-test');
  });

  it('getConfigSummary reports configured flags without any secret values', () => {
    saveConnection({ llmProvider: 'groq', llmApiKey: 'sk-super-secret' }, opts);
    const summary = getConfigSummary(opts);
    expect(summary.llm.provider).toBe('groq');
    expect(summary.llm.configured).toBe(true);
    expect(summary.github.configured).toBe(false);
    expect(JSON.stringify(summary)).not.toContain('sk-super-secret');
  });

  it('returns no last audit before any audit has run', () => {
    expect(getLastAudit(opts)).toBeNull();
  });

  it('round-trips a saved audit summary with a ranAt timestamp', () => {
    const saved = saveLastAudit(
      { total: 3, passed: 2, failed: 1, skipped: 0, ok: false },
      opts,
    );
    expect(saved.ok).toBe(false);
    expect(saved.ranAt).toEqual(expect.any(String));

    const lastAudit = getLastAudit(opts);
    expect(lastAudit).toMatchObject({ total: 3, passed: 2, failed: 1, skipped: 0, ok: false });
    expect(Date.parse(lastAudit.ranAt)).not.toBeNaN();
  });

  it('reset clears the saved audit result with the rest of the config', () => {
    saveLastAudit({ total: 3, passed: 3, failed: 0, skipped: 0, ok: true }, opts);
    resetConfig(opts);
    expect(getLastAudit(opts)).toBeNull();
  });
});

describe('configStore two-tier scope (global vs local)', () => {
  it('neither global nor local present → defaults (prompt to run init)', () => {
    const config = readConfig(opts);
    expect(config.llm.provider).toBeNull();
    const conn = getConnection(opts);
    expect(conn.connected).toBe(false);
    expect(conn.llmProviderScope).toBeNull();
    expect(conn.llmKeyScope).toBeNull();
    expect(conn.githubKeyScope).toBeNull();
    expect(getConfigSummary(opts).llm.providerScope).toBe('default');
  });

  it('global-only config applies to a project with no local config', () => {
    saveConnection(
      { llmProvider: 'groq', llmApiKey: 'gsk-global', githubToken: 'gh-global' },
      gopts,
    );

    const config = readConfig(opts);
    expect(config.llm.provider).toBe('groq');
    const env = readEnv(opts);
    expect(env[ENV_LLM_KEY]).toBe('gsk-global');
    expect(env[ENV_GITHUB_TOKEN]).toBe('gh-global');

    const conn = getConnection(opts);
    expect(conn.llmProviderScope).toBe(SCOPE_GLOBAL);
    expect(conn.llmKeyScope).toBe(SCOPE_GLOBAL);
    expect(conn.githubKeyScope).toBe(SCOPE_GLOBAL);
  });

  it('local-only config applies without any global config', () => {
    saveConnection({ llmProvider: 'openai', llmApiKey: 'sk-local', githubToken: 'gh-local' }, opts);

    const config = readConfig(opts);
    expect(config.llm.provider).toBe('openai');
    const conn = getConnection(opts);
    expect(conn.llmProviderScope).toBe(SCOPE_LOCAL);
    expect(conn.llmKeyScope).toBe(SCOPE_LOCAL);
    expect(conn.githubKeyScope).toBe(SCOPE_LOCAL);
  });

  it('local overrides global field-by-field, never all-or-nothing', () => {
    saveConnection(
      { llmProvider: 'groq', llmApiKey: 'gsk-global', githubToken: 'gh-global' },
      gopts,
    );
    // Project sets its own provider + LLM key but leaves GitHub to the global tier.
    setConfigKey('llm.provider', 'openai', { ...opts, scope: SCOPE_LOCAL });
    fs.writeFileSync(getEnvPath(opts), `${ENV_LLM_KEY}=sk-local\n`, 'utf8');

    const config = readConfig(opts);
    expect(config.llm.provider).toBe('openai'); // local field won

    const env = readEnv(opts);
    expect(env[ENV_LLM_KEY]).toBe('sk-local');
    expect(env[ENV_GITHUB_TOKEN]).toBe('gh-global'); // fell back to global

    const summary = getConfigSummary(opts);
    expect(summary.llm.providerScope).toBe(SCOPE_LOCAL);
    expect(summary.github.tokenScope).toBe(SCOPE_GLOBAL);
    expect(summary.llm.keyScope).toBe(SCOPE_LOCAL);

    const conn = getConnection(opts);
    expect(conn.llmKeyScope).toBe(SCOPE_LOCAL);
    expect(conn.githubKeyScope).toBe(SCOPE_GLOBAL);
  });

  it('reset with a scope clears only that tier of the config file', () => {
    saveConnection(
      { llmProvider: 'groq', llmApiKey: 'gsk-global', githubToken: 'gh-global' },
      gopts,
    );
    saveConnection({ llmProvider: 'openai', llmApiKey: 'sk-local' }, { ...opts, scope: SCOPE_LOCAL });

    resetConfig({ ...opts, scope: SCOPE_LOCAL });

    // reset writes an explicit default provider (null) into the LOCAL tier,
    // which — under per-field override — shadows the global provider for this
    // project. The getGlobal tier itself is untouched.
    const config = readConfig(opts);
    expect(config.llm.provider).toBeNull();

    // The global tier itself is untouched.
    const globalRaw = JSON.parse(fs.readFileSync(path.join(globalDir, 'decode.config.json'), 'utf8'));
    expect(globalRaw.llm.provider).toBe('groq');

    // .env credentials are intentionally untouched by reset (decode disconnect removes them).
    const env = readEnv(opts);
    expect(env[ENV_GITHUB_TOKEN]).toBe('gh-global');
    expect(env[ENV_LLM_KEY]).toBe('sk-local');
  });

  it('findProjectRoot walks up to the nearest decode.config.json', () => {
    writeConfig({ llm: { provider: 'openai' }, github: {} }, opts); // rooted at tmp
    fs.mkdirSync(path.join(tmp, 'backend', 'routes'), { recursive: true });
    const nested = path.join(tmp, 'backend', 'routes');

    expect(findProjectRoot({ cwd: nested })).toBe(tmp);
    expect(readConfig({ cwd: nested }).llm.provider).toBe('openai');
  });
});
