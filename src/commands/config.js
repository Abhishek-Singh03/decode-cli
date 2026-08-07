/**
 * src/commands/config.js
 * `decode config` — view and update configuration (README: list / set / reset).
 *
 * Secret boundary: this group only ever touches the metadata in
 * decode.config.json. Actual credentials live in .env and are managed by
 * `decode init` / `connect` / `disconnect` — nothing here reads or writes them
 * beyond reporting whether they are present.
 */
import inquirer from 'inquirer';
import { Command } from 'commander';

import {
  getConfigSummary,
  resetConfig,
  setConfigKey,
} from '../services/configStore.js';
import * as output from '../utils/output.js';

export function configCommand() {
  return new Command('config')
    .description('View or update configuration')
    .addCommand(configListCommand())
    .addCommand(configSetCommand())
    .addCommand(configResetCommand());
}

function configListCommand() {
  return new Command('list')
    .description('Show the current configuration (no secrets)')
    .option('--json', 'Output machine-readable JSON to stdout')
    .action((opts) => {
      try {
        const summary = getConfigSummary();
        if (opts.json) {
          output.printJson(summary);
          return;
        }
        output.printTable(
          ['Setting', 'Value'],
          [
            ['LLM provider', summary.llm.provider || '—'],
            ['LLM key ref', summary.llm.apiKeyRef],
            ['LLM configured', summary.llm.configured ? 'yes' : 'no'],
            ['GitHub token ref', summary.github.tokenRef],
            ['GitHub configured', summary.github.configured ? 'yes' : 'no'],
            ['Routes', summary.routes.length ? summary.routes.join(', ') : '—'],
            ['Config path', summary.configPath],
            ['Updated', summary.updatedAt || '—'],
          ],
        );
      } catch (err) {
        output.error(`config list failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

function configSetCommand() {
  return new Command('set')
    .description('Set a non-secret config value by dotted path (e.g. llm.provider openai)')
    .argument('<key>', 'Config key path, e.g. "llm.provider"')
    .argument('<value>', 'Value to set')
    .action((key, value) => {
      try {
        setConfigKey(key, value);
        output.success(`Set ${key} = ${value}`);
      } catch (err) {
        output.error(`config set failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

function configResetCommand() {
  return new Command('reset')
    .description('Reset the config file to defaults (credentials in .env are untouched)')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (opts) => {
      try {
        if (!opts.yes) {
          if (!process.stdin.isTTY || !process.stdout.isTTY) {
            output.error('Non-interactive terminal — pass `--yes` to confirm the reset.');
            process.exitCode = 1;
            return;
          }
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Reset decode.config.json to defaults? (stored credentials in .env are kept)',
              default: false,
            },
          ]);
          if (!confirm) {
            output.info('Skipped — configuration was kept.');
            return;
          }
        }
        resetConfig();
        output.success('Configuration reset to defaults.');
        output.dim('Credentials in .env are untouched. Run `decode disconnect` to remove them.');
      } catch (err) {
        output.error(`config reset failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}
