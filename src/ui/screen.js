/**
 * src/ui/screen.js
 * Screen layout component — the top-level container for all DeCode screens.
 *
 * Philosophy: Every screen follows the 3-tier hierarchy:
 * 1. Verdict (what's the truth?)
 * 2. Evidence (why is that true?)
 * 3. Action (what should I do?)
 *
 * This component enforces consistent spacing and structure.
 */
import { space } from './layout.js';
import * as type from './typography.js';

/**
 * Render a screen with consistent layout.
 *
 * @param {object} config
 * @param {string} config.command - Command being executed (e.g., "decode audit")
 * @param {string} [config.context] - Optional context line (e.g., "— project health")
 * @param {string} config.content - Main screen content
 * @param {string} [config.actions] - Optional actions/hints at bottom
 * @returns {string}
 *
 * @example
 * screen({
 *   command: 'decode audit',
 *   context: '— project health',
 *   content: '...',
 *   actions: '...'
 * })
 */
export function screen({ command, context, content, actions }) {
  const parts = [];

  // Header: command + context
  const header = context
    ? `${type.body(command)} ${type.metadata(context)}`
    : type.body(command);

  parts.push(header);
  parts.push(space('normal')); // 2-line gap after header

  // Main content
  parts.push(content);

  // Actions (if provided)
  if (actions) {
    parts.push(space('normal')); // 2-line gap before actions
    parts.push(actions);
  }

  // Trailing line
  parts.push(space('tight')); // 1 trailing line

  return parts.join('');
}

/**
 * Render a launch screen (special case — no command header).
 *
 * @param {string} content - Screen content
 * @returns {string}
 */
export function launchScreen(content) {
  return space('tight') + content + space('tight');
}

/**
 * Render an empty state screen.
 *
 * @param {object} config
 * @param {string} config.command - Command that was run
 * @param {string} config.message - Empty state message
 * @param {string} config.actions - Suggested next steps
 * @returns {string}
 */
export function emptyScreen({ command, message, actions }) {
  const parts = [];

  parts.push(type.body(command));
  parts.push(space('loose')); // 3-line gap (more breathing room)
  parts.push(type.body(message));
  parts.push(space('loose')); // 3-line gap
  parts.push(actions);
  parts.push(space('tight'));

  return parts.join('');
}

/**
 * Render an error screen.
 *
 * @param {object} config
 * @param {string} config.command - Command that failed
 * @param {string} config.error - Formatted error (from prompt.errorPrompt)
 * @returns {string}
 */
export function errorScreen({ command, error }) {
  const parts = [];

  parts.push(type.body(command));
  parts.push(space('normal'));
  parts.push(error);
  parts.push(space('tight'));

  return parts.join('');
}

/**
 * Render a success screen.
 *
 * @param {object} config
 * @param {string} config.command - Command that succeeded
 * @param {string} config.confirmation - What was done
 * @param {string} [config.metadata] - Optional details about what was created
 * @param {string} [config.suggestion] - Optional next step suggestion
 * @returns {string}
 */
export function successScreen({ command, confirmation, metadata, suggestion }) {
  const parts = [];

  parts.push(type.body(command));
  parts.push(space('normal'));
  parts.push(type.body(confirmation));

  if (metadata) {
    parts.push(space('normal'));
    parts.push(metadata);
  }

  if (suggestion) {
    parts.push(space('normal'));
    parts.push(type.metadata(suggestion));
  }

  parts.push(space('tight'));

  return parts.join('');
}

/**
 * Render the "Ready" state for launch.
 * @returns {string}
 */
export function readyState() {
  return space('tight') + type.body('Ready.') + space('tight');
}

export default {
  screen,
  launchScreen,
  emptyScreen,
  errorScreen,
  successScreen,
  readyState,
};
