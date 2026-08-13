/**
 * src/commands/status.js
 * `decode status` — show current connection state and the last audit result
 * (PRD story 6, AC2). Reads the config store and prints the connection state,
 * config path, and the summary persisted by `decode audit`.
 */
import { Command } from 'commander';

import { getConnection, getLastAudit, SCOPE_GLOBAL, SCOPE_LOCAL } from '../services/configStore.js';
import * as output from '../utils/output.js';

export function executeStatus() {
  try {
    const conn = getConnection();
    const lastAudit = getLastAudit();
    const withScope = (value, scope) => (value ? `${value} (${scope})` : '—');
    output.printTable(
      ['Setting', 'Value'],
      [
        ['LLM provider', withScope(conn.llmProvider || null, scopeLabel(conn.llmProviderScope))],
        ['LLM key', conn.llmConfigured ? `**** (${scopeLabel(conn.llmKeyScope)})` : 'no'],
        ['LLM configured', conn.llmConfigured ? 'yes' : 'no'],
        ['GitHub token', conn.githubConfigured ? `**** (${scopeLabel(conn.githubKeyScope)})` : 'no'],
        ['GitHub configured', conn.githubConfigured ? 'yes' : 'no'],
        ['Config path', conn.configPath],
        ['Global config', conn.globalConfigPath],
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
}

export function statusCommand() {
  return new Command('status')
    .description('Show current connection state and which config scope each value came from')
    .action(() => executeStatus());
}

function scopeLabel(scope) {
  return scope === SCOPE_GLOBAL ? 'global' : scope === SCOPE_LOCAL ? 'local' : '—';
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
