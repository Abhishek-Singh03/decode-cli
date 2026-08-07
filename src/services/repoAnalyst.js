/**
 * src/services/repoAnalyst.js
 * The "Repo Analyst" custom agent (see AGENTS_AND_SKILLS.md): reads raw
 * commit/activity data and produces structured, human-readable summaries.
 * Read-only — it never writes anything; writing is handled elsewhere.
 *
 * Powers `decode github analyze` (data analysis + the plain-English summary
 * prompt). No LLM call happens here; the prompt is handed to the LLM client,
 * so nothing is fabricated when no model is configured.
 */

// ---------------------------------------------------------------------------
// Commit-quality heuristics — real signal, computed locally, no LLM involved.
// Each function operates on one commit object (octokit shape) and is unit
// tested in isolation so the analysis is provable independent of any provider.
// ---------------------------------------------------------------------------

/** True when the message is vague/short (patterns + <10 chars). */
export function isVagueCommitMessage(message) {
  const text = String(message || '').trim();
  if (text.length < 10) return true;
  return /^(update|updates|updated|change|changes|changed|fix|fixes|fixed|stuff|work|wip|done|minor|tweak|typo|no more|misc)$/i.test(text);
}

/**
 * True when a commit touches ONLY markdown files. Commits with no file detail
 * (e.g. from the list endpoint without stats) are not considered docs-only
 * since we cannot prove it.
 */
export function isDocsOnlyCommit(commit) {
  const files = commit.files;
  if (!Array.isArray(files) || files.length === 0) return false;
  return files.every((f) => /\.md$/i.test(f.filename ?? f.path ?? ''));
}

