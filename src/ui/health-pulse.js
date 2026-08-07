/**
 * src/ui/health-pulse.js
 * HealthPulse component — compact visual health indicators.
 *
 * Philosophy: Health should be scannable. Dots form patterns.
 * You see the shape before you read the words.
 */
import { statusDot, statusDots } from './status.js';
import { space, alignRow } from './layout.js';
import * as type from './typography.js';

/**
 * Render a health pulse — compact status overview with dots.
 * Used in launch screen and project review.
 *
 * @param {object} config
 * @param {string} config.label - Section label (e.g., "health", "activity")
 * @param {object[]} config.items - Array of health items
 * @param {string} config.items[].status - Status key
 * @param {string} config.items[].name - Item name
 * @param {string} [config.items[].detail] - Optional detail
 * @param {string} [config.summary] - Optional summary text
 * @returns {string}
 *
 * @example
 * healthPulse({
 *   label: 'health',
 *   items: [
 *     { status: 'pass', name: 'api', detail: '5/5 passing' },
 *     { status: 'warn', name: 'docs', detail: 'stale' },
 *     { status: 'pass', name: 'repo', detail: 'healthy' }
 *   ],
 *   summary: '2 passed, 1 warning'
 * })
 */
export function healthPulse({ label, items, summary }) {
  const lines = [];

  // Render dots + label + summary on first line
  const dots = statusDots(items.map(item => item.status));
  const firstLine = summary
    ? alignRow(`${dots}  ${type.body(label)}`, type.metadata(summary), 80)
    : `${dots}  ${type.body(label)}`;

  lines.push(firstLine);

  // Render individual items (indented)
  for (const item of items) {
    const dot = statusDot(item.status);
    const detail = item.detail ? type.metadata(item.detail) : '';
    const itemLine = alignRow(
      `${dot}    ${type.body(item.name)}`,
      detail,
      80
    );
    lines.push(itemLine);
  }

  return lines.join('\n');
}

/**
 * Render an activity pulse — commit/contributor summary with visual pattern.
 * Used in GitHub analysis and project review.
 *
 * @param {object} config
 * @param {string} config.label - Section label (e.g., "activity")
 * @param {number} config.commits - Total commit count
 * @param {number} config.contributors - Total contributor count
 * @param {string} [config.pattern] - Visual activity pattern (e.g., "●●●○○●●")
 * @param {string} [config.peak] - Peak activity description
 * @returns {string}
 *
 * @example
 * activityPulse({
 *   label: 'activity',
 *   commits: 47,
 *   contributors: 3,
 *   pattern: '●●●○○●●',
 *   peak: 'aug 5 — 12 commits'
 * })
 */
export function activityPulse({ label, commits, contributors, pattern, peak }) {
  const lines = [];

  // First line: dots + label + summary
  const summary = `${commits} commits, ${contributors} contributors`;
  const dots = statusDots(['pass', 'pass']); // Activity is always "passing" (green dots)
  const firstLine = alignRow(
    `${dots}   ${type.body(label)}`,
    type.metadata(summary),
    80
  );
  lines.push(firstLine);

  // Activity pattern line (if provided)
  if (pattern) {
    const patternLabel = 'Last 7 days';
    const patternLine = alignRow(
      `     ${type.metadata(patternLabel)}`,
      pattern,
      80
    );
    lines.push(patternLine);
  }

  // Peak activity line (if provided)
  if (peak) {
    const peakLine = alignRow(
      `     ${type.metadata('Peak')}`,
      type.metadata(peak),
      80
    );
    lines.push(peakLine);
  }

  return lines.join('\n');
}

/**
 * Render a connection pulse — service connection status.
 * Used in launch screen and status command.
 *
 * @param {object} config
 * @param {object[]} config.services - Array of service connections
 * @param {string} config.services[].name - Service name
 * @param {boolean} config.services[].connected - Connection status
 * @returns {string}
 *
 * @example
 * connectionPulse({
 *   services: [
 *     { name: 'anthropic', connected: true },
 *     { name: 'github', connected: true }
 *   ]
 * })
 * // Output: "Connected  ●  anthropic, github"
 */
export function connectionPulse({ services }) {
  const connected = services.filter(s => s.connected);
  const allConnected = connected.length === services.length;

  if (allConnected) {
    const names = connected.map(s => s.name).join(', ');
    const dot = statusDot('pass');
    return `${type.metadata('Connected')}  ${dot}  ${type.body(names)}`;
  }

  // Partial connection — show individual status
  const lines = services.map(service => {
    const status = service.connected ? 'pass' : 'fail';
    const dot = statusDot(status);
    const statusText = service.connected ? 'connected' : 'disconnected';
    return alignRow(
      `   ${service.name}`,
      `${dot}  ${type.metadata(statusText)}`,
      80
    );
  });

  return lines.join('\n');
}

export default {
  healthPulse,
  activityPulse,
  connectionPulse,
};
