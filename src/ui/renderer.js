/**
 * src/ui/renderer.js
 * DeCode's rendering engine — the heart of the presentation layer.
 *
 * Philosophy: Commands describe WHAT to show. Renderer decides HOW.
 * All terminal output flows through here. No direct console.log, no raw chalk.
 *
 * The renderer composes UI components into complete screens, manages layout,
 * handles terminal capabilities, and provides snapshot functionality.
 */
import * as terminal from './terminal.js';
import * as motion from './motion.js';
import * as screen from './screen.js';

/**
 * Render a complete screen and write to terminal.
 * This is the primary rendering function — commands call this.
 *
 * @param {object|string} content - Screen config object or raw string
 * @returns {string} - The rendered content (for testing/snapshots)
 *
 * @example
 * render({
 *   command: 'decode audit',
 *   context: '— project health',
 *   content: '...',
 *   actions: '...'
 * })
 */
export function render(content) {
  let output;

  // Handle different content types
  if (typeof content === 'string') {
    // Raw string — render as-is
    output = content;
  } else if (content.type === 'launch') {
    // Launch screen (special layout)
    output = screen.launchScreen(content.content);
  } else if (content.type === 'empty') {
    // Empty state
    output = screen.emptyScreen({
      command: content.command,
      message: content.message,
      actions: content.actions,
    });
  } else if (content.type === 'error') {
    // Error screen
    output = screen.errorScreen({
      command: content.command,
      error: content.error,
    });
  } else if (content.type === 'success') {
    // Success screen
    output = screen.successScreen({
      command: content.command,
      confirmation: content.confirmation,
      metadata: content.metadata,
      suggestion: content.suggestion,
    });
  } else {
    // Standard screen layout
    output = screen.screen({
      command: content.command,
      context: content.context,
      content: content.content,
      actions: content.actions,
    });
  }

  // Write to terminal
  terminal.writeLine(output);

  return output;
}

/**
 * Clear the terminal screen.
 * Use sparingly — most screens should just flow naturally.
 */
export function clear() {
  terminal.clearScreen();
}

/**
 * Replace the current line with new content.
 * Used for in-place updates (progress, status changes).
 *
 * @param {string} content - New content for the line
 */
export function replace(content) {
  terminal.clearLine();
  terminal.write(content);
}

/**
 * Append content to the current output without clearing.
 *
 * @param {string} content - Content to append
 */
export function append(content) {
  terminal.writeLine(content);
}

/**
 * Update content in-place (for progress indicators).
 * Creates a motion updater that handles line replacement.
 *
 * @param {Function} renderFn - Function that returns content to display
 * @returns {object} - Motion updater { update, finish }
 *
 * @example
 * const updater = update(() => progressCounter({ ... }));
 * updater.update();
 * updater.finish();
 */
export function update(renderFn) {
  return motion.inPlaceUpdate(renderFn);
}

/**
 * Create a progress tracker for rendering progress updates.
 *
 * @param {object} config
 * @param {Function} config.render - Render function
 * @param {number} config.total - Total count
 * @returns {object} - Tracker { tick, complete }
 */
export function progress(config) {
  return motion.progressTracker(config);
}

/**
 * Create a scanner for indefinite operations.
 *
 * @param {object} config
 * @param {Function} config.render - Render function
 * @returns {object} - Scanner { increment, finish }
 */
export function scan(config) {
  return motion.scanningIndicator(config);
}

/**
 * Create a progressive replacement renderer for multi-stage operations.
 *
 * @returns {object} - { stage, finish }
 *
 * @example
 * const stages = progressive();
 * stages.stage('Scanning...');
 * stages.stage('Generating...');
 * stages.finish();
 */
export function progressive() {
  return motion.progressiveReplacement();
}

/**
 * Snapshot a screen configuration for testing/documentation.
 * Returns the rendered output without writing to terminal.
 *
 * @param {object|string} content - Screen config
 * @returns {string} - Rendered output (no ANSI codes)
 */
export function snapshot(content) {
  let output;

  if (typeof content === 'string') {
    output = content;
  } else if (content.type === 'launch') {
    output = screen.launchScreen(content.content);
  } else if (content.type === 'empty') {
    output = screen.emptyScreen({
      command: content.command,
      message: content.message,
      actions: content.actions,
    });
  } else if (content.type === 'error') {
    output = screen.errorScreen({
      command: content.command,
      error: content.error,
    });
  } else if (content.type === 'success') {
    output = screen.successScreen({
      command: content.command,
      confirmation: content.confirmation,
      metadata: content.metadata,
      suggestion: content.suggestion,
    });
  } else {
    output = screen.screen({
      command: content.command,
      context: content.context,
      content: content.content,
      actions: content.actions,
    });
  }

  // Strip ANSI codes for clean snapshot
  return stripAnsi(output);
}

/**
 * Render with animation (for launch/status screens).
 * Animates health pulse dots for visual interest.
 *
 * @param {object} config
 * @param {object} config.screen - Screen configuration
 * @param {string[]} [config.healthStatuses] - Statuses to animate
 * @returns {Promise<string>} - Rendered output
 */
export async function renderAnimated(config) {
  const { screen: screenConfig, healthStatuses = [] } = config;

  // Animate health pulse if provided
  if (healthStatuses.length > 0 && terminal.isTTY()) {
    const { statusDot } = await import('./status.js');
    await motion.animateHealthPulse(healthStatuses, statusDot);
    terminal.writeLine('');
  }

  // Render rest of screen
  return render(screenConfig);
}

/**
 * Get terminal capabilities.
 * Useful for conditional rendering based on terminal support.
 *
 * @returns {object} - Capabilities object
 */
export function getCapabilities() {
  return terminal.getCapabilities();
}

/**
 * Batch multiple render operations to prevent flicker.
 *
 * @param {Function[]} operations - Array of render functions
 */
export function batch(operations) {
  motion.batchUpdate(operations);
}

/**
 * Create a spinner (use sparingly).
 *
 * @param {string} label
 * @returns {object} - { start, stop }
 */
export function createSpinner(label) {
  return motion.spinner(label);
}

/**
 * Strip ANSI escape codes from text.
 * Used for snapshots and testing.
 *
 * @param {string} text
 * @returns {string}
 */
function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

/**
 * Measure the visual width of rendered text.
 *
 * @param {string} text
 * @returns {number}
 */
export function measure(text) {
  return stripAnsi(text).length;
}

/**
 * Check if terminal supports a feature.
 *
 * @param {string} feature - 'unicode' | 'colors256' | 'trueColor' | 'interactive'
 * @returns {boolean}
 */
export function supports(feature) {
  const caps = getCapabilities();
  return Boolean(caps[feature]);
}

export default {
  render,
  clear,
  replace,
  append,
  update,
  progress,
  scan,
  progressive,
  snapshot,
  renderAnimated,
  getCapabilities,
  batch,
  createSpinner,
  measure,
  supports,
};
