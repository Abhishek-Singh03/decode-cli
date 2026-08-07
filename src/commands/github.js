/**
 * src/commands/github.js
 * `decode github` group — GitHub activity analysis (PRD story 2).
 *
 * Subcommands: connect, profile, analyze.
 * - connect   verifies the stored token against GET /user (prompting to store
 *             one if absent).
 * - profile   shows the authenticated user's profile + commit record.
 * - analyze   runs the Repo Analyst over a repo's commits, optionally with an
 *             AI plain-English summary (graceful when no LLM is configured).
 */
import inquirer from 'inquirer';
import { Command } from 'commander';
import ora from 'ora';

import {
  getAuthenticatedUser,
  getGithubClient,
  getRepoCommits,
  listReposForUser,
  detectCurrentRepo,
  resolveRepoArg,
} from '../services/githubClient.js';
import { analyzeCommits, buildSummaryPrompt } from '../services/repoAnalyst.js';
import { generateSummary, isLlmConfigured } from '../services/llmClient.js';
import { saveConnection } from '../services/configStore.js';
import * as output from '../utils/output.js';

export function githubCommand() {
  return new Command('github')
    .description('GitHub activity analysis')
    .addCommand(connectCommand())
    .addCommand(profileCommand())
    .addCommand(analyzeCommand());
}

function connectCommand() {
  return new Command('connect')
    .description('Authenticate with GitHub (verifies the stored token)')
    .action(async () => {
      try {
        const client = getGithubClient();
        const user = await getAuthenticatedUser(client);
        output.success(`Authenticated as ${user.login}${user.name ? ` (${user.name})` : ''}`);
      } catch (err) {
        if (/No GitHub token/.test(err.message)) {
          const { token } = await inquirer.prompt([
            {
              type: 'password',
              name: 'token',
              message: 'Paste your GitHub personal access token:',
            },
          ]);
          try {
            saveConnection({ githubToken: token });
            const client = getGithubClient();
            const user = await getAuthenticatedUser(client);
            output.success(`Authenticated as ${user.login}${user.name ? ` (${user.name})` : ''}`);
          } catch (verifyErr) {
            output.error(`GitHub connection failed: ${verifyErr.message}`);
            process.exitCode = 1;
          }
          return;
        }
        output.error(`GitHub connection failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

function profileCommand() {
  return new Command('profile')
    .description('Show your GitHub profile and commit record')
    .action(async () => {
      try {
        const client = getGithubClient();
        const user = await getAuthenticatedUser(client);
        const spinner = process.stdout.isTTY ? ora('Fetching your repos...').start() : null;
        let repos = [];
        try {
          repos = await listReposForUser(client, { login: user.login });
        } finally {
          if (spinner) spinner.stop();
        }

        output.printBox(
          user.login,
          [
            user.name && `Name:        ${user.name}`,
            user.bio && `Bio:         ${user.bio}`,
            `Public repos: ${user.public_repos}`,
            `Followers:    ${user.followers}`,
            `Following:    ${user.following}`,
            `Profile:      ${user.html_url}`,
          ]
            .filter(Boolean)
            .join('\n'),
          { borderColor: 'green' },
        );

        if (repos.length > 0) {
          output.heading('Recently active repositories');
          output.printTable(
            ['Repo', 'Language', 'Last push'],
            repos.slice(0, 10).map((repo) => [
              `${repo.full_name}`,
              repo.language || '—',
              repo.pushed_at ? new Date(repo.pushed_at).toISOString().slice(0, 10) : '—',
            ]),
          );
        } else {
          output.info('No public repositories found for your account.');
        }
      } catch (err) {
        output.error(`github profile failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

function analyzeCommand() {
  return new Command('analyze')
    .description('Analyze repository activity (defaults to the current repo)')
    .argument('[repo]', 'Repository to analyze as "owner/repo" or a GitHub URL')
    .option('--json', 'Output machine-readable JSON to stdout')
    .option('--verbose', 'Log the exact outgoing LLM request URL and model')
    .action(async (repoArg, opts) => {
      try {
        const { owner, repo } = repoArg
          ? resolveRepoArg(repoArg)
          : detectCurrentRepo();

        const client = getGithubClient();

        const spinner = process.stdout.isTTY ? ora(`Analyzing ${owner}/${repo}...`).start() : null;
        let commits;
        try {
          commits = await getRepoCommits(client, { owner, repo });
        } finally {
          if (spinner) spinner.stop();
        }

        const analysis = analyzeCommits(commits);

        let summary = null;
        if (isLlmConfigured()) {
          const prompt = buildSummaryPrompt(analysis, { owner, repo });
          const llmSpinner = process.stdout.isTTY ? ora('Generating plain-English summary...').start() : null;
          try {
            summary = await generateSummary(prompt, { verbose: opts.verbose });
          } catch (err) {
            summary = null;
            output.warning(`AI summary unavailable (${err.message})`);
          } finally {
            if (llmSpinner) llmSpinner.stop();
          }
        }

        if (opts.json) {
          // summary is null when no LLM is configured or the call failed — the
          // JSON consumer reads that directly (nothing extra pollutes stdout).
          output.printJson({ repo: { owner, repo }, analysis, summary });
          return;
        }

        printHumanResults({ owner, repo }, analysis, summary, commits);
      } catch (err) {
        output.error(`github analyze failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

function printHumanResults({ owner, repo }, analysis, summary, commits) {
  output.heading(`${owner}/${repo}`);
  output.dim(
    `${analysis.totalCommits} commits analyzed` +
      (analysis.dateRange ? ` (${analysis.dateRange.first} → ${analysis.dateRange.last})` : ''),
  );

  if (analysis.contributors.length > 0) {
    output.heading('Contributors');
    output.printTable(
      ['#', 'Contributor', 'Commits'],
      analysis.contributors.map((c, i) => [String(i + 1), c.login, String(c.count)]),
    );
  } else {
    output.info('No contributors found in the analyzed window.');
  }

  output.heading('Commit frequency');
  output.dim('Busiest day(s): ' + (analysis.busiestDays.join(', ') || 'none'));
  output.dim('Daily frequency (most recent 7 days):');
  output.dim(
    analysis.commitFrequency
      .slice(-7)
      .map((d) => `${d.date}: ${d.count}`)
      .join('  '),
  );

  if (summary) {
    output.printBox('Summary', summary, { borderColor: 'magenta' });
  } else if (!isLlmConfigured()) {
    output.dim('No LLM configured — skipping AI summary. Run `decode init` to enable it.');
  }

  if (commits.length >= 500) {
    output.warning('Showing only the most recent ~500 commits.');
  }
}
