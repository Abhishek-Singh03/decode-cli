/**
 * src/ui/panel.js
 * Panel component — bordered containers for previews and special content.
 *
 * Philosophy: Panels are rare. Most content flows freely.
 * Use panels only when content needs visual containment (previews, quotes, special sections).
 */
import chalk from 'chalk';
import { wrap, space } from './layout.js';
import * as type from './typography.js';

/**
 * Render a bordered panel with title.
 * Used for: documentation previews, AI summaries, special notices.
 *
 * @param {object} config
 * @param {string} [config.title] - Optional panel title
 * @param {string} config.content - Panel content
 * @param {number} [config.width=60] - Panel width
 * @param {string} [config.borderColor='cyan'] - Border color key
 * @param {boolean} [config.truncate=false] - Truncate long content
 * @param {number} [config.maxLines=20] - Max lines when truncating
 * @returns {string}
 *
 * @example
 * panel({
 *   title: 'Generated documentation preview',
 *   content: '# Architecture\n\nDeCode is...',
 *   truncate: true
 * })
 */
export function panel({ title, content, width = 60, borderColor = 'cyan', truncate = false, maxLines = 20 }) {
  const lines = [];

  // Prepare content
  let displayContent = content;
  let wasTruncated = false;

  if (truncate) {
    const contentLines = content.split('\n');
    if (contentLines.length > maxLines) {
      displayContent = contentLines.slice(0, maxLines).join('\n');
      wasTruncated = true;
    }
  }

  // Top border
  const topBorder = '┌' + '─'.repeat(width - 2) + '┐';
  lines.push(chalk[borderColor](topBorder));

  // Title line (if provided)
  if (title) {
    const titleLine = '│ ' + title.padEnd(width - 4) + ' │';
    lines.push(chalk[borderColor]('│') + type.body(' ' + title.padEnd(width - 4) + ' ') + chalk[borderColor]('│'));

    // Separator after title
    const separator = '├' + '─'.repeat(width - 2) + '┤';
    lines.push(chalk[borderColor](separator));
  }

  // Content lines
  const contentLines = displayContent.split('\n');
  for (const line of contentLines) {
    const truncatedLine = line.length > width - 4
      ? line.slice(0, width - 4)
      : line.padEnd(width - 4);

    lines.push(
      chalk[borderColor]('│') +
      ' ' + truncatedLine + ' ' +
      chalk[borderColor]('│')
    );
  }

  // Truncation notice
  if (wasTruncated) {
    const charCount = content.length;
    const notice = `(preview truncated — ${charCount.toLocaleString()} characters generated)`;
    const noticeLine = notice.padEnd(width - 4);
    lines.push(
      chalk[borderColor]('│') +
      ' ' + type.metadata(noticeLine) + ' ' +
      chalk[borderColor]('│')
    );
  }

  // Bottom border
  const bottomBorder = '└' + '─'.repeat(width - 2) + '┘';
  lines.push(chalk[borderColor](bottomBorder));

  return lines.join('\n');
}

/**
 * Render a simple boxed message (no border, just indentation + spacing).
 * Used for: AI summaries, quotes, important notices.
 *
 * @param {object} config
 * @param {string} [config.title] - Optional title
 * @param {string} config.content - Message content
 * @param {number} [config.width=70] - Max width for wrapping
 * @returns {string}
 *
 * @example
 * messageBox({
 *   title: 'Summary',
 *   content: 'The repository shows consistent daily activity...'
 * })
 */
export function messageBox({ title, content, width = 70 }) {
  const lines = [];

  if (title) {
    lines.push(type.emphasis(title));
    lines.push('');
  }

  // Wrap and indent content
  const wrapped = wrap(content, width);
  const indented = wrapped.split('\n').map(line => '   ' + line).join('\n');
  lines.push(indented);

  return lines.join('\n');
}

/**
 * Render a preview panel specifically for documentation.
 * Handles markdown content appropriately.
 *
 * @param {string} markdown - Markdown content
 * @param {number} [maxLines=20] - Max lines to show
 * @returns {string}
 */
export function docPreview(markdown, maxLines = 20) {
  return panel({
    content: markdown,
    width: 65,
    borderColor: 'cyan',
    truncate: true,
    maxLines,
  });
}

/**
 * Render an AI summary box.
 * Prose content, indented, no border (flows naturally).
 *
 * @param {string} summary - AI-generated summary text
 * @returns {string}
 */
export function aiSummary(summary) {
  const wrapped = wrap(summary, 70);
  return wrapped.split('\n').map(line => '   ' + type.body(line)).join('\n');
}

export default {
  panel,
  messageBox,
  docPreview,
  aiSummary,
};
