/**
 * test/unit/llmClient.test.js
 * Unit tests for the minimal LLM client — a stub fetchImpl captures requests
 * and returns canned responses, so no real provider is ever called.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { isLlmConfigured, generateSummary } from '../../src/services/llmClient.js';
import { saveConnection, disconnect } from '../../src/services/configStore.js';

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-llm-'));
});

afterEach(() => {
  delete process.env.LLM_PROVIDER_BASE_URL;
  fs.rmSync(tmp, { recursive: true, force: true });
});

function stubFetch({ status = 200, json }) {
  const fn = async (url, options = {}) => {
    fn._url = url;
    fn._options = options;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (typeof json === 'function' ? json() : json),
    };
  };
  return fn;
}

describe('llmClient', () => {
  it('isLlmConfigured is false with no provider/key', () => {
    expect(isLlmConfigured({ cwd: tmp })).toBe(false);
  });

  it('isLlmConfigured is true once provider + key are stored', () => {
    saveConnection({ llmProvider: 'anthropic', llmApiKey: 'sk-test' }, { cwd: tmp });
    expect(isLlmConfigured({ cwd: tmp })).toBe(true);
    disconnect({ cwd: tmp });
    expect(isLlmConfigured({ cwd: tmp })).toBe(false);
  });

  it('calls the anthropic API shape and parses the reply', async () => {
    saveConnection({ llmProvider: 'anthropic', llmApiKey: 'sk-test' }, { cwd: tmp });
    const fetchImpl = stubFetch({ json: () => ({ content: [{ text: 'hello from claude' }] }) });

    const result = await generateSummary('summarize', { cwd: tmp, fetchImpl });

    expect(result).toBe('hello from claude');
    expect(fetchImpl._url).toBe('https://api.anthropic.com/v1/messages');
    expect(fetchImpl._options.method).toBe('POST');
    expect(fetchImpl._options.headers['x-api-key']).toBe('sk-test');
    expect(fetchImpl._options.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(fetchImpl._options.body);
    expect(body.messages[0].content).toBe('summarize');
  });

  it('calls the openai-compatible shape for openai', async () => {
    saveConnection({ llmProvider: 'openai', llmApiKey: 'sk-test' }, { cwd: tmp });
    const fetchImpl = stubFetch({ json: () => ({ choices: [{ message: { content: 'hello' } }] }) });

    const result = await generateSummary('summarize', { cwd: tmp, fetchImpl });

    expect(result).toBe('hello');
    expect(fetchImpl._url).toBe('https://api.openai.com/v1/chat/completions');
    expect(fetchImpl._options.headers.authorization).toBe('Bearer sk-test');
  });

  it('passes maxTokens through to the request body', async () => {
    saveConnection({ llmProvider: 'openai', llmApiKey: 'sk-test' }, { cwd: tmp });
    const fetchImpl = stubFetch({ json: () => ({ choices: [{ message: { content: 'x' } }] }) });

    await generateSummary('summarize', { cwd: tmp, fetchImpl, maxTokens: 2048 });
    const body = JSON.parse(fetchImpl._options.body);
    expect(body.max_tokens).toBe(2048);
  });

  it('honors LLM_PROVIDER_BASE_URL override', async () => {
    saveConnection({ llmProvider: 'openai', llmApiKey: 'sk-test' }, { cwd: tmp });
    process.env.LLM_PROVIDER_BASE_URL = 'http://127.0.0.1:9999';
    const fetchImpl = stubFetch({ json: () => ({ choices: [{ message: { content: 'x' } }] }) });

    await generateSummary('summarize', { cwd: tmp, fetchImpl });
    expect(fetchImpl._url).toBe('http://127.0.0.1:9999/v1/chat/completions');
  });

  it('rejects with a clear message when not configured', async () => {
    await expect(generateSummary('summarize', { cwd: tmp, fetchImpl: stubFetch({}) })).rejects.toThrow(
      /No LLM provider configured/,
    );
  });

  it('rejects when the provider responds with an error status', async () => {
    saveConnection({ llmProvider: 'openai', llmApiKey: 'sk-test' }, { cwd: tmp });
    await expect(
      generateSummary('summarize', { cwd: tmp, fetchImpl: stubFetch({ status: 401, json: {} }) }),
    ).rejects.toThrow(/status 401/);
  });
});
