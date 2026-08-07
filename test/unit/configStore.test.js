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
  ENV_LLM_KEY,
  ENV_GITHUB_TOKEN,
} from '../../src/services/configStore.js';

let tmp;
let opts;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-config-store-'));
  opts = { cwd: tmp };
});

afterEach(() => {
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
