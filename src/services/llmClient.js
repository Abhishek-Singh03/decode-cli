/**
 * src/services/llmClient.js
 * Minimal LLM client, routed to the provider configured in the config store
 * (no new dependencies — global fetch only).
 *
 * Routing (provider names from `decode init`):
 *  - anthropic  → POST {base}/v1/messages    (x-api-key + anthropic-version headers)
 *  - openai     → POST {base}/v1/chat/completions (Bearer)
 *  - groq/other → POST {base}/v1/chat/completions (Bearer) — "other" defaults
 *                 to the OpenAI-compatible shape (common for most providers).
 *
 * The base URL comes from the LLM_PROVIDER_BASE_URL env var if set, else a
 * per-provider default. `fetchImpl` is injectable for hermetic tests.
 *
 * No data is ever fabricated (AGENTS.md rule 9): when no provider/key is
 * configured this throws a clear error that callers can degrade gracefully.
 */
import { ENV_LLM_KEY, readConfig, readEnv } from './configStore.js';

const PROVIDER_BASE_URLS = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  groq: 'https://api.groq.com',
};

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o-mini',
  groq: 'llama-3.1-8b-instant',
  other: 'gpt-4o-mini',
};

const MAX_TOKENS = 512;

/**
 * @returns {{ provider: string|null, apiKey: string|null }} connection info
 * read fresh from the config store + .env.
 */
function getLlmConnection({ cwd } = {}) {
  const config = readConfig({ cwd });
  const env = readEnv({ cwd });
  return {
    provider: config.llm.provider,
    apiKey: env[ENV_LLM_KEY] || null,
  };
}

export function isLlmConfigured(opts = {}) {
  const { provider, apiKey } = getLlmConnection(opts);
  return Boolean(provider && apiKey);
}

/**
 * Requests a text completion (a "summary") from the configured provider.
 * @param {string} prompt
 * @param {{ cwd?: string, fetchImpl?: typeof fetch, maxTokens?: number }} options
 * @returns {Promise<string>} the model's text output
 */
export async function generateSummary(prompt, options = {}) {
  const { cwd, fetchImpl = fetch, maxTokens = MAX_TOKENS } = options;
  const { provider, apiKey } = getLlmConnection({ cwd });

  if (!provider || !apiKey) {
    throw new Error(
      'No LLM provider configured. Run `decode init` to connect your LLM provider.',
    );
  }

  const base = process.env.LLM_PROVIDER_BASE_URL || PROVIDER_BASE_URLS[provider];
  const model = DEFAULT_MODELS[provider] || DEFAULT_MODELS.other;

  if (provider === 'anthropic') {
    const res = await fetchImpl(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }

  // openai / groq / other — OpenAI-compatible chat completions
  const res = await fetchImpl(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`LLM request failed with status ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
