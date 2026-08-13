/**
 * src/commands/connect.js
 * `decode connect <api-key>` — store an LLM/API provider key (PRD story 6, AC3).
 */
import { Command } from 'commander';

import { saveConnection } from '../services/configStore.js';
import * as output from '../utils/output.js';

export async function executeConnect(apiKey, opts) {
  try {
    if (!apiKey) {
      output.error('An API key is required: decode connect <api-key>');
      process.exitCode = 1;
      return;
    }
    saveConnection({ llmProvider: opts.provider, llmApiKey: apiKey });
    output.success('API key stored. Run `decode status` to verify.');
  } catch (err) {
    output.error(`connect failed: ${err.message}`);
    process.exitCode = 1;
  }
}

export function connectCommand() {
  return new Command('connect')
    .description('Store an LLM/API provider key')
    .argument('<api-key>', 'LLM/API provider key to store')
    .option('--provider <name>', 'LLM provider name', 'default')
    .action(async (apiKey, opts) => executeConnect(apiKey, opts));
}
