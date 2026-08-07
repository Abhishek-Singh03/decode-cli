/**
 * src/utils/output.js
 * Terminal output formatting helpers. Centralizes chalk / cli-table3 / boxen
 * so command modules stay thin and the CLI's look & feel lives in one place
 * (AGENTS.md rule 7).
 */
import chalk from 'chalk';
import Table from 'cli-table3';
import boxen from 'boxen';

export function success(message) {
  console.log(`${chalk.green('✓')} ${message}`);
}

export function error(message) {
  console.error(`${chalk.red('✗')} ${message}`);
}

export function info(message) {
  console.log(chalk.blue(message));
}

export function warning(message) {
  console.log(chalk.yellow(`⚠ ${message}`));
}

export function heading(message) {
  console.log(chalk.bold(message));
}

export function dim(message) {
  console.log(chalk.dim(message));
}

export function printTable(headers, rows) {
  const table = new Table({
    head: headers.map((header) => chalk.bold(header)),
    style: { head: [], border: [] },
  });
  for (const row of rows) table.push(row);
  console.log(table.toString());
}

export function printBox(title, content, { borderColor = 'cyan' } = {}) {
  console.log(
    boxen(content, {
      title,
      titleAlignment: 'left',
      padding: 1,
      margin: 1,
      borderColor,
      borderStyle: 'round',
    }),
  );
}

export function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

export function plain(message) {
  console.log(message);
}
