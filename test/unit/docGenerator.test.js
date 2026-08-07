/**
 * test/unit/docGenerator.test.js
 * Unit tests for the Doc Generator skill — prompt building + generation via a
 * stub fetch (no real LLM calls).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildArchitecturePrompt, buildExplainPrompt, generateArchitecture, explain } from '../../src/services/docGenerator.js';
import { saveConnection } from '../../src/services/configStore.js';

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-docgen-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const project = {
  root: '/fake',
  tree: ['package.json', 'src/index.js'],
  keyFiles: [
    { path: 'package.json', content: '{"name":"demo"}' },
    { path: 'src/index.js', content: 'console.log(1);' },
  ],
};

function stubFetch({ content }) {
  const fn = async (url, options = {}) => {
    fn._url = url;
    fn._options = options;
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
  };
  return fn;
}

describe('docGenerator prompts', () => {
  it('buildArchitecturePrompt includes the tree, key files, and instruction', () => {
    const prompt = buildArchitecturePrompt(project, { instruction: 'focus on CLI' });
    expect(prompt).toContain('src/index.js');
    expect(prompt).toContain('console.log(1)');
    expect(prompt).toContain('focus on CLI');
    expect(prompt).toContain('Overview');
  });

  it('buildExplainPrompt asks for a whole-project overview by default', () => {
    const prompt = buildExplainPrompt(project);
    expect(prompt).toContain('whole project');
  });
});

describe('docGenerator generation', () => {
  it('generateArchitecture calls the LLM with a larger token budget', async () => {
    saveConnection({ llmProvider: 'openai', llmApiKey: 'sk-test' }, { cwd: tmp });
    const fetchImpl = stubFetch({ content: '# Architecture\n\nGenerated.' });

    const markdown = await generateArchitecture(project, { cwd: tmp, fetchImpl });

    expect(markdown).toContain('# Architecture');
    const body = JSON.parse(fetchImpl._options.body);
    expect(body.max_tokens).toBe(2048);
  });

  it('explain returns the LLM explanation text', async () => {
    saveConnection({ llmProvider: 'openai', llmApiKey: 'sk-test' }, { cwd: tmp });
    const fetchImpl = stubFetch({ content: 'This project is a demo.' });

    const text = await explain(project, { cwd: tmp, fetchImpl, instruction: 'what is this?' });

    expect(text).toBe('This project is a demo.');
  });

  it('rejects clearly when no LLM is configured', async () => {
    await expect(generateArchitecture(project, { cwd: tmp })).rejects.toThrow(/No LLM provider configured/);
  });
});
