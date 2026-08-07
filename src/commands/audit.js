/**
 * src/commands/audit.js
 * `decode audit` — Reference implementation for DeCode command architecture.
 *
 * This is the gold standard. Every command should follow this pattern:
 * 1. No direct console output
 * 2. Build content using UI components
 * 3. Render through renderer
 * 4. Use Health Pulse for status visualization
 * 5. Show observable progress
 * 6. Follow Verdict → Evidence → Action hierarchy
 * 7. End with Next Actions
 */
import { Command } from 'commander';
import * as ui from '../ui/index.js';
import * as renderer from '../ui/renderer.js';
import { runAudit } from '../services/auditRunner.js';
import { saveLastAudit } from '../services/configStore.js';

export function auditCommand() {
  return new Command('audit')
    .description('Run all core checks (API, docs, repo) and report one combined summary')
    .option('--json', 'Output machine-readable JSON to stdout')
    .option('--ci', 'CI-friendly plain output with a strict exit code')
    .action(async (opts) => {
      try {
        await executeAudit(opts);
      } catch (err) {
        renderError(err);
        process.exitCode = 1;
      }
    });
}

/**
 * Execute the audit flow with rendering.
 */
async function executeAudit(opts) {
  // JSON output bypasses UI rendering
  if (opts.json) {
    const result = await runAudit();
    saveLastAudit(result.summary);
    renderer.render(JSON.stringify(result, null, 2));
    if (!result.summary.ok) process.exitCode = 1;
    return;
  }

  // CI output uses simplified rendering
  if (opts.ci) {
    const result = await runAudit();
    saveLastAudit(result.summary);
    renderCiOutput(result);
    if (!result.summary.ok) process.exitCode = 1;
    return;
  }

  // Standard interactive output — the reference implementation
  await renderInteractiveAudit();
}

/**
 * Render the interactive audit — the reference implementation.
 * This showcases every major UI primitive in a real-world scenario.
 *
 * Pattern: Verdict → Evidence → Action
 */
async function renderInteractiveAudit() {
  // Stage 1: Show progress (observable work)
  const stages = renderer.progressive();
  stages.stage(ui.body('Preparing diagnostics...'));

  // Execute audit
  const result = await runAudit();

  // Persist for status command
  saveLastAudit(result.summary);

  stages.finish();

  // Stage 2: Build screen content using Verdict → Evidence → Action pattern

  // --- HEALTH PULSE: Visual signature (DeCode identity) ---
  const healthStatuses = [result.api.status, result.docs.status, result.repo.status];
  const healthPulse = ui.space('tight') + ui.statusDots(healthStatuses) + '\n';

  // --- VERDICT: Status rows (the truth) ---
  const statusRows = [
    ui.statusRow({
      status: result.api.status,
      label: result.api.name,
      verdict: parseVerdict(result.api.detail),
      detail: parseDetail(result.api.detail),
      labelWidth: 12,
      verdictWidth: 28,
    }),
    ui.statusRow({
      status: result.docs.status,
      label: result.docs.name,
      verdict: parseVerdict(result.docs.detail),
      detail: parseDetail(result.docs.detail),
      labelWidth: 12,
      verdictWidth: 28,
    }),
    ui.statusRow({
      status: result.repo.status,
      label: result.repo.name,
      verdict: parseVerdict(result.repo.detail),
      detail: parseDetail(result.repo.detail),
      labelWidth: 12,
      verdictWidth: 28,
    }),
  ].join('\n');

  // --- EVIDENCE: Summary line (the count) ---
  const summaryLine = ui.statusSummary({
    passed: result.summary.passed,
    warning: result.summary.failed, // Map failed to warning
    critical: 0,
    skipped: result.summary.skipped,
  });

  // --- ACTION: Next steps ---
  const actions = buildActions(result);
  const warnings = buildWarnings(result);

  // Compose screen content
  const overallVerdict = result.summary.ok ? '✓ Audit passed' : '✗ Audit failed';
  const content = [
    healthPulse,
    overallVerdict,
    ui.space('tight'),
    'Project Health',
    ui.space('normal'),
    statusRows,
    ui.space('normal'),
    summaryLine,
  ];

  // Add actions if present
  if (actions) {
    content.push(ui.space('normal'));
    content.push(actions);
  }

  // Add warnings if present
  if (warnings) {
    content.push(ui.space('normal'));
    content.push(warnings);
  }

  content.push(ui.space('tight'));

  // --- RENDER ---
  renderer.render(content.join(''));

  // Set exit code
  if (!result.summary.ok) {
    process.exitCode = 1;
  }
}

/**
 * Parse verdict from detail string.
 * Pattern: "verdict — detail" or "verdict"
 */
