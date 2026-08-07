/**
 * src/ui/divider.js
 * Divider components — section breaks and visual separators.
 *
 * Philosophy: Whitespace is usually better than lines.
 * Use dividers sparingly — only when sections truly need visual separation.
 */
import chalk from 'chalk';

/**
 * Render a section divider (empty line).
 * This is the default separator — just whitespace.
 *
 * @param {number} [lines=2] - Number of empty lines
 * @returns {string}
 */
export function spaceDivider(lines = 2) {
  return '\n'.repeat(lines);
}

/**
 * Render a subtle text divider (centered label with surrounding space).
 * Used rarely — only when a section needs a clear label.
 *
 * @param {string} label - Section label
 * @param {number} [width=80] - Total width
 * @returns {string}
 *
 * @example
 * labelDivider('Last 7 days', 80)
 * // Output: (centered with space around it)
 */
export function labelDivider(label, width = 80) {
  const padding = Math.floor((width - label.length) / 2);
  const line = ' '.repeat(padding) + chalk.dim(label) + ' '.repeat(padding);
  return '\n' + line + '\n';
}

/**
 * Render a minimal line divider (single dim line).
 * Use sparingly — whitespace is usually better.
 *
 * @param {number} [width=80] - Line width
 * @param {string} [char='─'] - Character to use
 * @returns {string}
 */
export function lineDivider(width = 80, char = '─') {
  return chalk.dim(char.repeat(width));
}

/**
 * Render a section break for long output.
 * Just returns appropriate whitespace — no visual decoration.
 *
 * @returns {string}
 */
export function sectionBreak() {
  return '\n\n';
}

export default {
  spaceDivider,
  labelDivider,
  lineDivider,
  sectionBreak,
};
