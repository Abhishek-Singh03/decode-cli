/**
 * test/unit/repoAnalyst.test.js
 * Unit tests for the Repo Analyst custom agent (data analysis + prompt).
 */
import { describe, it, expect } from 'vitest';

import {
  analyzeCommits,
  analyzeCommitQuality,
  buildSummaryPrompt,
  commitChangeCount,
  isDocsOnlyCommit,
  isVagueCommitMessage,
} from '../../src/services/repoAnalyst.js';

function commit({ sha, login, name, date, message = 'Implement something useful', files = null, stats = null }) {
  const base = {
    sha,
    commit: { author: { name, date }, message },
    author: login ? { login } : null,
  };
  if (files) base.files = files;
  if (stats) base.stats = stats;
  return base;
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

describe('commit quality heuristics', () => {
  describe('isVagueCommitMessage', () => {
    it('flags short and filler messages', () => {
      expect(isVagueCommitMessage('update')).toBe(true);
      expect(isVagueCommitMessage('fix stuff')).toBe(true);
      expect(isVagueCommitMessage('changes')).toBe(true);
      expect(isVagueCommitMessage('wip')).toBe(true);
      expect(isVagueCommitMessage('typo')).toBe(true);
      expect(isVagueCommitMessage('')) .toBe(true);
    });

    it('allows specific descriptive messages', () => {
      expect(isVagueCommitMessage('Implement async pagination for the API client')).toBe(false);
      expect(isVagueCommitMessage('Add unit test for the config store merge')).toBe(false);
    });
  });

  describe('isDocsOnlyCommit', () => {
    it('is true only when every touched file is markdown', () => {
      expect(isDocsOnlyCommit(commit({ files: [{ filename: 'README.md' }, { filename: 'docs/auth.md' }] }))).toBe(true);
    });

    it('is false when code files are touched', () => {
      expect(isDocsOnlyCommit(commit({ files: [{ filename: 'README.md' }, { filename: 'src/index.js' }] }))).toBe(false);
    });

    it('is false when no file detail is known', () => {
      expect(isDocsOnlyCommit(commit({}))).toBe(false);
    });
  });

  describe('commitChangeCount', () => {
    it('sums additions + deletions from stats', () => {
      const c = commit({ stats: { additions: 12, deletions: 3 } });
      expect(commitChangeCount(c)).toBe(15);
    });

    it('falls back to summing per-file additions/deletions', () => {
      const c = commit({
        files: [
          { filename: 'a.js', additions: 4, deletions: 1 },
          { filename: 'b.js', additions: 2, deletions: 5 },
        ],
      });
      expect(commitChangeCount(c)).toBe(12);
    });

    it('returns null when nothing is known', () => {
      expect(commitChangeCount(commit({}))).toBeNull();
    });
  });

  describe('analyzeCommitQuality', () => {
    const date = (d) => `2026-08-0${d}T10:00:00Z`;

    it('summarizes docs-only, vague, and size metrics and flags the size outlier', () => {
      const commits = [
        commit({ sha: 'd1', date: date(2), files: [{ filename: 'README.md' }] }),
        commit({ sha: 'd2', date: date(2), files: [{ filename: 'docs/auth.md' }] }),
        ...[1, 2, 3, 4].map((i) =>
          commit({ sha: `s${i}`, date: date(3), message: 'Harden request error handling', stats: { additions: 3, deletions: 0 } }),
        ),
        commit({ sha: 'huge', date: date(3), message: 'Import the legacy migration', stats: { additions: 600, deletions: 300 } }),
        commit({ sha: 'v1', date: date(4), message: 'update' }),
        commit({ sha: 'v2', date: date(4), message: 'changes' }),
        commit({ sha: 'v3', date: date(4), message: 'fix stuff' }),
        commit({ sha: 'v4', date: date(4), message: 'wip' }),
      ];

      const q = analyzeCommitQuality(commits);
      expect(q.docsOnlyCount).toBe(2);
      expect(q.vagueMessageCount).toBe(4);
      expect(q.avgSize).toBeGreaterThan(0);
      expect(q.outliers.some((o) => o.sha === 'huge' && o.size === 900)).toBe(true);
    });

    it('detects a commit-burst day that outpaces the rest of the range', () => {
      const bursts =
        analyzeCommitQuality([
          ...[1, 2, 3, 4, 5, 6].map((i) => commit({ sha: `b${i}`, date: date(1), message: 'Wait for the build to finish' })),
          commit({ sha: 'q1', date: date(2), message: 'Polish the CLI output' }),
        ]).bursts;

      expect(bursts.some((b) => b.date === '2026-08-01' && b.count === 6)).toBe(true);
    });

    it('degrades to sensible zeros when no file/stats are available', () => {
      const q = analyzeCommitQuality([
        commit({ sha: 'x', date: date(1), message: 'Add an explicit documentation index' }),
      ]);
      expect(q.docsOnlyCount).toBe(0);
      expect(q.vagueMessageCount).toBe(0);
      expect(q.avgSize).toBeNull();
      expect(q.outliers).toEqual([]);
    });
  });

  it('analyzeCommits includes the quality metrics for the prompt', () => {
    const commits = [
      commit({ sha: 'a', date: '2026-08-01T10:00:00Z', message: 'update', stats: { additions: 4, deletions: 4 } }),
      commit({ sha: 'b', date: '2026-08-01T11:00:00Z', files: [{ filename: 'README.md' }] }),
    ];
    const analysis = analyzeCommits(commits);
    expect(analysis.quality.docsOnlyCount).toBe(1);
    expect(analysis.quality.vagueMessageCount).toBe(1);
    expect(buildSummaryPrompt(analysis, { owner: 'octo', repo: 'repo' })).toContain('docs-only');
  });
});
