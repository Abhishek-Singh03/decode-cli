/**
 * src/commands/status.js
 * `decode status` — show current connection state and the last audit result
 * (PRD story 6, AC2). Reads the config store and prints the connection state,
 * config path, and the summary persisted by `decode audit`.
 *
 * Presentation migrated to the rendering engine (Task H.1). Follows the
 * `audit.js` gold-standard pattern: build content with UI components, render
 * through `renderer.render()`, and surface failures via `renderError()`.
 */
import { Command } from 'commander';
import * as ui from '../ui/index.js';
import * as renderer from '../ui/renderer.js';
import { getConnection, getLastAudit, SCOPE_GLOBAL, SCOPE_LOCAL } from '../services/configStore.js';

export function executeStatus() {
  try {
    const conn = getConnection();
    const lastAudit = getLastAudit();
    const withScope = (value, scope) => (value ? `${value} (${scope})` : '—');

    const rows = [
      { label: 'LLM provider', value: withScope(conn.llmProvider || null, scopeLabel(conn.llmProviderScope)) },
      { label: 'LLM key', value: conn.llmConfigured ? `**** (${scopeLabel(conn.llmKeyScope)})` : 'no' },
      { label: 'LLM configured', value: conn.llmConfigured ? 'yes' : 'no' },
      { label: 'GitHub token', value: conn.githubConfigured ? `**** (${scopeLabel(conn.githubKeyScope)})` : 'no' },
      { label: 'GitHub configured', value: conn.githubConfigured ? 'yes' : 'no' },
      { label: 'Config path', value: conn.configPath },
      { label: 'Global config', value: conn.globalConfigPath },
      { label: 'Last audit', value: lastAuditLabel(lastAudit) },
    ];

    const connectionRow = conn.connected
      ? ui.statusRow({ status: 'pass', label: 'connection', verdict: 'ready', detail: 'configured' })
      : ui.statusRow({ status: 'warn', label: 'connection', verdict: 'not configured', detail: 'run `decode init`' });

    const content = [
      ui.space('tight'),
      ui.keyValueList(rows),
      ui.space('normal'),
      connectionRow,
    ].join('\n');

    if (conn.connected) {
      renderer.render({
        type: 'success',
        command: 'decode status',
        confirmation: 'Connection looks good.',
        metadata: content,
      });
    } else {
      renderer.render({
        command: 'decode status',
        context: '— connection state',
        content,
        actions: ui.hint('decode init', 'connect your LLM provider and GitHub'),
      });
    }
  } catch (err) {
    renderError(err);
    process.exitCode = 1;
  }
}

export function statusCommand() {
  return new Command('status')
    .description('Show current connection state and which config scope each value came from')
    .action(() => executeStatus());
}

/**
 * Render an error screen with a recovery action back to init/status.
 */
function renderError(err) {
  const error = ui.errorPrompt({
    type: 'Status failed',
    explanation: err.message || 'Unable to read the connection state.',
    actions: [
      { command: 'decode init', description: 'connect your LLM provider and GitHub' },
    ],
  });

  renderer.render({
    type: 'error',
    command: 'decode status',
    error,
  });
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
