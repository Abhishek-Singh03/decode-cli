/**
 * src/ui/theme.js
 * DeCode Design System — Color palette and semantic tokens.
 *
 * Philosophy: Colors are semantic, not decorative. Every color carries meaning.
 * No background colors — terminal-native text coloring only.
 */

/**
 * Semantic color tokens mapped to chalk methods.
 * Import chalk dynamically to avoid top-level side effects.
 */
export const colors = {
  // Status colors (used for dots, verdicts, critical info)
  healthy: 'green',      // Passing, connected, success
  warning: 'yellow',     // Stale, degraded, attention needed
  critical: 'red',       // Failed, error, blocking

  // Information hierarchy
  primary: 'white',      // Default text, primary information
  secondary: 'dim',      // Metadata, supporting information, timestamps
  interactive: 'cyan',   // Links, hints, next actions

  // Brand
  brand: 'dim',          // DeCode wordmark (subtle presence)
};

/**
 * Typography weights/styles.
 * These map to chalk combinations.
 */
export const typography = {
  // Hierarchy
  title: ['bold'],                    // Screen titles, verdicts
  body: [],                           // Default text
  metadata: ['dim'],                  // Supporting info, timestamps
  emphasis: ['bold'],                 // Critical numbers, counts

  // Specialized
  monospace: [],                      // Already monospace in terminal
  interactive: ['cyan'],              // Actions, links
  success: ['green'],                 // Success confirmations
  error: ['red', 'bold'],            // Error messages
  warning: ['yellow'],                // Warning messages
};

/**
 * Spacing scale (in lines).
 * Whitespace is information — these values encode hierarchy.
 */
export const spacing = {
  none: 0,        // Dense lists, related items
  tight: 1,       // Section separators, list items
  normal: 2,      // Major section breaks, breathing room
  loose: 3,       // Empty states, dramatic pauses
};

/**
 * Layout constraints.
 */
export const layout = {
  maxWidth: 80,              // Max line width for prose
  indentSize: 3,             // Spaces for indentation
  tableGutter: 4,            // Space between table columns
};

/**
 * Animation/interaction timing.
 */
export const timing = {
  spinnerInterval: 80,       // ms between spinner frames
  progressUpdateInterval: 100, // ms between progress updates
};

export default {
  colors,
  typography,
  spacing,
  layout,
  timing,
};
