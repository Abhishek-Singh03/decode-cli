/**
 * src/commands/init.js
 * `decode init` — interactive setup wizard (PRD story 6, AC1).
 *
 * Prompts for the LLM provider + API key and the GitHub token, then persists
 * via configStore. A flag-based, non-interactive path is provided so the
 * wizard is scriptable in CI/integration tests (AGENTS.md rules 5 & 8).
 */
import inquirer from 'inquirer';
import { Command } from 'commander';

import { saveConnection } from '../services/configStore.js';
import * as output from '../utils/output.js';

export function initCommand() {
  return new Command('init')
    .description('Interactive setup wizard — connect your LLM provider and GitHub')
    .option('--llm-provider <name>', 'LLM provider name (skips prompt)')
    .option('--llm-api-key <key>', 'LLM provider API key (skips prompt)')
    .option('--github-token <token>', 'GitHub personal access token (skips prompt)')
    .action(async (opts) => {
      try {
        const answers = await gatherCredentials(opts);
        saveConnection({
          llmProvider: answers.llmProvider,
          llmApiKey: answers.llmApiKey,
          githubToken: answers.githubToken,
        });
        output.success('DeCode is configured. Run `decode status` to verify.');
      } catch (err) {
        output.error(`init failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

/**
 * Returns the connection answers. When all values are supplied via flags the
 * wizard runs non-interactively; otherwise the missing ones are prompted for.
 */
async function gatherCredentials(flags) {
  const resolved = {
    llmProvider: flags.llmProvider,
    llmApiKey: flags.llmApiKey,
    githubToken: flags.githubToken,
  };

  const prompts = [];
  if (!resolved.llmProvider) {
    prompts.push({
      type: 'list',
      name: 'llmProvider',
      message: 'Which LLM provider do you use?',
      choices: ['anthropic', 'openai', 'groq', 'other'],
    });
  }
  if (!resolved.llmApiKey) {
    prompts.push({
      type: 'password',
      name: 'llmApiKey',
      message: 'Paste your LLM provider API key:',
    });
  }
  if (!resolved.githubToken) {
    prompts.push({
      type: 'password',
      name: 'githubToken',
      message: 'Paste your GitHub personal access token (blank to skip):',
    });
  }

  if (prompts.length === 0) return resolved;

  const answers = await inquirer.prompt(prompts);
  return { ...resolved, ...answers };
}