/** Total lines changed for a commit (additions + deletions), or null when unknown. */
export function commitChangeCount(commit) {
  const stats = commit.stats;
  if (stats && Number.isFinite(stats.additions) && Number.isFinite(stats.deletions)) {
    return stats.additions + stats.deletions;
  }
  const files = commit.files;
  if (!Array.isArray(files) || files.length === 0) return null;
  const total = files.reduce(
    (sum, f) => sum + (Number(f.additions) || 0) + (Number(f.deletions) || 0),
    0,
  );
  return Number.isFinite(total) && total >= 0 ? total : null;
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stddev(values) {
  const m = mean(values);
  return values.length ? Math.sqrt(values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length) : 0;
}

/**
 * Computes per-commit + aggregate quality metrics over a commit list:
 * docs-only count, vague-message count, average commit size, size outliers, and
 * commit-burst days (days with proportionally many commits vs the rest of range).
 */
export function analyzeCommitQuality(commits) {
  const dailyCounts = new Map();
  const detailed = commits.map((c) => {
    const date = (c.commit?.author?.date || '').slice(0, 10);
    if (date) dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
    return {
      sha: c.sha || '',
      date,
      docsOnly: isDocsOnlyCommit(c),
      vague: isVagueCommitMessage(c.commit?.message),
      size: commitChangeCount(c),
    };
  });

  const docsOnlyCount = detailed.filter((d) => d.docsOnly).length;
  const vagueMessageCount = detailed.filter((d) => d.vague).length;

  const sizes = detailed.map((d) => d.size).filter((s) => s !== null);
  const avgSize = sizes.length ? Math.round((sizes.reduce((a, b) => a + b, 0) / sizes.length) * 10) / 10 : null;
  const maxSize = sizes.length ? Math.max(...sizes) : null;
  const sizeMean = mean(sizes);
  const sizeSd = stddev(sizes);
  const outliers = detailed
    .filter((d) => d.size !== null && d.size > sizeMean + 2 * sizeSd && d.size > Math.max(10, 3 * sizeMean))
    .map((d) => ({ sha: d.sha, size: d.size, date: d.date }));

  const dayCounts = [...dailyCounts.entries()].map(([date, count]) => ({ date, count }));
  const dayMean = mean(dayCounts.map((d) => d.count));
  const daySd = stddev(dayCounts.map((d) => d.count));
  const bursts = dayCounts
    .filter((d) => d.count >= Math.max(2, dayMean + daySd) && daySd > 0)
    .map((d) => ({ date: d.date, count: d.count }));

  return {
    docsOnlyCount,
    vagueMessageCount,
    avgSize,
    maxSize,
    outliers,
    bursts,
    scanned: detailed.length,
  };
}

/**
 * Analyzes a list of commits (from octokit `listCommits`, optionally enriched
 * with file stats via githubClient.enrichCommits) into a structured summary:
 * total count, date range, daily commit frequency, contributor breakdown, the
 * busiest days, and the commit-quality heuristics from analyzeCommitQuality.
 */
export function analyzeCommits(commits) {
  const dailyCounts = new Map();
  const contributorCounts = new Map();
  const dates = [];

  for (const commit of commits) {
    const date = (commit.commit?.author?.date || '').slice(0, 10);
    const author = commit.author?.login || commit.commit?.author?.name || 'unknown';

    if (date) {
      dates.push(date);
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
    }
    contributorCounts.set(author, (contributorCounts.get(author) || 0) + 1);
  }

  const commitFrequency = [...dailyCounts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const contributors = [...contributorCounts.entries()]
    .map(([login, count]) => ({ login, count }))
    .sort((a, b) => b.count - a.count);

  const maxCount = commitFrequency.reduce((m, d) => Math.max(m, d.count), 0);
  const busiestDays = commitFrequency
    .filter((d) => d.count === maxCount && maxCount > 0)
    .map((d) => d.date);

  return {
    totalCommits: commits.length,
    dateRange:
      dates.length > 1
        ? { first: dates[0], last: dates[dates.length - 1] }
        : dates.length === 1
          ? { first: dates[0], last: dates[0] }
          : null,
    commitFrequency,
    contributors,
    busiestDays,
    quality: analyzeCommitQuality(commits),
  };
}

/** Builds the prompt handed to the LLM to produce the plain-English summary. */
export function buildSummaryPrompt(analysis, { owner, repo }) {
  const contributors = analysis.contributors
    .slice(0, 10)
    .map((c) => `${c.login}: ${c.count}`)
    .join(', ');
  const frequency = analysis.commitFrequency
    .slice(-14)
    .map((d) => `${d.date}: ${d.count}`)
    .join(', ');

  const q = analysis.quality;
  const outlierLine = q && q.outliers.length
    ? `- Size outliers: ${q.outliers.map((o) => `${o.sha.slice(0, 8)} (${o.size} lines)`).join(', ')}`
    : '- Size outliers: none';
  const burstLine = q && q.bursts.length
    ? `- Commit burst(s): ${q.bursts.map((b) => `${b.date} (${b.count} commits)`).join(', ')}`
    : '- Commit bursts: none';

  return [
    `You are the Repo Analyst. Summarize the recent activity of the GitHub repository ${owner}/${repo} in 3-5 plain-English sentences for a developer, and add a short assessment of commit hygiene grounded in the metrics below.`,
    'Facts (do not invent anything not present here):',
    `- Total commits in the analyzed window: ${analysis.totalCommits}`,
    `- Date range: ${analysis.dateRange ? `${analysis.dateRange.first} to ${analysis.dateRange.last}` : 'unknown'}`,
    `- Contributors by commit count: ${contributors || 'none'}`,
    `- Daily commit frequency (most recent up to 14 days): ${frequency || 'none'}`,
    `- Busiest day(s): ${analysis.busiestDays.join(', ') || 'none'}`,
    `- Docs-only commits: ${q ? `${q.docsOnlyCount} of ${Math.max(q.scanned, 0)}` : 'unknown'}`,
    `- Vague/low-quality commit messages: ${q ? q.vagueMessageCount : 'unknown'}`,
    `- Commit size (lines changed): average ${q && q.avgSize != null ? q.avgSize : 'n/a'}${q && q.maxSize != null ? `, largest ${q.maxSize}` : ''} (where file stats are available)`,
    outlierLine,
    burstLine,
    ``,
    `Write a concise, factual summary. Do not speculate about code content or intent that is not present in these facts. The commit-hygiene assessment must reference the actual metrics above (e.g. "3 of 30 commits were docs-only", "5 had vague messages", "commit sizes averaged X lines with a burst on <date>").`,
  ].join('\n');
}
