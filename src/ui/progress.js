/**
 * src/ui/progress.js
 * Progress indicators — honest, measurable updates for long-running tasks.
 *
 * Philosophy: No spinners unless absolutely necessary. Show progress numbers.
 * Users deserve to know how far along something is, not just that it's running.
 */
import chalk from 'chalk';
import * as type from './typography.js';
import { alignRow } from './layout.js';

/**
 * Render a progress counter: "347 / 500"
 * Updates in-place on the same line.
 *
 * @param {object} config
 * @param {string} config.label - What's being processed
 * @param {number} config.current - Current progress
 * @param {number} config.total - Total items
 * @returns {string}
 *
 * @example
 * progressCounter({ label: 'Fetching commits', current: 347, total: 500 })
 * // Output: "Fetching commits...                     347 / 500"
 */
export function progressCounter({ label, current, total }) {
  const counter = `${current} / ${total}`;
  return alignRow(
    type.body(`${label}...`),
    type.metadata(counter),
    80
  );
}

/**
 * Render a progress percentage: "68%"
 *
 * @param {number} current
 * @param {number} total
 * @returns {string}
 *
 * @example
 * progressPercent(340, 500) // "68%"
 */
export function progressPercent(current, total) {
  const percent = Math.round((current / total) * 100);
  return type.metadata(`${percent}%`);
}

/**
 * Render a simple progress bar (character-based).
 * Minimal, not animated.
 *
 * @param {number} current
 * @param {number} total
 * @param {number} [width=20] - Width of the bar in characters
 * @returns {string}
 *
 * @example
 * progressBar(340, 500, 20)
 * // Output: "█████████████░░░░░░░"
 */
export function progressBar(current, total, width = 20) {
  const ratio = Math.min(current / total, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return chalk.dim(bar);
}

/**
 * Render a scanning/loading indicator.
 * Used when we don't have a total count yet.
 *
 * @param {string} label - What's being scanned
 * @param {number} [count] - Optional count of items found so far
 * @returns {string}
 *
 * @example
 * scanningIndicator('Scanning project', 78)
 * // Output: "Scanning project...  78 files"
 */
export function scanningIndicator(label, count) {
  const countText = count !== undefined
    ? type.metadata(`${count} files`)
    : '';

  return alignRow(
    type.body(`${label}...`),
    countText,
    80
  );
}

/**
 * Render a completion message.
 * Brief, calm confirmation that something finished.
 *
 * @param {string} label - What completed
 * @param {string} [detail] - Optional detail (e.g., count, duration)
 * @returns {string}
 *
 * @example
 * completionMessage('Documentation written', 'docs/architecture.md')
 */
export function completionMessage(label, detail) {
  if (detail) {
    return alignRow(
      type.body(label),
      type.metadata(detail),
      80
    );
  }
  return type.body(label);
}

/**
 * Create a progress updater function for long-running tasks.
 * Returns a function that updates progress in-place.
 *
 * @param {string} label
 * @param {number} total
 * @returns {Function} - Call with current count to update
 *
 * @example
 * const update = createProgressUpdater('Fetching commits', 500);
 * update(100); // Updates line with "100 / 500"
 * update(250); // Updates line with "250 / 500"
 */
export function createProgressUpdater(label, total) {
  let lastOutput = '';

  return function update(current) {
    // Clear previous line
    if (lastOutput && process.stdout.isTTY) {
      process.stdout.write('\r' + ' '.repeat(lastOutput.length) + '\r');
    }

    // Render new progress
    const output = progressCounter({ label, current, total });
    lastOutput = output;

    // Write without newline (stays on same line)
    if (process.stdout.isTTY) {
      process.stdout.write(output);
    }
  };
}

/**
 * Clear the current line (for progress updates).
 */
export function clearLine() {
  if (process.stdout.isTTY) {
    process.stdout.write('\r\x1b[K');
  }
}

/**
 * Move to next line after progress updates.
 */
export function finishProgress() {
  if (process.stdout.isTTY) {
    process.stdout.write('\n');
  }
}

export default {
  progressCounter,
  progressPercent,
  progressBar,
  scanningIndicator,
  completionMessage,
  createProgressUpdater,
  clearLine,
  finishProgress,
};
