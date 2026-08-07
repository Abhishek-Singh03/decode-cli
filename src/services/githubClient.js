/**
 * src/services/githubClient.js
 * Octokit wrapper for the GitHub integration. Builds an authenticated client
 * from the token stored in .env (via the config store), and resolves
 * owner/repo from a CLI arg or the current git repo.
 *
 * Testing: `createGithubClient` accepts an injected `OctokitImpl` and a
 * `baseUrl` override so unit tests can use a fake client with zero network,
 * and integration tests can point the real client at a local mock server
 * (via the DECODE_GITHUB_API_URL env var).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { Octokit } from 'octokit';

import { ENV_GITHUB_TOKEN, readEnv } from './configStore.js';

const DEFAULT_PAGE_SIZE = 100;

export function createGithubClient(options = {}) {
  const {
    token,
    baseUrl,
    OctokitImpl = Octokit,
  } = options;

  const ctorOptions = { auth: token };
  if (baseUrl) ctorOptions.baseUrl = baseUrl;
  return new OctokitImpl(ctorOptions);
}

/**
 * Builds an authenticated client from the stored GitHub token.
 * Throws a clear error when no token is configured (AGENTS.md rule 3).
 */
export function getGithubClient({ cwd, token } = {}) {
  const apiKey = token || readEnv({ cwd })[ENV_GITHUB_TOKEN];
  if (!apiKey) {
    throw new Error('No GitHub token configured. Run `decode github connect` to authenticate.');
  }
  return createGithubClient({
    token: apiKey,
    baseUrl: process.env.DECODE_GITHUB_API_URL,
  });
}

export async function getAuthenticatedUser(client) {
  const { data } = await client.rest.users.getAuthenticated();
  return data;
}

export async function getRepoCommits(client, { owner, repo }, options = {}) {
  const { limit = 500 } = options;
  const perPage = Math.min(DEFAULT_PAGE_SIZE, limit);
  const commits = await client.paginate(
    client.rest.repos.listCommits,
    { owner, repo, per_page: perPage },
    (response, done) => {
      if (response.data.length >= limit) done();
      return response.data;
    },
  );
  return commits.slice(0, limit);
}

export async function listReposForUser(client, { login, limit = 10 }) {
  const { data } = await client.rest.repos.listForUser({ username: login, per_page: limit, sort: 'pushed' });
  return data;
}

/**
 * Normalizes a CLI repo argument into { owner, repo }. Accepts `owner/repo`,
 * a full HTTPS URL, or an SSH URL; strips `.git` and any path suffix.
 */
export function resolveRepoArg(input) {
  const value = String(input).trim();
  if (!value) throw new Error('Repo argument is required.');

  let candidate = value;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const parsed = new URL(value);
      candidate = parsed.pathname.replace(/^\/+/, '');
    } catch {
      throw new Error(`Invalid repo URL: ${value}`);
    }
  } else if (value.startsWith('git@')) {
    candidate = value.split(':')[1] || value;
  }

  candidate = candidate.replace(/\.git$/, '').replace(/\/+$/, '');
  const parts = candidate.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Invalid repo: ${value}. Expected "owner/repo" or a GitHub URL.`);
  }

  const owner = parts[parts.length - 2];
  const repo = parts[parts.length - 1];
  if (!owner || !repo) throw new Error(`Invalid repo: ${value}`);

  return { owner, repo };
}

/**
 * Detects the GitHub repo for the current working directory by reading the
 * `origin` remote (via `git remote get-url origin`, with a .git/config
 * fallback). Handles HTTPS and SSH remote URLs.
 */
export function detectCurrentRepo({ cwd } = {}) {
  const base = cwd || process.cwd();
  const remote = getOriginRemote(base);
  if (!remote) {
    throw new Error('No git remote "origin" found. Run `decode github analyze <owner/repo>` to target a repo.');
  }
  return resolveRepoArg(remote);
}

function getOriginRemote(base) {
  if (existsSync(path.join(base, '.git'))) {
    try {
      return execFileSync('git', ['remote', 'get-url', 'origin'], {
        cwd: base,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      // fall through to .git/config parsing
    }
  }

  const configPath = path.join(base, '.git', 'config');
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf8');
    const match = content.match(/^\s*\[remote\s+"origin"\]\s*\n([^[]*)$/m);
    if (match) {
      const urlMatch = match[1].match(/^\s*url\s*=\s*(.+)\s*$/m);
      if (urlMatch) return urlMatch[1].trim();
    }
  }
  return null;
}
