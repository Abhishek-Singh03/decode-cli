/**
 * test/unit/githubClient.test.js
 * Unit tests for the octokit wrapper + repo detection. The fake client means
 * zero network; detectCurrentRepo runs against temp git repos.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createGithubClient,
  getGithubClient,
  getRepoCommits,
  resolveRepoArg,
  detectCurrentRepo,
} from '../../src/services/githubClient.js';
import { saveConnection } from '../../src/services/configStore.js';

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-github-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('resolveRepoArg', () => {
  it('parses owner/repo', () => {
    expect(resolveRepoArg('octocat/Hello-World')).toEqual({ owner: 'octocat', repo: 'Hello-World' });
  });

  it('parses and normalizes an HTTPS URL', () => {
    expect(resolveRepoArg('https://github.com/a/b.git')).toEqual({ owner: 'a', repo: 'b' });
    expect(resolveRepoArg('https://github.com/a/b/')).toEqual({ owner: 'a', repo: 'b' });
  });

  it('parses an SSH URL', () => {
    expect(resolveRepoArg('git@github.com:a/b.git')).toEqual({ owner: 'a', repo: 'b' });
  });

  it('throws on malformed input', () => {
    expect(() => resolveRepoArg('')).toThrow();
    expect(() => resolveRepoArg('just-a-name')).toThrow(/owner\/repo/);
    expect(() => resolveRepoArg('https://not-github.example/x')).toThrow(/Invalid repo/);
  });
});

describe('detectCurrentRepo', () => {
  it('reads the origin remote from a real git repo (SSH URL)', () => {
    fs.mkdirSync(path.join(tmp, 'repo'));
    const repo = path.join(tmp, 'repo');
    execFileSync('git', ['init', '-q'], { cwd: repo });
    execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:o/r.git'], { cwd: repo });
    expect(detectCurrentRepo({ cwd: repo })).toEqual({ owner: 'o', repo: 'r' });
  });

  it('falls back to parsing .git/config when git is not usable', () => {
    fs.mkdirSync(path.join(tmp, 'repo'));
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(path.join(repo, '.git'));
    fs.writeFileSync(
      path.join(repo, '.git', 'config'),
      '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = https://github.com/fallback/works.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n',
    );
    expect(detectCurrentRepo({ cwd: repo })).toEqual({ owner: 'fallback', repo: 'works' });
  });

  it('throws when there is no git repo or origin', () => {
    expect(() => detectCurrentRepo({ cwd: tmp })).toThrow(/origin/);
  });
});

describe('getGithubClient', () => {
  it('throws a clear error when no token is stored', () => {
    expect(() => getGithubClient({ cwd: tmp })).toThrow(/No GitHub token configured/);
  });

  it('builds an authenticated client from the stored token', () => {
    saveConnection({ githubToken: 'gh-test' }, { cwd: tmp });
    const client = getGithubClient({ cwd: tmp });
    expect(typeof client.rest.users.getAuthenticated).toBe('function');
  });

  it('createGithubClient passes baseUrl through for tests', () => {
    const fakeCtor = vi.fn();
    createGithubClient({ token: 't', baseUrl: 'http://127.0.0.1:1', OctokitImpl: fakeCtor });
    expect(fakeCtor).toHaveBeenCalledWith({ auth: 't', baseUrl: 'http://127.0.0.1:1' });
  });
});

describe('getRepoCommits', () => {
  it('paginates through the fake client and respects the limit', async () => {
    const fake = {
      paginate: async () => Array.from({ length: 12 }, (_, i) => ({ sha: `s${i}` })),
      rest: { repos: { listCommits: 'endpoint-method' } },
    };
    const commits = await getRepoCommits(fake, { owner: 'a', repo: 'b' }, { limit: 500 });
    expect(commits).toHaveLength(12);
  });
});
