/**
 * src/ui/motion.js
 * Motion and animation primitives for DeCode.
 *
 * Philosophy: Motion represents observable work, not fake progress.
 * Everything should feel calm. No unnecessary spinners.
 * Progress is measurable, updates are honest, transitions are smooth.
 */
import * as terminal from './terminal.js';

/**
 * Create an in-place updater for progress displays.
 * Updates happen on the same line without scrolling.
 *
 * @param {Function} renderFn - Function that returns the text to display
 * @returns {object} - { update, finish }
 *
 * @example
 * const motion = inPlaceUpdate(() => progressCounter({ label: 'Fetching', current, total }));
 * motion.update();  // Renders current state
 * motion.finish();  // Moves to next line
 */
export function inPlaceUpdate(renderFn) {
  let isFirstRender = true;

  return {
    update() {
      if (!terminal.isTTY()) {
        // Non-TTY: just write the line once
        if (isFirstRender) {
          terminal.writeLine(renderFn());
          isFirstRender = false;
        }
        return;
      }

      // Clear previous line content
      if (!isFirstRender) {
        terminal.clearLine();
      }

      // Render new content
      const content = renderFn();
      terminal.write(content);

      isFirstRender = false;
    },

    finish() {
      if (terminal.isTTY()) {
        terminal.writeLine(''); // Move to next line
      }
    },
  };
}

/**
 * Create a progress tracker for long-running operations with known totals.
 * Automatically updates at reasonable intervals.
 *
 * @param {object} config
 * @param {Function} config.render - Render function receiving (current, total)
 * @param {number} config.total - Total count
 * @param {number} [config.updateInterval=100] - ms between updates
 * @returns {object} - { tick, complete }
 *
 * @example
 * const tracker = progressTracker({
 *   render: (current, total) => progressCounter({ label: 'Processing', current, total }),
 *   total: 500
 * });
 *
 * for (let i = 0; i < 500; i++) {
 *   await processItem(i);
 *   tracker.tick();
 * }
 * tracker.complete();
 */
export function progressTracker({ render, total, updateInterval = 100 }) {
  let current = 0;
  let lastUpdateTime = 0;

  const motion = inPlaceUpdate(() => render(current, total));

  return {
    tick() {
      current++;

      const now = Date.now();
      const shouldUpdate = current === total || (now - lastUpdateTime) >= updateInterval;

      if (shouldUpdate) {
        motion.update();
        lastUpdateTime = now;
      }
    },

    complete() {
      current = total;
      motion.update();
      motion.finish();
    },
  };
}

/**
 * Create a scanning indicator for operations without known totals.
 *
 * @param {object} config
 * @param {Function} config.render - Render function receiving (count)
 * @param {number} [config.updateInterval=100] - ms between updates
 * @returns {object} - { increment, finish }
 *
 * @example
 * const scanner = scanningIndicator({
 *   render: (count) => scanningIndicator('Scanning project', count)
 * });
 *
 * files.forEach(file => {
 *   processFile(file);
 *   scanner.increment();
 * });
 * scanner.finish();
 */
export function scanningIndicator({ render, updateInterval = 100 }) {
  let count = 0;
  let lastUpdateTime = 0;

  const motion = inPlaceUpdate(() => render(count));

  return {
    increment() {
      count++;

      const now = Date.now();
      if (now - lastUpdateTime >= updateInterval) {
        motion.update();
        lastUpdateTime = now;
      }
    },

    finish() {
      motion.update();
      motion.finish();
    },
  };
}

/**
 * Replace content progressively (for multi-stage operations).
 * Each stage replaces the previous one on the same line.
 *
 * @returns {object} - { stage, finish }
 *
 * @example
 * const stages = progressiveReplacement();
 * stages.stage('Scanning project...');
 * // work happens
 * stages.stage('Generating documentation...');
 * // more work
 * stages.finish();
 */
export function progressiveReplacement() {
  let hasContent = false;

  return {
    stage(text) {
      if (!terminal.isTTY()) {
        terminal.writeLine(text);
        return;
      }

      if (hasContent) {
        terminal.clearLine();
      }

      terminal.write(text);
      hasContent = true;
    },

    finish() {
      if (terminal.isTTY() && hasContent) {
        terminal.writeLine('');
      }
    },
  };
}

/**
 * Animate health pulse dots appearing one by one.
 * Visual signature for launch/status screens.
 *
 * @param {string[]} statuses - Array of status keys
 * @param {Function} renderDot - Function to render each dot
 * @param {number} [delayMs=80] - Delay between dots
 * @returns {Promise<void>}
 *
 * @example
 * await animateHealthPulse(
 *   ['pass', 'pass', 'warn'],
 *   (status) => statusDot(status),
 *   80
 * );
 */
export async function animateHealthPulse(statuses, renderDot, delayMs = 80) {
  if (!terminal.isTTY()) {
    // Non-TTY: render all at once
    const dots = statuses.map(renderDot).join('');
    terminal.write(dots);
    return;
  }

  for (const status of statuses) {
    terminal.write(renderDot(status));
    await sleep(delayMs);
  }
}

/**
 * Transition between two sections with visual separation.
 * Clears previous content and renders new section smoothly.
 *
 * @param {Function} render - Function that renders the new section
 * @param {number} [linesAbove=0] - How many lines to move up before rendering
 */
export function sectionTransition(render, linesAbove = 0) {
  if (!terminal.isTTY()) {
    terminal.writeLine(render());
    return;
  }

  if (linesAbove > 0) {
    terminal.moveCursorUp(linesAbove);
  }

  terminal.writeLine(render());
}

/**
 * Create a spinner (use sparingly — prefer progress counters).
 * Only for truly indefinite operations.
 *
 * @param {string} label - What's happening
 * @returns {object} - { start, stop }
 *
 * @example
 * const spin = spinner('Connecting to API...');
 * spin.start();
 * await doWork();
 * spin.stop();
 */
export function spinner(label) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frameIndex = 0;
  let intervalId = null;

  return {
    start() {
      if (!terminal.isTTY()) {
        terminal.writeLine(label);
        return;
      }

      terminal.hideCursor();

      intervalId = setInterval(() => {
        terminal.clearLine();
        terminal.write(`${frames[frameIndex]} ${label}`);
        frameIndex = (frameIndex + 1) % frames.length;
      }, 80);
    },

    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      if (terminal.isTTY()) {
        terminal.clearLine();
        terminal.showCursor();
      }
    },
  };
}

/**
 * Batch multiple updates to prevent flicker.
 * Accumulates changes and renders once.
 *
 * @param {Function[]} operations - Array of render operations
 */
export function batchUpdate(operations) {
  if (!terminal.isTTY()) {
    operations.forEach(op => op());
    return;
  }

  terminal.hideCursor();

  for (const operation of operations) {
    operation();
  }

  terminal.showCursor();
}

/**
 * Utility: sleep for animation timing.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  inPlaceUpdate,
  progressTracker,
  scanningIndicator,
  progressiveReplacement,
  animateHealthPulse,
  sectionTransition,
  spinner,
  batchUpdate,
};
