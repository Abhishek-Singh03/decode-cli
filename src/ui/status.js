/**
 * src/ui/status.js
 * Status indicator component — the dot at the left edge.
 *
 * Philosophy: Dots are the visual signature of DeCode.
 * They form vertical patterns that let you scan health at a glance.
 */
import chalk from 'chalk';
import { getStatusDot, getStatusColor } from './icons.js';
import { colors } from './theme.js';

/**
 * Render a status dot with semantic coloring.
 *
 * @param {string} status - 'pass' | 'fail' | 'warn' | 'healthy' | 'critical' | etc.
 * @returns {string} - Colored dot character
 *
 * @example
 * statusDot('pass')    // Green ●
 * statusDot('warn')    // Yellow ○
 * statusDot('fail')    // Red ◆
 */
export function statusDot(status) {
  const dot = getStatusDot(status);
  const colorKey = getStatusColor(status);
  const chalkColor = colors[colorKey];

  if (chalk[chalkColor]) {
    return chalk[chalkColor](dot);
  }

  return dot;
}

/**
 * Render a status row: dot + label + verdict + metadata.
 * Forms the core pattern of audit/health displays.
 *
 * @param {object} config
 * @param {string} config.status - Status key
 * @param {string} config.label - Component name (e.g., "api", "docs")
 * @param {string} config.verdict - Result description (e.g., "5/5 routes passing")
 * @param {string} [config.detail] - Optional metadata (right-aligned)
 * @param {number} [config.labelWidth=15] - Width for label column
 * @param {number} [config.verdictWidth=30] - Width for verdict column
 * @returns {string}
 *
 * @example
 * statusRow({
 *   status: 'pass',
 *   label: 'api',
 *   verdict: '5/5 routes passing',
 *   detail: 'avg 23ms'
 * })
 * // Output: "●  api         5/5 routes passing      avg 23ms"
 */
export function statusRow({ status, label, verdict, detail = '', labelWidth = 15, verdictWidth = 30 }) {
  const dot = statusDot(status);

  // Apply styling
  const styledLabel = label;
  const styledVerdict = chalk.bold(verdict);
  const styledDetail = detail ? chalk.dim(detail) : '';

  // Reconstruct with proper padding (padding happens before styling to maintain alignment)
  const labelPart = styledLabel.padEnd(labelWidth);
  const verdictPart = styledVerdict.padEnd(verdictWidth + (chalk.bold(verdict).length - verdict.length));

  return `${dot}  ${labelPart}${verdictPart}${styledDetail}`;
}

/**
 * Render a status summary line: "X passed · Y warning · Z critical"
 * Uses the · separator and bold numbers.
 *
 * @param {object} counts
 * @param {number} counts.passed
 * @param {number} [counts.warning=0]
 * @param {number} [counts.failed=0]
 * @param {number} [counts.critical=0]
 * @param {number} [counts.skipped=0]
 * @returns {string}
 *
 * @example
 * statusSummary({ passed: 2, warning: 1, critical: 0 })
 * // Output: "2 passed · 1 warning · 0 critical"
 */
export function statusSummary(counts) {
  const { passed = 0, warning = 0, failed = 0, critical = 0, skipped = 0 } = counts;

  const parts = [];

  // Main counts (always show)
  parts.push(`${chalk.bold(passed)} passed`);
  parts.push(`${chalk.bold(warning || failed)} warning`);
  parts.push(`${chalk.bold(critical)} critical`);

  // Optional skipped count
  if (skipped > 0) {
    parts.push(chalk.dim(`${skipped} skipped`));
  }

  return parts.join(chalk.dim(' · '));
}

/**
 * Render a compact status indicator: dots only, no labels.
 * Used for overview screens where space is tight.
 *
 * @param {string[]} statuses - Array of status keys
 * @returns {string}
 *
 * @example
 * statusDots(['pass', 'pass', 'warn'])
 * // Output: "●●○"
 */
export function statusDots(statuses) {
  return statuses.map(s => statusDot(s)).join('');
}

export default {
  statusDot,
  statusRow,
  statusSummary,
  statusDots,
};
