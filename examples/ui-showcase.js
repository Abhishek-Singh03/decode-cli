#!/usr/bin/env node
/**
 * examples/ui-showcase.js
 * Living design reference for DeCode UI.
 *
 * This is NOT a demo. This is the single source of truth for how DeCode looks.
 * Every screen, every component, every state is rendered here.
 *
 * Run: node examples/ui-showcase.js [screen-name]
 *
 * Available screens:
 * - launch
 * - status
 * - audit
 * - api
 * - github
 * - doc
 * - error
 * - warning
 * - success
 * - empty
 * - progress
 * - review
 * - all (default)
 */

import * as ui from '../src/ui/index.js';
import * as renderer from '../src/ui/renderer.js';

// ============================================================================
// Screen 1: Launch
// ============================================================================

function renderLaunch() {
  const services = [
    { name: 'anthropic', connected: true },
    { name: 'github', connected: true },
  ];

  const content = [
    ui.brand('decode'),
    ui.connectionPulse({ services }),
    '',
    ui.metadata('   Last audit   ●  2 passed, 1 warning — 6h ago'),
    ui.metadata('   Config       /Users/dev/project/decode.config.json'),
    '',
    '',
    ui.body('   Ready.'),
  ].join('\n');

  return {
    type: 'launch',
    content,
  };
}

// ============================================================================
// Screen 2: Status
// ============================================================================

function renderStatus() {
  const items = [
    { label: 'anthropic', value: `${ui.statusDot('pass')}  connected` },
    { label: 'github', value: `${ui.statusDot('pass')}  connected` },
    { label: 'routes', value: '3 configured' },
  ];

  const content = [
    ui.keyValueList(items),
    '',
    '',
    ui.emphasis('   Last audit     ') + '2 passed · 1 warning · 0 critical',
    ui.metadata('                  6 hours ago'),
    '',
    '',
    ui.nextActions([
      { command: 'decode audit', description: 'run full check' },
      { command: 'decode api check', description: 'check routes only' },
    ]),
  ].join('\n');

  return {
    command: 'decode status',
    content,
  };
}

// ============================================================================
// Screen 3: Audit
// ============================================================================

function renderAudit() {
  const items = [
    { status: 'pass', label: 'api', verdict: '5/5 routes passing', detail: 'avg 23ms' },
    { status: 'warn', label: 'docs', verdict: 'stale', detail: 'src/commands/api.js modified 2h ago' },
    { status: 'pass', label: 'repo', verdict: 'healthy', detail: 'last commit 6h ago' },
  ];

  const content = [
    ui.statusList(items),
    '',
    '',
    ui.statusSummary({ passed: 2, warning: 1, critical: 0 }),
  ].join('\n');

  return {
    command: 'decode audit',
    context: '— project health',
    content,
  };
}

// ============================================================================
// Screen 4: API Check
// ============================================================================

function renderAPICheck() {
  const routes = [
    { url: 'https://api.example.com/users', status: 200, time: 18, result: 'pass' },
    { url: 'https://api.example.com/posts', status: 200, time: 24, result: 'pass' },
    { url: 'https://api.example.com/comments', status: 404, time: 31, result: 'warn' },
    { url: 'https://api.example.com/tags', status: 200, time: 19, result: 'pass' },
    { url: 'https://api.example.com/analytics', status: null, time: 0, result: 'fail' },
  ];

  const lines = routes.map(route => {
    const dot = ui.statusDot(route.result);
    const statusText = route.status !== null ? String(route.status) : 'timeout';
    const timeText = route.status !== null ? `${route.time}ms` : '';

    return ui.alignRow(
      `${dot}  ${route.url}`,
      `${statusText}    ${ui.metadata(timeText)}`,
      80
    );
  });

  const content = [
    ...lines,
    '',
    '',
    ui.statusSummary({ passed: 3, warning: 1, critical: 1 }),
    '',
    '',
    ui.hint('decode api check --spec openapi.json', 'validate response schemas'),
  ].join('\n');

  return {
    command: 'decode api check',
    content,
  };
}

