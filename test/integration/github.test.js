/**
 * test/integration/github.test.js
 * `decode github` end-to-end against a hermetic mock GitHub API server.
 * The CLI child runs in a temp cwd with a stored token (.env) and
 * DECODE_GITHUB_API_URL pointing at the local mock — no real GitHub calls,
 * no real secrets.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../bin/decode.js', import.meta.url));
const TOKEN = 'test-token';
const BAD_TOKEN = 'bad-token';

const USER = {
  login: 'octocat',
  name: 'Octo Cat',
  bio: 'mock user',
  public_repos: 5,
  followers: 10,
  following: 3,
  html_url: 'https://github.com/octocat',
};

const REPOS = [
  { full_name: 'octocat/hello-world', language: 'JavaScript', pushed_at: '2026-08-01T00:00:00Z' },
];

const COMMITS = [
  {
    sha: '1',
    commit: { author: { name: 'Ada', date: '2026-08-01T10:00:00Z' } },
    author: { login: 'ada' },
  },
  {
    sha: '2',
    commit: { author: { name: 'Ada', date: '2026-08-01T12:00:00Z' } },
    author: { login: 'ada' },
  },
  {
    sha: '3',
    commit: { author: { name: 'Grace', date: '2026-08-02T09:00:00Z' } },
    author: { login: 'grace' },
  },
];

let server;
let baseUrl;
let tmp;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const auth = req.headers.authorization || '';
    if (auth.includes(BAD_TOKEN)) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'Bad credentials' }));
      return;
    }

    const { pathname } = new URL(req.url, 'http://localhost');
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (pathname === '/user') send(200, USER);
    else if (pathname === '/users/octocat/repos') send(200, REPOS);
    else if (pathname === '/repos/mock-owner/mock-repo/commits') send(200, COMMITS);
    else send(404, { message: 'not found' });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  server.closeAllConnections?.();
  return new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-github-it-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeToken(token) {
  fs.writeFileSync(path.join(tmp, '.env'), `GITHUB_TOKEN=${token}\n`, 'utf8');
}

function run(args, opts = {}) {
  return execa(process.execPath, [CLI, ...args], {
    cwd: tmp,
    reject: false,
    env: { DECODE_GITHUB_API_URL: baseUrl },
    ...opts,
  });
}

describe('decode github connect', () => {
  it('verifies a valid stored token and prints the authenticated user', async () => {
    writeToken(TOKEN);
    const { exitCode, stdout } = await run(['github', 'connect']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('octocat');
  });

  it('fails cleanly when the token is rejected by the API', async () => {
    writeToken(BAD_TOKEN);
    const { exitCode, stderr } = await run(['github', 'connect']);
    expect(exitCode).toBe(1);
    expect(stderr.toLowerCase()).toContain('failed');
  });
});

describe('decode github profile', () => {
  it('prints the profile and recently active repos', async () => {
    writeToken(TOKEN);
    const { exitCode, stdout } = await run(['github', 'profile']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('octocat');
    expect(stdout).toContain('hello-world');
  });

  it('fails without a stored token', async () => {
    const { exitCode, stderr } = await run(['github', 'profile']);
    expect(exitCode).toBe(1);
    expect(stderr.toLowerCase()).toContain('token');
  });
});

describe('decode github analyze', () => {
  it('analyzes a repo passed as an argument', async () => {
    writeToken(TOKEN);
    const { exitCode, stdout } = await run(['github', 'analyze', 'mock-owner/mock-repo']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('mock-owner/mock-repo');
    expect(stdout).toContain('ada');
    expect(stdout).toContain('grace');
    // no LLM configured in the temp cwd → graceful note, still exit 0
    expect(stdout.toLowerCase()).toContain('no llm configured');
  });

  it('analyzes the current working repo via git remote', async () => {
    writeToken(TOKEN);
    execFileSync('git', ['init', '-q'], { cwd: tmp });
    execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:mock-owner/mock-repo.git'], { cwd: tmp });
    const { exitCode, stdout } = await run(['github', 'analyze']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('mock-owner/mock-repo');
  });

  it('emits valid JSON with analysis when --json is passed', async () => {
    writeToken(TOKEN);
    const { exitCode, stdout } = await run(['github', 'analyze', 'mock-owner/mock-repo', '--json']);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.repo).toEqual({ owner: 'mock-owner', repo: 'mock-repo' });
    expect(parsed.analysis.totalCommits).toBe(3);
    expect(parsed.analysis.contributors).toEqual([
      { login: 'ada', count: 2 },
      { login: 'grace', count: 1 },
    ]);
    expect(parsed.summary).toBeNull(); // no LLM configured
  });

  it('fails outside a git repo with no repo argument', async () => {
    writeToken(TOKEN);
    const { exitCode, stderr } = await run(['github', 'analyze']);
    expect(exitCode).toBe(1);
    expect(stderr.toLowerCase()).toContain('origin');
  });

  it('fails without a stored token', async () => {
    const { exitCode, stderr } = await run(['github', 'analyze', 'mock-owner/mock-repo']);
    expect(exitCode).toBe(1);
    expect(stderr.toLowerCase()).toContain('token');
  });
});
