/**
 * src/ui/prompt.js
 * Interactive prompt component — user input and decision points.
 *
 * Philosophy: Prompts should be clear and fast. Single-key responses when possible.
 * No verbose instructions — the options should be self-explanatory.
 */
import * as type from './typography.js';
import { arrows } from './icons.js';

/**
 * Format a confirmation prompt.
 * Renders the question and options, but doesn't handle input (inquirer does that).
 *
 * @param {string} question - The question to ask
 * @returns {string}
 *
 * @example
 * confirmPrompt('Write documentation to docs/architecture.md?')
 */
export function confirmPrompt(question) {
  return type.emphasis(question);
}

/**
 * Format action options for approval prompts.
 * Used after previews when user needs to choose what to do.
 *
 * @param {object[]} options - Array of {key, label, description}
 * @returns {string}
 *
 * @example
 * actionOptions([
 *   { key: 'y', label: 'yes', description: 'write file' },
 *   { key: 'n', label: 'no', description: 'cancel' },
 *   { key: 'e', label: 'edit', description: 'edit prompt and regenerate' }
 * ])
 */
export function actionOptions(options) {
  return options.map(opt => {
    const arrow = type.interactive(arrows.next);
    const key = type.interactive(opt.key);
    const description = type.body(opt.description);
    return `${arrow} ${key}   ${description}`;
  }).join('\n');
}

/**
 * Format a next-action suggestion (not a prompt, just a hint).
 * Appears at bottom of screens to suggest what user might do next.
 *
 * @param {object[]} actions - Array of {command, description}
 * @returns {string}
 *
 * @example
 * nextActions([
 *   { command: 'decode audit', description: 'run full check' },
 *   { command: 'decode api check', description: 'check routes only' }
 * ])
 */
export function nextActions(actions) {
  return actions.map(action => {
    const arrow = type.interactive(arrows.next);
    const command = type.interactive(action.command);
    const description = type.metadata(action.description);
    return `${arrow} ${command.padEnd(30)}${description}`;
  }).join('\n');
}

/**
 * Format a hint (non-interactive suggestion).
 * Less prominent than next actions — truly optional.
 *
 * @param {string} command - Command to suggest
 * @param {string} description - What it does
 * @returns {string}
 *
 * @example
 * hint('decode api check --spec openapi.json', 'validate response schemas')
 */
export function hint(command, description) {
  const arrow = type.metadata(arrows.expand);
  const cmd = type.metadata(command);
  const desc = type.metadata(description);
  return `${arrow} ${cmd.padEnd(40)}${desc}`;
}

/**
 * Format an error with suggested recovery actions.
 *
 * @param {object} config
 * @param {string} config.type - Error type (short, one line)
 * @param {string} config.explanation - Why it happened
 * @param {object[]} [config.actions] - Suggested fixes
 * @returns {string}
 *
 * @example
 * errorPrompt({
 *   type: 'Network unreachable',
 *   explanation: 'All 5 routes failed to respond.\nCheck your network connection or verify endpoints are running.',
 *   actions: [
 *     { command: 'decode api list', description: 'show configured routes' },
 *     { command: 'decode status', description: 'check connection state' }
 *   ]
 * })
 */
export function errorPrompt({ type: errorType, explanation, actions = [] }) {
  const lines = [];

  // Error symbol + type
  lines.push(type.error('◆  ' + errorType));
  lines.push('');

  // Explanation
  lines.push(type.body(explanation));

  // Suggested actions
  if (actions.length > 0) {
    lines.push('');
    lines.push('');
    lines.push(nextActions(actions));
  }

  return lines.join('\n');
}

/**
 * Format a warning with optional action.
 *
 * @param {object} config
 * @param {string} config.message - Warning message
 * @param {string} [config.impact] - Impact statement (what this means)
 * @param {object} [config.action] - Optional suggested action
 * @returns {string}
 *
 * @example
 * warningPrompt({
 *   message: 'Documentation is out of sync with recent code changes.',
 *   impact: "This won't block your workflow, but might confuse new contributors.",
 *   action: { command: 'decode doc', description: 'regenerate documentation' }
 * })
 */
export function warningPrompt({ message, impact, action }) {
  const lines = [];

  // Warning symbol + message
  lines.push(type.warning('○  ') + type.body(message));

  // Impact
  if (impact) {
    lines.push(type.metadata(impact));
  }

  // Suggested action
  if (action) {
    lines.push('');
    const arrow = type.interactive(arrows.next);
    const cmd = type.interactive(action.command);
    const desc = type.metadata(action.description);
    lines.push(`${arrow} ${cmd.padEnd(30)}${desc}`);
  }

  return lines.join('\n');
}

export default {
  confirmPrompt,
  actionOptions,
  nextActions,
  hint,
  errorPrompt,
  warningPrompt,
};