// ============================================================================
// Screen 5: GitHub Analysis
// ============================================================================

function renderGitHubAnalysis() {
  const contributors = [
    { login: 'phewww', count: 32 },
    { login: 'contributor2', count: 9 },
    { login: 'contributor3', count: 6 },
  ];

  const content = [
    ui.alignRow(
      ui.emphasis('   anthropics/decode-cli'),
      ui.metadata('47 commits'),
      80
    ),
    '',
    ui.contributorTable(contributors),
    '',
    ui.alignRow(
      ui.metadata('   Last 7 days'),
      '●●●○○●● (4 active days)',
      80
    ),
    ui.alignRow(
      ui.metadata('   Peak day'),
      ui.metadata('aug 5 — 12 commits'),
      80
    ),
    '',
    '',
    ui.aiSummary(
      'The repository shows consistent daily activity with phewww as the primary contributor. Recent work focuses on API health checking and documentation generation features.'
    ),
    '',
    '',
    ui.hint('decode github analyze --json', 'export raw data'),
  ].join('\n');

  return {
    command: 'decode github analyze',
    content,
  };
}

// ============================================================================
// Screen 6: Documentation
// ============================================================================

function renderDocumentation() {
  const markdown = `# DeCode — Architecture

## Overview
DeCode is a developer productivity CLI that provides...

## Structure
- bin/ — CLI entry point
- src/commands/ — Command handlers
...`;

  const content = [
    ui.scanningIndicator('Scanning project', 78),
    ui.completionMessage('Generating documentation'),
    '',
    '',
    ui.docPreview(markdown, 15),
    '',
    '',
    ui.confirmPrompt('Write to docs/architecture.md?'),
    ui.actionOptions([
      { key: 'y', description: 'write file' },
      { key: 'n', description: 'cancel' },
      { key: 'e', description: 'edit prompt and regenerate' },
    ]),
  ].join('\n');

  return {
    command: 'decode doc',
    content,
  };
}

// ============================================================================
// Screen 7: Error
// ============================================================================

function renderError() {
  const error = ui.errorPrompt({
    type: 'Network unreachable',
    explanation: 'All 5 routes failed to respond.\nCheck your network connection or verify endpoints are running.',
    actions: [
      { command: 'decode api list', description: 'show configured routes' },
      { command: 'decode status', description: 'check connection state' },
    ],
  });

  return {
    type: 'error',
    command: 'decode api check',
    error,
  };
}

// ============================================================================
// Screen 8: Warning
// ============================================================================

function renderWarning() {
  const items = [
    { status: 'pass', label: 'api', verdict: '5/5 routes passing', detail: 'avg 23ms' },
    { status: 'warn', label: 'docs', verdict: 'stale', detail: 'src/commands/api.js modified 2h ago' },
    { status: 'pass', label: 'repo', verdict: 'healthy', detail: 'last commit 6h ago' },
  ];

  const warning = ui.warningPrompt({
    message: 'Documentation is out of sync with recent code changes.',
    impact: "This won't block your workflow, but might confuse new contributors.",
    action: { command: 'decode doc', description: 'regenerate documentation' },
  });

  const content = [
    ui.statusList(items),
    '',
    '',
    ui.statusSummary({ passed: 2, warning: 1, critical: 0 }),
    '',
    '',
    warning,
  ].join('\n');

  return {
    command: 'decode audit',
    context: '— project health',
    content,
  };
}

// ============================================================================
// Screen 9: Success
// ============================================================================

function renderSuccess() {
  const metadata = [
    `${ui.statusDot('pass')}  2,847 characters`,
    `${ui.statusDot('pass')}  4 sections (Overview, Structure, Key Files, Notes)`,
    `${ui.statusDot('pass')}  Based on 78 project files`,
  ].join('\n');

  return {
    type: 'success',
    command: 'decode doc',
    confirmation: 'Documentation written to docs/architecture.md',
    metadata,
    suggestion: 'You can commit this now or review it first.',
  };
}

