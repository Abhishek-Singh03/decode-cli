/**
 * test/unit/repoHealth.test.js
 * Unit tests for the repo health check. Builds throwaway git repos in a temp
 * dir so the real repo is never inspected. Commits are dated via git env vars,
 * so the "stale window" cases are deterministic regardless of when the suite runs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { checkRepoHealth } from '../../src/services/repoHealth.js';

const STALE_COMMIT_DATE = '2020-01-01T00:00:00+00:00';

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-repo-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function git(args) {
  return execFileSync('git', args, { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** Turns the temp dir into a git repo (optionally with origin + a commit). */
function initGitRepo() {
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'Test']);
}

function addOrigin() {
  git(['remote', 'add', 'origin', 'https://github.com/example/decode-test.git']);
}

function commit(message, { at } = {}) {
  fs.writeFileSync(path.join(tmp, 'file.txt'), `${message}\n`);
  git(['add', '-A']);
  const env = { ...process.env };
  if (at) env.GIT_COMMITTER_DATE = at;
  execFileSync('git', ['commit', '-q', '-m', message], {
    cwd: tmp,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    env,
  });
}

describe('checkRepoHealth', () => {
  it('skips when the directory is not a git repository', () => {
    expect(checkRepoHealth({ cwd: tmp })).toEqual({
      name: 'repo',
      status: 'skipped',
      detail: 'not a git repository',
    });
  });

  it('fails when there is no "origin" remote', () => {
    initGitRepo();
    commit('initial');
    const result = checkRepoHealth({ cwd: tmp });
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('origin');
  });

  it('fails when the repo has no commits', () => {
    initGitRepo();
    addOrigin();
    const result = checkRepoHealth({ cwd: tmp });
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('no commits');
  });

  it('passes for a repo with an origin remote and a recent commit', () => {
    initGitRepo();
    commit('initial');
    addOrigin();
    const result = checkRepoHealth({ cwd: tmp });
    expect(result.status).toBe('pass');
    expect(result.detail).toContain('healthy');
  });

  it('fails when the last commit is older than the default stale window', () => {
    initGitRepo();
    commit('old', { at: STALE_COMMIT_DATE });
    addOrigin();
    const result = checkRepoHealth({ cwd: tmp });
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('days old');
    expect(result.detail).toContain('>90');
  });

  it('honors a custom staleDays window', () => {
    initGitRepo();
    commit('old', { at: STALE_COMMIT_DATE });
    addOrigin();
    // The old commit is thousands of days old, so a huge window passes it.
    expect(checkRepoHealth({ cwd: tmp, staleDays: 40_000 }).status).toBe('pass');
  });
});
