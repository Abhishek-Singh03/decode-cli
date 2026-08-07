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

/**
 * Analyzes a list of commits (from octokit `listCommits`) into a structured
 * summary: total count, date range, daily commit frequency, contributor
 * breakdown, and the busiest days.
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

  return [
    `You are the Repo Analyst. Summarize the recent activity of the GitHub repository ${owner}/${repo} in 3-5 plain-English sentences for a developer.`,
    `Facts (do not invent anything not present here):`,
    `- Total commits in the analyzed window: ${analysis.totalCommits}`,
    `- Date range: ${analysis.dateRange ? `${analysis.dateRange.first} to ${analysis.dateRange.last}` : 'unknown'}`,
    `- Contributors by commit count: ${contributors || 'none'}`,
    `- Daily commit frequency (most recent up to 14 days): ${frequency || 'none'}`,
    `- Busiest day(s): ${analysis.busiestDays.join(', ') || 'none'}`,
    ``,
    `Write a concise, factual summary. Do not speculate about code content or intent that is not present in these facts.`,
  ].join('\n');
}