// ============================================================================
// Screen 10: Empty State
// ============================================================================

function renderEmpty() {
  return {
    type: 'empty',
    command: 'decode api list',
    message: 'No routes configured yet.',
    actions: ui.nextActions([
      { command: 'decode api add <url>', description: 'add your first route' },
      { command: 'decode init', description: 'run setup wizard' },
    ]),
  };
}

// ============================================================================
// Screen 11: Progress (Long-running Task)
// ============================================================================

function renderProgress() {
  const content = [
    ui.progressCounter({
      label: 'Fetching commits',
      current: 347,
      total: 500,
    }),
  ].join('\n');

  return {
    command: 'decode github analyze',
    content,
  };
}

// ============================================================================
// Screen 12: Project Review
// ============================================================================

function renderProjectReview() {
  const healthItems = [
    { status: 'pass', name: 'api', detail: '5/5 routes passing, avg 23ms' },
    { status: 'warn', name: 'docs', detail: 'stale, last updated 6h ago' },
    { status: 'pass', name: 'repo', detail: 'healthy, last commit 6h ago' },
  ];

  const content = [
    ui.emphasis('   anthropics/decode-cli'),
    '',
    '',
    ui.healthPulse({
      label: 'health',
      items: healthItems,
      summary: '2 passed, 1 warning',
    }),
    '',
    ui.activityPulse({
      label: 'activity',
      commits: 47,
      contributors: 3,
      pattern: '●●●○○●●',
      peak: 'aug 5 — 12 commits',
    }),
    '',
    '',
    ui.nextActions([
      { command: 'decode audit', description: 'run full health check' },
      { command: 'decode github analyze', description: 'detailed activity report' },
    ]),
  ].join('\n');

  return {
    command: 'decode',
    content,
  };
}

// ============================================================================
// Showcase Runner
// ============================================================================

const screens = {
  launch: { name: 'Launch', render: renderLaunch },
  status: { name: 'Status', render: renderStatus },
  audit: { name: 'Audit', render: renderAudit },
  api: { name: 'API Check', render: renderAPICheck },
  github: { name: 'GitHub Analysis', render: renderGitHubAnalysis },
  doc: { name: 'Documentation', render: renderDocumentation },
  error: { name: 'Error', render: renderError },
  warning: { name: 'Warning', render: renderWarning },
  success: { name: 'Success', render: renderSuccess },
  empty: { name: 'Empty State', render: renderEmpty },
  progress: { name: 'Progress', render: renderProgress },
  review: { name: 'Project Review', render: renderProjectReview },
};

function renderShowcase(screenKey) {
  const screenDef = screens[screenKey];

  if (!screenDef) {
    console.error(`Unknown screen: ${screenKey}`);
    console.error(`Available: ${Object.keys(screens).join(', ')}, all`);
    process.exit(1);
  }

  console.log('\n' + '─'.repeat(80));
  console.log(ui.emphasis(`  ${screenDef.name}`));
  console.log('─'.repeat(80));

  const screenConfig = screenDef.render();
  renderer.render(screenConfig);

  console.log('─'.repeat(80) + '\n');
}

function renderAll() {
  for (const [key, screenDef] of Object.entries(screens)) {
    console.log('\n' + '═'.repeat(80));
    console.log(ui.emphasis(`  ${screenDef.name}`));
    console.log('═'.repeat(80));

    const screenConfig = screenDef.render();
    renderer.render(screenConfig);

    console.log('═'.repeat(80) + '\n');
  }
}

// Main
const args = process.argv.slice(2);
const target = args[0] || 'all';

if (target === 'all') {
  renderAll();
} else {
  renderShowcase(target);
}
