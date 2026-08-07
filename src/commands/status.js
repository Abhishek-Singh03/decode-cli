/**
 * src/commands/status.js
 * `decode status` — show current connection state (PRD story 6, AC2).
 * Reads the config store and prints connection state + config path.
 * (Last audit result will be shown here once the `audit` command lands.)
 */
import { Command } from 'commander';

import { getConnection } from '../services/configStore.js';
import * as output from '../utils/output.js';

export function statusCommand() {
  return new Command('status')
    .description('Show current connection state')
    .action(() => {
      try {
        const conn = getConnection();
        output.printTable(
          ['Setting', 'Value'],
          [
            ['LLM provider', conn.llmProvider || '—'],
            ['LLM configured', conn.llmConfigured ? 'yes' : 'no'],
            ['GitHub configured', conn.githubConfigured ? 'yes' : 'no'],
            ['Config path', conn.configPath],
          ],
        );
        if (conn.connected) {
          output.success('Connection looks good.');
        } else {
          output.info('Not connected yet. Run `decode init` to get started.');
        }
      } catch (err) {
        output.error(`status failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}
