/**
 * test/unit/session.test.js
 * Unit tests for the interactive session module.
 * Parser tests run here; dispatch/REPL tests are in test/integration/session.test.js.
 */
import { describe, it, expect } from 'vitest';

// --- Task 1: verify named exports exist on every command module ---

import { executeApiList, executeApiCheck } from '../../src/commands/api.js';
import {
  executeGithubConnect,
  executeGithubProfile,
  executeGithubAnalyze,
} from '../../src/commands/github.js';
import { executeDoc, executeDocCheck } from '../../src/commands/doc.js';
import { executeAudit } from '../../src/commands/audit.js';
import { executeInit } from '../../src/commands/init.js';
import { executeConnect } from '../../src/commands/connect.js';
import { executeDisconnect } from '../../src/commands/disconnect.js';
import { executeStatus } from '../../src/commands/status.js';
import {
  executeConfigList,
  executeConfigSet,
  executeConfigReset,
} from '../../src/commands/config.js';

describe('command module exports', () => {
  it('api exports executeApiList', () => { expect(typeof executeApiList).toBe('function'); });
  it('api exports executeApiCheck', () => { expect(typeof executeApiCheck).toBe('function'); });
  it('github exports executeGithubConnect', () => { expect(typeof executeGithubConnect).toBe('function'); });
  it('github exports executeGithubProfile', () => { expect(typeof executeGithubProfile).toBe('function'); });
  it('github exports executeGithubAnalyze', () => { expect(typeof executeGithubAnalyze).toBe('function'); });
  it('doc exports executeDoc', () => { expect(typeof executeDoc).toBe('function'); });
  it('doc exports executeDocCheck', () => { expect(typeof executeDocCheck).toBe('function'); });
  it('audit exports executeAudit', () => { expect(typeof executeAudit).toBe('function'); });
  it('init exports executeInit', () => { expect(typeof executeInit).toBe('function'); });
  it('connect exports executeConnect', () => { expect(typeof executeConnect).toBe('function'); });
  it('disconnect exports executeDisconnect', () => { expect(typeof executeDisconnect).toBe('function'); });
  it('status exports executeStatus', () => { expect(typeof executeStatus).toBe('function'); });
  it('config exports executeConfigList', () => { expect(typeof executeConfigList).toBe('function'); });
  it('config exports executeConfigSet', () => { expect(typeof executeConfigSet).toBe('function'); });
  it('config exports executeConfigReset', () => { expect(typeof executeConfigReset).toBe('function'); });
});

// --- Task 2: parseSlashInput parser ---
// (imported once session.js exists; skipped here until that file is created)
