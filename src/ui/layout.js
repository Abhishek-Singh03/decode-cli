/**
 * src/ui/layout.js
 * Spacing and positioning primitives.
 *
 * Philosophy: Whitespace is information. Empty lines create hierarchy.
 * Dense = urgent. Sparse = calm.
 */
import { spacing as spacingScale, layout as layoutConfig } from './theme.js';

/**
 * Create vertical spacing (empty lines).
 * @param {number|string} amount - Number of lines or spacing key
 * @returns {string}
 */
export function space(amount = 'normal') {
  const lines = typeof amount === 'number'
    ? amount
    : spacingScale[amount] ?? spacingScale.normal;

  return '\n'.repeat(lines);
}

/**
 * Indent text by a number of spaces.
 * @param {string} text
 * @param {number} level - Indentation level (multiplied by indentSize)
 * @returns {string}
 */
export function indent(text, level = 1) {
  const spaces = ' '.repeat(layoutConfig.indentSize * level);
  return text.split('\n').map(line => spaces + line).join('\n');
}

/**
 * Pad text to a specific width (for alignment).
 * @param {string} text
 * @param {number} width
 * @param {string} align - 'left' | 'right' | 'center'
 * @returns {string}
 */
export function pad(text, width, align = 'left') {
  const stripped = stripAnsi(text);
  const currentWidth = stripped.length;

  if (currentWidth >= width) {
    return text;
  }

  const padding = width - currentWidth;

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + text;

    case 'center': {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
    }

    case 'left':
    default:
      return text + ' '.repeat(padding);
  }
}

/**
 * Align two pieces of text on the same line (left and right).
 * @param {string} left
 * @param {string} right
 * @param {number} width - Total width (default: terminal width or 80)
 * @returns {string}
 */
export function alignRow(left, right, width = layoutConfig.maxWidth) {
  const leftStripped = stripAnsi(left);
  const rightStripped = stripAnsi(right);
  const gap = width - leftStripped.length - rightStripped.length;

  if (gap <= 0) {
    return left + ' ' + right;
  }

  return left + ' '.repeat(gap) + right;
}

/**
 * Create a grid row with multiple columns.
 * @param {string[]} columns - Array of column content
 * @param {number[]} widths - Array of column widths
 * @param {number} gutter - Space between columns
 * @returns {string}
 */
export function gridRow(columns, widths, gutter = layoutConfig.tableGutter) {
  return columns
    .map((col, i) => pad(col, widths[i], 'left'))
    .join(' '.repeat(gutter));
}

/**
 * Wrap text to a maximum width.
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string}
 */
export function wrap(text, maxWidth = layoutConfig.maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const stripped = stripAnsi(testLine);

    if (stripped.length <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

/**
 * Strip ANSI escape codes to measure actual text width.
 * Simple implementation — doesn't handle all edge cases.
 * @param {string} text
 * @returns {string}
 */
function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

/**
 * Measure the visual width of text (stripping ANSI codes).
 * @param {string} text
 * @returns {number}
 */
export function measure(text) {
  return stripAnsi(text).length;
}

export default {
  space,
  indent,
  pad,
  alignRow,
  gridRow,
  wrap,
  measure,
};
