/**
 * src/index.js
 * App bootstrap — registers all commands with commander and parses argv.
 * bin/decode.js imports this file to run the CLI.
 *
 * Router design (ARCHITECTURE.md "High-Level Design"):
 * known commands are matched here; unmatched input will fall through to the
 * AI Agent Fallback (src/commands/agent.js) in a later milestone.
 */
import { Command } from 'commander';

import { NAME, DESCRIPTION, VERSION } from './constants.js';
import { initCommand } from './commands/init.js';
import { connectCommand } from './commands/connect.js';
import { disconnectCommand } from './commands/disconnect.js';
import { statusCommand } from './commands/status.js';
import { apiCommand } from './commands/api.js';
import { githubCommand } from './commands/github.js';
import { docCommand } from './commands/doc.js';

const program = new Command();

program
  .name(NAME)
  .description(DESCRIPTION)
  .version(VERSION, '-v, --version')
  .showHelpAfterError()
  .addCommand(initCommand())
  .addCommand(connectCommand())
  .addCommand(disconnectCommand())
  .addCommand(statusCommand())
  .addCommand(apiCommand())
  .addCommand(githubCommand())
  .addCommand(docCommand());

program.parse();
