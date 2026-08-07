/**
 * src/ui/index.js
 * DeCode UI Framework — Public API.
 *
 * This is the single entry point for all UI components.
 * Commands import from here, never from individual component files.
 *
 * Design Philosophy:
 * - Verdict-first layouts (truth at top, evidence below)
 * - Whitespace creates hierarchy
 * - Dots are the visual signature
 * - Typography establishes importance
 * - Colors are semantic, not decorative
 */

// Core primitives
export * from './theme.js';
export * from './typography.js';
export * from './layout.js';
export * from './icons.js';

// Components
export * from './status.js';
export * from './health-pulse.js';
export * from './panel.js';
export * from './table.js';
export * from './divider.js';
export * from './progress.js';
export * from './prompt.js';
export * from './screen.js';

/**
 * Convenience: Import everything as a single namespace.
 *
 * @example
 * import * as ui from './ui/index.js';
 *
 * console.log(ui.screen({
 *   command: 'decode audit',
 *   context: '— project health',
 *   content: ui.statusList([...]),
 *   actions: ui.nextActions([...])
 * }));
 */
