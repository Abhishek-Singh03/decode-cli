/**
 * src/commands/audit.js
 * `decode audit` — one command for a full health picture (PRD story 4).
 * Composes the API, docs, and repo-health checks into a single pass/fail
 * summary with a CI-friendly exit code (exit 1 when any check fails).
 */
import { Command } from 'commander';

import { runAudit } from '../services/auditRunner.js';
import { saveLastAudit } from '../services/configStore.js';
import * as output from '../utils/output.js';

export function auditCommand() {
  return new Command('audit')
    .description('Run all core checks (API, docs, repo) and report one combined summary')
    .option('--json', 'Output machine-readable JSON to stdout')
    .option('--ci', 'CI-friendly plain output with a strict exit code')
    .action(async (opts) => {
      try {
        const result = await runAudit();
        // Persist the summary so `decode status` can report the last run.
        saveLastAudit(result.summary);
        const components = [result.api, result.docs, result.repo];

        if (opts.json) {
          output.printJson(result);
        } else if (opts.ci) {
          for (const c of components) {
            output.plain(`${statusLabel(c.status)} ${c.name} — ${c.detail}`);
          }
          output.plain(
            `Summary: ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped`,
          );
        } else {
          output.heading('Audit');
          output.printTable(
            ['Check', 'Status', 'Detail'],
            components.map((c) => [c.name, statusLabel(c.status), c.detail]),
          );
          output.printBox(
            result.summary.ok ? 'Audit passed' : 'Audit failed',
            summaryLine(result.summary),
            { borderColor: result.summary.ok ? 'green' : 'red' },
          );
        }

        if (!result.summary.ok) process.exitCode = 1;
      } catch (err) {
        output.error(`audit failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

function statusLabel(status) {
  if (status === 'pass') return 'PASS';
  if (status === 'fail') return 'FAIL';
  return 'SKIP';
}

function summaryLine(summary) {
  const parts = [`${summary.passed} passed`, `${summary.failed} failed`, `${summary.skipped} skipped`];
  if (summary.skipped > 0) parts.push('(skipped checks don\'t affect the result)');
  return parts.join(' · ');
}
