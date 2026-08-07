/**
 * src/services/repoHealth.js
 * Repo health check for `decode audit` (PRD story 4, AC1).
 *
 * Git-local and token-free (so `audit` runs clean in CI): a repo is healthy
 * when it is a git repository with an `origin` remote whose latest commit is
 * within the recency window. Everything reported is derived from real git
 * output — nothing is fabricated (AGENTS.md rule 9).
 */
import { execFileSync } from 'node:child_process';

const DEFAULT_STALE_DAYS = 90;

/**
 * @param {{ cwd?: string, staleDays?: number }} options
 * @returns {{ name: 'repo', status: 'pass'|'fail'|'skipped', detail: string }}
 */
export function checkRepoHealth({ cwd, staleDays = DEFAULT_STALE_DAYS } = {}) {
  const base = cwd || process.cwd();

  if (!isGitRepo(base)) {
    return { name: 'repo', status: 'skipped', detail: 'not a git repository' };
  }

  if (!hasOriginRemote(base)) {
    return { name: 'repo', status: 'fail', detail: 'no "origin" remote configured' };
  }

  const lastCommitIso = lastCommitDate(base);
  if (!lastCommitIso) {
    return { name: 'repo', status: 'fail', detail: 'no commits found' };
  }

  const lastDate = new Date(lastCommitIso);
  const ageDays = Math.floor((Date.now() - lastDate.getTime()) / 86_400_000);
  if (ageDays > staleDays) {
    return {
      name: 'repo',
      status: 'fail',
      detail: `last commit ${lastCommitIso.slice(0, 10)} is ${ageDays} days old (>${staleDays})`,
    };
  }

  return {
    name: 'repo',
    status: 'pass',
    detail: `healthy — last commit ${ageDays} day${ageDays === 1 ? '' : 's'} ago`,
  };
}

function isGitRepo(base) {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: base,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function hasOriginRemote(base) {
  try {
    const out = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: base,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return Boolean(out.trim());
  } catch {
    return false;
  }
}

function lastCommitDate(base) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI'], {
      cwd: base,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}
