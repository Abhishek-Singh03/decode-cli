/**
 * test/unit/repoAnalyst.test.js
 * Unit tests for the Repo Analyst custom agent (data analysis + prompt).
 */
import { describe, it, expect } from 'vitest';

import { analyzeCommits, buildSummaryPrompt } from '../../src/services/repoAnalyst.js';

function commit({ sha, login, name, date }) {
  return {
    sha,
    commit: { author: { name, date } },
    author: login ? { login } : null,
  };
}

describe('analyzeCommits', () => {
  it('computes totals, daily frequency, contributors, and busiest days', () => {
    const commits = [
      commit({ login: 'alice', date: '2026-08-01T10:00:00Z' }),
      commit({ login: 'alice', date: '2026-08-01T11:00:00Z' }),
      commit({ login: 'bob', date: '2026-08-02T10:00:00Z' }),
    ];

    const analysis = analyzeCommits(commits);
    expect(analysis.totalCommits).toBe(3);
    expect(analysis.dateRange).toEqual({ first: '2026-08-01', last: '2026-08-02' });
    expect(analysis.commitFrequency).toEqual([
      { date: '2026-08-01', count: 2 },
      { date: '2026-08-02', count: 1 },
    ]);
    expect(analysis.contributors).toEqual([
      { login: 'alice', count: 2 },
      { login: 'bob', count: 1 },
    ]);
    expect(analysis.busiestDays).toEqual(['2026-08-01']);
  });

  it('falls back to the author name when login is missing', () => {
    const analysis = analyzeCommits([commit({ name: 'Carol Danvers', date: '2026-08-01T10:00:00Z' })]);
    expect(analysis.contributors).toEqual([{ login: 'Carol Danvers', count: 1 }]);
  });

  it('handles an empty commit list', () => {
    const analysis = analyzeCommits([]);
    expect(analysis.totalCommits).toBe(0);
    expect(analysis.commitFrequency).toEqual([]);
    expect(analysis.contributors).toEqual([]);
    expect(analysis.busiestDays).toEqual([]);
    expect(analysis.dateRange).toBeNull();
  });
});

describe('buildSummaryPrompt', () => {
  it('includes the repo and contributor facts, and forbids invention', () => {
    const analysis = analyzeCommits([commit({ login: 'alice', date: '2026-08-01T10:00:00Z' })]);
    const prompt = buildSummaryPrompt(analysis, { owner: 'octo', repo: 'repo' });

    expect(prompt).toContain('octo/repo');
    expect(prompt).toContain('alice');
    expect(prompt).toContain('Total commits in the analyzed window: 1');
    expect(prompt.toLowerCase()).toContain('do not invent');
  });
});