function parseVerdict(detail) {
  // Handle skip cases with cleaner wording
  if (detail.includes('no routes')) return 'not configured';
  if (detail.includes('no documentation')) return 'not configured';
  if (detail.includes('not a git')) return 'not a repository';

  // Split on separators
  if (detail.includes(':')) {
    return detail.split(':')[0].trim();
  }

  if (detail.includes('—')) {
    return detail.split('—')[0].trim();
  }

  // If short enough, return as-is
  if (detail.length < 30) {
    return detail;
  }

  // Take first part
  const words = detail.split(' ');
  return words.slice(0, 3).join(' ');
}

/**
 * Parse detail from detail string.
 * Returns the secondary information after separator.
 */
function parseDetail(detail) {
  // Extract detail after ":"
  if (detail.includes(':')) {
    const parts = detail.split(':');
    const detailPart = parts.slice(1).join(':').trim();

    // Truncate long file lists
    if (detailPart.length > 80) {
      const files = detailPart.split(',');
      if (files.length > 3) {
        return `${files.length} files modified`;
      }
    }

    return detailPart;
  }

  // Extract detail after "—"
  if (detail.includes('—')) {
    return detail.split('—').slice(1).join('—').trim();
  }

  return '';
}

/**
 * Build action suggestions based on audit results.
 */
function buildActions(result) {
  const actions = [];

  // Priority 1: Fix failures
  if (result.api.status === 'fail') {
    actions.push({
      command: 'decode api check',
      description: 'debug failing routes',
    });
  }

  if (result.docs.status === 'fail') {
    actions.push({
      command: 'decode doc',
      description: 'regenerate documentation',
    });
  }

  if (result.repo.status === 'fail') {
    actions.push({
      command: 'decode github analyze',
      description: 'review repository activity',
    });
  }

  // Priority 2: Fix skipped items
  if (result.api.status === 'skipped') {
    actions.push({
      command: 'decode api list',
      description: 'detect backend API routes',
    });
  }

  // Priority 3: All good — suggest next steps
  if (actions.length === 0 && result.summary.ok) {
    actions.push({
      command: 'decode github analyze',
      description: 'view recent activity',
    });
    actions.push({
      command: 'decode status',
      description: 'check configuration',
    });
  }

  return actions.length > 0 ? ui.nextActions(actions) : null;
}

/**
 * Build warnings for non-critical failures.
 * Only show warnings that provide actionable insight.
 */
function buildWarnings(result) {
  const warnings = [];

  // Documentation warning
  if (result.docs.status === 'fail') {
    const hasStaleFiles = result.docs.detail.includes('modified after');
    if (hasStaleFiles) {
      warnings.push(
        ui.warningPrompt({
          message: 'Documentation is out of sync with recent code changes.',
          impact: "This won't block your workflow, but might confuse new contributors.",
          action: {
            command: 'decode doc',
            description: 'regenerate documentation',
          },
        })
      );
    }
  }

  // API warning (only if multiple routes failed)
  if (result.api.status === 'fail') {
    const match = result.api.detail.match(/(\d+)\s+of\s+(\d+)/);
    if (match) {
      const failed = parseInt(match[1], 10);
      const total = parseInt(match[2], 10);

      if (failed > 1) {
        warnings.push(
          ui.warningPrompt({
            message: `${failed} of ${total} API routes are failing.`,
            impact: 'This may indicate backend issues or network problems.',
            action: {
              command: 'decode api check',
              description: 'view detailed diagnostics',
            },
          })
        );
      }
    }
  }

  // Repository warning (only for staleness, not missing)
  if (result.repo.status === 'fail' && result.repo.detail.includes('days old')) {
    warnings.push(
      ui.warningPrompt({
        message: 'Repository has not been updated recently.',
        impact: 'Last commit exceeds the staleness threshold (90 days).',
      })
    );
  }

  return warnings.length > 0 ? warnings.join('\n\n') : null;
}

/**
 * Render CI-friendly output.
 * Plain text, no colors, parseable format.
 */
function renderCiOutput(result) {
  const lines = [];
  const components = [result.api, result.docs, result.repo];

  for (const component of components) {
    const label = component.status === 'pass' ? 'PASS' :
                 component.status === 'fail' ? 'FAIL' :
                 'SKIP';

    lines.push(`${label} ${component.name}`);
  }

  lines.push('');
  lines.push(`Summary: ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped`);

  renderer.render(lines.join('\n'));
}

/**
 * Render error screen with recovery actions.
 */
function renderError(err) {
  const error = ui.errorPrompt({
    type: 'Audit failed',
    explanation: err.message || 'An unexpected error occurred during the audit.',
    actions: [
      { command: 'decode status', description: 'check configuration' },
      { command: 'decode --help', description: 'view available commands' },
    ],
  });

  renderer.render({
    type: 'error',
    command: 'decode audit',
    error,
  });
}
