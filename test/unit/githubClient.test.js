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
  enrichCommits,
  getGithubClient,
  getRepoCommits,
  getRepoCommitsDetailed,
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

describe('getRepoCommitsDetailed / enrichCommits', () => {
  it('attaches files + stats to the newest commits', async () => {
    const commits = [
      { sha: 's1', commit: { message: 'a' } },
      { sha: 's2', commit: { message: 'b' } },
      { sha: 's3', commit: { message: 'c' } },
    ];
    const detailBySha = {
      s1: { files: [{ filename: 'src/x.js', additions: 2, deletions: 1 }], stats: { additions: 2, deletions: 1 } },
      s2: { files: [{ filename: 'docs/readme.md' }] },
    };
    const fake = {
      rest: {
        repos: {
          getCommit: async ({ ref }) =>
            detailBySha[ref]
              ? { data: detailBySha[ref] }
              : Promise.reject(new Error('not found')),
        },
      },
    };

    const enriched = await enrichCommits(fake, commits, { owner: 'a', repo: 'b', enrichLimit: 3 });
    expect(enriched[0].files).toEqual([{ filename: 'src/x.js', additions: 2, deletions: 1 }]);
    expect(enriched[1].files).toEqual([{ filename: 'docs/readme.md' }]);
    // s3 had no detail (getCommit rejected) → kept as the plain list commit
    expect(enriched[2].sha).toBe('s3');
    expect(enriched[2].files).toBeUndefined();
    expect(enriched).toHaveLength(3);
  });

  it('getRepoCommitsDetailed composes list + enrichment', async () => {
    const commits = [{ sha: 's1' }, { sha: 's2' }];
    const fake = {
      paginate: async () => commits,
      rest: {
        repos: {
          listCommits: 'endpoint-method',
          getCommit: async ({ ref }) => {
            if (ref === 's1') return { data: { files: [{ filename: 'src/a.js', additions: 1 }] } };
            throw new Error('nope');
          },
        },
      },
    };
    const detailed = await getRepoCommitsDetailed(fake, { owner: 'a', repo: 'b' }, { enrichLimit: 5 });
    expect(detailed).toHaveLength(2);
    expect(detailed[0].files[0].filename).toBe('src/a.js');
    expect(detailed[1].files).toBeUndefined();
  });
});
