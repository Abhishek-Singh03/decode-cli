/**
 * src/ui/typography.js
 * Text styling primitives — the building blocks of information hierarchy.
 *
 * Philosophy: Typography creates hierarchy without decoration.
 * Bold = important. Dim = context. Default = truth.
 */
import chalk from 'chalk';
import { typography as typeStyles } from './theme.js';

/**
 * Apply a style from the typography scale.
 * @param {string} text
 * @param {string[]} styles - Array of chalk method names
 * @returns {string}
 */
function applyStyles(text, styles = []) {
  let result = text;
  for (const style of styles) {
    if (chalk[style]) {
      result = chalk[style](result);
    }
  }
  return result;
}

/**
 * Title text — screen headers, verdicts, major announcements.
 * Used for: Screen titles, audit verdicts, confirmation messages.
 */
export function title(text) {
  return applyStyles(text, typeStyles.title);
}

/**
 * Body text — default information, primary content.
 * Used for: Most text, explanations, descriptions.
 */
export function body(text) {
  return applyStyles(text, typeStyles.body);
}

/**
 * Metadata text — supporting information, timestamps, details.
 * Used for: Timestamps, file paths, supplementary info.
 */
export function metadata(text) {
  return applyStyles(text, typeStyles.metadata);
}

/**
 * Emphasis text — critical numbers, counts, key data points.
 * Used for: Numbers in summaries, counts, important values.
 */
export function emphasis(text) {
  return applyStyles(text, typeStyles.emphasis);
}

/**
 * Interactive text — actions, links, clickable hints.
 * Used for: Suggested commands, next steps, help text.
 */
export function interactive(text) {
  return applyStyles(text, typeStyles.interactive);
}

/**
 * Success text — confirmations, positive outcomes.
 * Used for: Success messages, completion notices.
 */
export function success(text) {
  return applyStyles(text, typeStyles.success);
}

/**
 * Error text — critical failures, blocking problems.
 * Used for: Error messages, critical warnings.
 */
export function error(text) {
  return applyStyles(text, typeStyles.error);
}

/**
 * Warning text — non-blocking issues, things to notice.
 * Used for: Warnings, cautions, things to review.
 */
export function warning(text) {
  return applyStyles(text, typeStyles.warning);
}

/**
 * Brand text — DeCode wordmark and brand presence.
 * Used for: The "decode" wordmark, brand identifiers.
 */
export function brand(text) {
  return chalk.dim(text);
}

/**
 * Apply a specific chalk color.
 * @param {string} text
 * @param {string} colorName - Key from theme.colors
 */
export function color(text, colorName) {
  if (chalk[colorName]) {
    return chalk[colorName](text);
  }
  return text;
}

export default {
  title,
  body,
  metadata,
  emphasis,
  interactive,
  success,
  error,
  warning,
  brand,
  color,
};
