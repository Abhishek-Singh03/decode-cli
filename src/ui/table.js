/**
 * src/ui/table.js
 * Table component — structured data display.
 *
 * Philosophy: Tables are for data, not decoration.
 * No boxes, no borders. Just aligned columns with clear hierarchy.
 */
import chalk from 'chalk';
import { gridRow, measure, space } from './layout.js';
import * as type from './typography.js';
import { statusRow } from './status.js';

/**
 * Render a simple table with headers and rows.
 * Clean, aligned, no borders.
 *
 * @param {object} config
 * @param {string[]} config.headers - Column headers
 * @param {string[][]} config.rows - Array of row arrays
 * @param {number[]} [config.widths] - Optional column widths (auto-calculated if not provided)
 * @param {number} [config.gutter=4] - Space between columns
 * @returns {string}
 *
 * @example
 * table({
 *   headers: ['Route', 'Status', 'Time'],
 *   rows: [
 *     ['https://api.example.com/users', '200', '18ms'],
 *     ['https://api.example.com/posts', '200', '24ms']
 *   ]
 * })
 */
export function table({ headers, rows, widths, gutter = 4 }) {
  const lines = [];

  // Calculate column widths if not provided
  const columnWidths = widths || calculateWidths(headers, rows);

  // Render headers (bold)
  const headerRow = gridRow(
    headers.map(h => type.emphasis(h)),
    columnWidths,
    gutter
  );
  lines.push(headerRow);

  // Render rows
  for (const row of rows) {
    const rowLine = gridRow(row, columnWidths, gutter);
    lines.push(rowLine);
  }

  return lines.join('\n');
}

/**
 * Render a simple list with aligned left and right columns.
 * Used for key-value displays (e.g., status screen).
 *
 * @param {object[]} items - Array of {label, value} objects
 * @param {number} [labelWidth=20] - Width of label column
 * @returns {string}
 *
 * @example
 * keyValueList([
 *   { label: 'LLM provider', value: 'anthropic' },
 *   { label: 'GitHub configured', value: 'yes' }
 * ])
 */
export function keyValueList(items, labelWidth = 20) {
  return items.map(({ label, value }) => {
    const paddedLabel = label.padEnd(labelWidth);
    return `   ${type.metadata(paddedLabel)}${type.body(value)}`;
  }).join('\n');
}

/**
 * Render a contributor table (ranked list with counts).
 * Special formatting for GitHub analysis.
 *
 * @param {object[]} contributors - Array of {login, count}
 * @param {number} [limit=10] - Max contributors to show
 * @returns {string}
 *
 * @example
 * contributorTable([
 *   { login: 'phewww', count: 32 },
 *   { login: 'contributor2', count: 9 }
 * ])
 */
export function contributorTable(contributors, limit = 10) {
  const lines = [];
  const slice = contributors.slice(0, limit);

  const maxLoginWidth = Math.max(...slice.map(c => c.login.length), 10);

  for (const contributor of slice) {
    const login = contributor.login.padEnd(maxLoginWidth);
    const count = type.metadata(`${contributor.count} commits`);
    lines.push(`   ${type.body(login)}     ${count}`);
  }

  return lines.join('\n');
}

/**
 * Calculate optimal column widths based on content.
 * Adds padding for readability.
 *
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {number[]}
 */
function calculateWidths(headers, rows) {
  const numColumns = headers.length;
  const widths = new Array(numColumns).fill(0);

  // Measure headers
  headers.forEach((header, i) => {
    widths[i] = Math.max(widths[i], measure(header));
  });

  // Measure rows
  rows.forEach(row => {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i], measure(String(cell)));
    });
  });

  // Add padding
  return widths.map(w => w + 2);
}

/**
 * Render a compact status list (for audit/health displays).
 * Optimized for status row layout.
 *
 * @param {object[]} items - Array of {status, label, verdict, detail}
 * @returns {string}
 *
 * @example
 * statusList([
 *   { status: 'pass', label: 'api', verdict: '5/5 passing', detail: 'avg 23ms' },
 *   { status: 'warn', label: 'docs', verdict: 'stale', detail: '2h ago' }
 * ])
 */
export function statusList(items) {
  return items.map(item => statusRow({
    status: item.status,
    label: item.label,
    verdict: item.verdict,
    detail: item.detail,
  })).join('\n');
}

export default {
  table,
  keyValueList,
  contributorTable,
  statusList,
};
