/**
 * src/commands/help.js
 * Custom landing screen — DeCode's premium developer identity.
 *
 * Philosophy: The landing screen is the first impression.
 * It should feel like a premium developer tool.
 * Think: Linear, Raycast, Ghostty, Claude Code.
 */
import chalk from 'chalk';
import * as renderer from '../ui/renderer.js';
import * as terminal from '../ui/terminal.js';

/**
 * Render the official DeCode landing screen.
 * This replaces Commander.js default help.
 */
export function renderLandingScreen() {
  const lines = [];

  // Blank line at top for breathing room
  lines.push('');

  // Official DeCode terminal mark (pure white, centered)
  const mark = [
    '    ╲╱╲',
    '   ❯╳❮',
    '    ╱╲╱',
  ];

  mark.forEach(line => {
    lines.push(chalk.white(centerText(line, 60)));
  });

  lines.push('');

  // Brand name + tagline
  lines.push(chalk.white(centerText('DeCode', 60)));
  lines.push('');
  lines.push(chalk.dim(centerText('Your project, decoded.', 60)));

  lines.push('');
  lines.push('');

  // Divider
  lines.push(chalk.dim('─'.repeat(60)));

  lines.push('');

  // Start Here section
  lines.push(chalk.white.bold('Start Here'));
  lines.push('');
  lines.push(formatCommand('decode init', 'Connect GitHub & AI provider'));
  lines.push(formatCommand('decode review .', 'AI-powered project review'));
  lines.push(formatCommand('decode audit', 'Complete project health check'));

  lines.push('');

  // Divider
  lines.push(chalk.dim('─'.repeat(60)));

  lines.push('');

  // Available Commands heading
  lines.push(chalk.white.bold('Available Commands'));

  lines.push('');

  // Available Commands section (premium terminal cards)
  const terminalWidth = terminal.getWidth();
  const useGridLayout = terminalWidth >= 85; // 2×2 grid if wide enough, otherwise stack

  if (useGridLayout) {
    // 2×2 Grid layout (left-aligned)
    const cardGrid = buildCardGrid();
    cardGrid.split('\n').forEach(line => {
      lines.push(line);
    });
  } else {
    // Stacked layout for narrow terminals (left-aligned)
    const cards = buildCardsStacked();
    cards.forEach(card => {
      lines.push(card);
    });
  }

  lines.push('');

  // Divider
  lines.push(chalk.dim('─'.repeat(60)));

  lines.push('');

  // Ready prompt
  lines.push(chalk.dim('Ready.'));

  lines.push('');

  // Render
  renderer.render(lines.join('\n'));
}

/**
 * Center text within a given width.
 * If text is wider than width, return as-is.
 */
function centerText(text, width) {
  // Strip ANSI codes to get true text length
  const strippedText = text.replace(/\u001b\[\d+m/g, '');

  if (strippedText.length >= width) {
    return text; // Text too wide, return as-is
  }

  const padding = Math.floor((width - strippedText.length) / 2);
  return ' '.repeat(padding) + text;
}

/**
 * Format a command with description (for "Start Here" section).
 */
function formatCommand(command, description) {
  return `${chalk.white(command.padEnd(20))}${chalk.dim(description)}`;
}

/**
 * Format a simple command name (for grouped sections).
 */
function formatCommandSimple(name) {
  return `${chalk.white(name)}`;
}

/**
 * Build a single command card with Unicode box borders.
 */
function buildCard(title, commands) {
  const cardWidth = 35;
  const innerWidth = cardWidth - 4; // Account for borders and padding

  const lines = [];

  // Top border with title
  const titleText = `❯ ${title}`;
  const titlePadding = innerWidth - titleText.length - 1;
  lines.push(chalk.white(`┌─ ${titleText} ${'─'.repeat(titlePadding)}┐`));

  // Empty line for spacing
  lines.push(chalk.white(`│${' '.repeat(innerWidth + 2)}│`));

  // Commands (padded)
  commands.forEach(cmd => {
    const cmdText = `  ${cmd}`;
    const cmdPadding = innerWidth + 2 - cmdText.length;
    lines.push(chalk.white(`│${cmdText}${' '.repeat(cmdPadding)}│`));
  });

  // Fill remaining space to maintain consistent card height
  const maxCommands = 3;
  const emptyLines = maxCommands - commands.length;
  for (let i = 0; i < emptyLines; i++) {
    lines.push(chalk.white(`│${' '.repeat(innerWidth + 2)}│`));
  }

  // Empty line for spacing
  lines.push(chalk.white(`│${' '.repeat(innerWidth + 2)}│`));

  // Bottom border
  lines.push(chalk.white(`└${'─'.repeat(innerWidth + 2)}┘`));

  return lines;
}

/**
 * Build 2×2 grid of cards for wide terminals.
 */
function buildCardGrid() {
  const setupCard = buildCard('Setup', ['init', 'connect', 'disconnect']);
  const diagnosticsCard = buildCard('Diagnostics', ['review', 'audit', 'status']);
  const analysisCard = buildCard('Analysis', ['api', 'github', 'doc']);
  const configCard = buildCard('Configuration', ['config']);

  const gridLines = [];
  const cardGap = '    '; // 4 spaces between cards

  // Row 1: Setup + Diagnostics
  for (let i = 0; i < setupCard.length; i++) {
    gridLines.push(setupCard[i] + cardGap + diagnosticsCard[i]);
  }

  gridLines.push(''); // Gap between rows

  // Row 2: Analysis + Configuration
  for (let i = 0; i < analysisCard.length; i++) {
    gridLines.push(analysisCard[i] + cardGap + configCard[i]);
  }

  return gridLines.join('\n');
}

/**
 * Build stacked cards for narrow terminals.
 */
function buildCardsStacked() {
  const setupCard = buildCard('Setup', ['init', 'connect', 'disconnect']);
  const diagnosticsCard = buildCard('Diagnostics', ['review', 'audit', 'status']);
  const analysisCard = buildCard('Analysis', ['api', 'github', 'doc']);
  const configCard = buildCard('Configuration', ['config']);

  const stacked = [];

  stacked.push(setupCard.join('\n'));
  stacked.push('');
  stacked.push(diagnosticsCard.join('\n'));
  stacked.push('');
  stacked.push(analysisCard.join('\n'));
  stacked.push('');
  stacked.push(configCard.join('\n'));

  return stacked;
}
