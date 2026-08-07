/**
 * src/ui/icons.js
 * DeCode icon language — minimal, semantic symbols.
 *
 * Philosophy: Icons are states, not decorations.
 * The dot language (●○◆) is DeCode's visual signature.
 */

/**
 * Status dots — the core visual language of DeCode.
 * These appear at the left edge and form vertical patterns.
 */
export const dots = {
  healthy: '●',      // Green — passing, connected, complete
  warning: '○',      // Yellow — stale, pending, attention
  critical: '◆',     // Red — failed, blocking, error
};

/**
 * Directional indicators.
 */
export const arrows = {
  next: '→',         // Action suggestion, next step
  expand: '↓',       // Show more, expand detail
  previous: '←',     // Go back, undo
};

/**
 * Structural symbols.
 */
export const structure = {
  separator: '·',    // Inline list separator (e.g., "2 passed · 1 warning")
  bullet: '•',       // List item (less prominent than dots)
};

/**
 * Get a status dot with semantic meaning.
 * Returns the character only (no color — that's applied by Status component).
 */
export function getStatusDot(status) {
  switch (status) {
    case 'pass':
    case 'passed':
    case 'healthy':
    case 'connected':
    case 'success':
      return dots.healthy;

    case 'warn':
    case 'warning':
    case 'stale':
    case 'pending':
      return dots.warning;

    case 'fail':
    case 'failed':
    case 'critical':
    case 'error':
    case 'blocked':
      return dots.critical;

    default:
      return dots.warning; // Default to warning for unknown states
  }
}

/**
 * Get semantic color for a status.
 * Returns the theme color key.
 */
export function getStatusColor(status) {
  switch (status) {
    case 'pass':
    case 'passed':
    case 'healthy':
    case 'connected':
    case 'success':
      return 'healthy';

    case 'warn':
    case 'warning':
    case 'stale':
    case 'pending':
      return 'warning';

    case 'fail':
    case 'failed':
    case 'critical':
    case 'error':
    case 'blocked':
      return 'critical';

    default:
      return 'warning';
  }
}

export default {
  dots,
  arrows,
  structure,
  getStatusDot,
  getStatusColor,
};
