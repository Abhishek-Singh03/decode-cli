/**
 * src/commands/status.js
 * `decode status` — show current connection state and the last audit result
 * (PRD story 6, AC2). Reads the config store and prints the connection state,
 * config path, and the summary persisted by `decode audit`.
 */
import { Command } from 'commander';

import { getConnection, getLastAudit } from '../services/configStore.js';
import * as output from '../utils/output.js';

export function statusCommand() {
  return new Command('status')
    .description('Show current connection state')
    .action(() => {
      try {
        const conn = getConnection();
        const lastAudit = getLastAudit();
        output.printTable(
          ['Setting', 'Value'],
          [
            ['LLM provider', conn.llmProvider || '—'],
            ['LLM configured', conn.llmConfigured ? 'yes' : 'no'],
            ['GitHub configured', conn.githubConfigured ? 'yes' : 'no'],
            ['Config path', conn.configPath],
            ['Last audit', lastAuditLabel(lastAudit)],
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

function lastAuditLabel(audit) {
  if (!audit) return 'Not run yet — try `decode audit`';
  const verdict = audit.ok ? 'PASS' : 'FAIL';
  return `${verdict} — ${audit.passed} passed, ${audit.failed} failed, ${audit.skipped} skipped (${formatTime(audit.ranAt)})`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
