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

/**
 * Fetches a repo's commits AND enriches the newest ones with file stats, so
 * the Repo Analyst can compute docs-only / commit-size heuristics. The list
 * endpoint does not include per-commit files, so each enriched commit gets one
 * extra `GET /commits/{sha}` request (bounded, concurrency-limited). Commits
 * whose detail can't be fetched are kept as-is — heuristics degrade gracefully.
 */
export async function getRepoCommitsDetailed(client, { owner, repo }, options = {}) {
  const { limit = 500, enrichLimit = 100 } = options;
  const commits = await getRepoCommits(client, { owner, repo }, { limit });
  return enrichCommits(client, commits, { owner, repo, enrichLimit });
}

/**
 * Adds `files` + `stats` to the newest `enrichLimit` commits. Commits carrying a
 * `_repo` field (from getUserCommitActivity) are resolved in that repo, so the
 * same helper serves single-repo analysis and cross-repo activity.
 */
export async function enrichCommits(client, commits, { owner, repo, enrichLimit = 100 } = {}) {
  const head = commits.slice(0, enrichLimit);
  const detailed = await mapConcurrent(head, 8, async (commit) => {
    if (commit.files || commit.stats) return commit; // already has detail
    const commitRepo = commit._repo || repo;
    try {
      const { data } = await client.rest.repos.getCommit({ owner, repo: commitRepo, ref: commit.sha });
      return { ...commit, files: data.files, stats: data.stats, repo: commitRepo };
    } catch {
      return commit; // unauthorized/not found — keep the list-entry as-is
    }
  });
  return [...detailed, ...commits.slice(enrichLimit)];
}

/**
 * Collects the authenticated user's recent commit activity across their own
 * repositories (most-pushed first), sorts newest-first, caps it, and enriches
 * the newest entries with file counts. Powers `decode github profile`.
 */
export async function getUserCommitActivity(client, { login, repoLimit = 3, perRepoLimit = 8, totalLimit = 30 } = {}) {
  let repositories = [];
  try {
    const { data } = await client.rest.repos.listForUser({ username: login, per_page: repoLimit, sort: 'pushed' });
    repositories = Array.isArray(data) ? data : [];
  } catch {
    return { commits: [], detail: [] };
  }

  const collected = [];
  for (const repo of repositories) {
    if (collected.length >= totalLimit) break;
    try {
      const { data: list } = await client.rest.repos.listCommits({
        owner: login,
        repo: repo.name,
        author: login,
        per_page: perRepoLimit,
      });
      for (const c of list || []) {
        collected.push(c._repo ? c : { ...c, _repo: repo.name });
      }
    } catch {
      // skip repos whose commits can't be listed (private/unreachable)
    }
  }

  collected.sort((a, b) =>
    (b.commit?.author?.date || '').localeCompare(a.commit?.author?.date || ''),
  );
  const top = collected.slice(0, totalLimit);
  const detail = await enrichCommits(client, top, { owner: login, enrichLimit: totalLimit });

  const commits = detail.map((c) => ({
    repo: c.repo || c._repo || null,
    sha: c.sha || '',
    date: (c.commit?.author?.date || '').slice(0, 10),
    message: c.commit?.message || '',
    files: Array.isArray(c.files) ? c.files.length : 0,
  }));
  return { commits, detail };
}

/** Runs `mapper` over `items` with bounded concurrency, preserving order. */
async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      // eslint-disable-next-line no-await-in-loop
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
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
