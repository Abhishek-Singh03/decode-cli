# Plan: Interactive Session (REPL) for DeCode CLI

**Date:** 2026-08-13  
**Feature:** Persistent interactive session — `decode` with no args starts a REPL  
**Spec:** `docs/superpowers/specs/2026-08-13-interactive-session-design.md`

---

## Header

### Goal
Add a persistent interactive REPL to `decode` so that `decode` (no args) drops users into a session where they can type `/api list`, `/audit`, `/init`, etc. without re-paying the startup cost each time. One-shot `decode <command>` is completely unchanged.

### Architecture
- **Entry gate** (`src/index.js`): `process.argv.length === 2` branch switches from `renderLandingScreen()` → `startSession()`.
- **Session** (`src/session/session.js`): single new file. Holds the REPL loop, dispatch table, slash-command parser, banner, `/help` renderer, and AI-seam stub.
- **Command modules** (`src/commands/*.js`): hoist inner action logic into named exported functions. `commander` `.action()` becomes a thin wrapper that delegates. No logic moves or changes — only visibility changes.
- **Config**: `readConfig()` called once at session start; the resolved config object is threaded into dispatch calls that need it.

### Tech Stack
No new dependencies. Uses:
- `inquirer` (already in `package.json`) for the prompt loop
- Existing `src/utils/output.js` for all output
- Existing `src/ui/prompt.js` `errorPrompt()` for error formatting
- `src/services/configStore.js` `readConfig()` for one-shot config load

### Global Constraints
- `decode <command>` (one-shot) must be bit-for-bit identical to today — no regression.
- Errors inside a dispatch call must never kill the session loop.
- Non-slash input → silent AI-seam stub (no error, no output).
- `/help` is generated from the dispatch table — single source of truth.
- All existing tests must continue to pass; lint must pass.

---

## File Map

| File | Status | Why |
|---|---|---|
| `src/index.js` | Modify | Change `argv.length === 2` branch to call `startSession()` |
| `src/session/session.js` | Create | REPL loop, dispatch, parser, banner, /help |
| `src/commands/api.js` | Modify | Export `executeApiList(opts)`, `executeApiCheck(opts)` |
| `src/commands/github.js` | Modify | Export `executeGithubConnect()`, `executeGithubProfile(opts)`, `executeGithubAnalyze(opts)` |
| `src/commands/doc.js` | Modify | Export `executeDoc(message, opts)`, `executeDocCheck(opts)` |
| `src/commands/audit.js` | Modify | Export `executeAudit(opts)` (function already named, add `export`) |
| `src/commands/init.js` | Modify | Export `executeInit(opts)` |
| `src/commands/connect.js` | Modify | Export `executeConnect(apiKey, opts)` |
| `src/commands/disconnect.js` | Modify | Export `executeDisconnect(opts)` |
| `src/commands/status.js` | Modify | Export `executeStatus()` |
| `src/commands/config.js` | Modify | Export `executeConfigList(opts)`, `executeConfigSet(key, value, opts)`, `executeConfigReset(opts)` |
| `test/unit/session.test.js` | Create | Unit tests for parser, dispatch, /help renderer |
| `test/integration/session.test.js` | Create | Integration: spawn decode, pipe slash commands, assert stdout |
| `README.md` | Modify | Add "Interactive Session" section |
| `ARCHITECTURE.md` | Modify | Add `src/session/session.js` to folder map + design paragraph |
| `TASKS.md` | Modify | Add task log entry |

---

## Tasks

### Task 1 — Export action functions from command modules

**Why first:** Session dispatch table imports these. Everything else depends on them existing.

**Files touched:** `src/commands/api.js`, `github.js`, `doc.js`, `audit.js`, `init.js`, `connect.js`, `disconnect.js`, `status.js`, `config.js`

**Pattern for each file:**
1. Identify the anonymous function currently passed to `.action()`
2. Hoist it to a named exported function (e.g. `export async function executeApiList(opts) { ... }`)
3. Replace the `.action()` callback body with a single delegating call: `.action((opts) => executeApiList(opts))`
4. For multi-arg commands (connect, config set) pass all args through: `.action((key, value, opts) => executeConfigSet(key, value, opts))`

**Subtask 1a — `src/commands/api.js`**

```
Step 1: Write failing test
  File: test/unit/session.test.js (stub with just the import assertion)
  Content:
    import { executeApiList, executeApiCheck } from '../../src/commands/api.js';
    it('exports executeApiList', () => { expect(typeof executeApiList).toBe('function'); });
    it('exports executeApiCheck', () => { expect(typeof executeApiCheck).toBe('function'); });

Step 2: Run test → expect FAIL (named exports don't exist yet)
  $ npx vitest run test/unit/session.test.js

Step 3: Implement
  In api.js, the .action() on apiListCommand() contains the list logic (lines ~39–70).
  Extract it:
    export async function executeApiList(opts) {
      // move the entire try/catch block here verbatim
    }
  Then update .action():
    .action((opts) => executeApiList(opts))
  
  Same for apiCheckCommand() (lines ~72–138):
    export async function executeApiCheck(opts) { ... }
    .action((opts) => executeApiCheck(opts))

Step 4: Run test → expect PASS

Step 5: Run full suite → confirm no regressions
  $ npx vitest run
```

**Subtask 1b — `src/commands/github.js`**

```
Step 1: Add to test/unit/session.test.js:
  import { executeGithubConnect, executeGithubProfile, executeGithubAnalyze } from '../../src/commands/github.js';
  // three typeof assertions

Step 2: Run → FAIL

Step 3: Implement in github.js
  githubCommand().addCommand(connectCommand()) — the inner connectCommand() contains async action logic.
  Extract to:
    export async function executeGithubConnect() { /* move action body */ }
    .action(() => executeGithubConnect())

  profileCommand() action:
    export async function executeGithubProfile(opts) { /* move action body */ }
    .action((opts) => executeGithubProfile(opts))

  analyzeCommand() action:
    export async function executeGithubAnalyze(opts) { /* move action body */ }
    .action((opts) => executeGithubAnalyze(opts))

Step 4: Run test → PASS
Step 5: Run full suite → no regressions
```

**Subtask 1c — `src/commands/doc.js`**

```
Note: generateFlow() and explainFlow() are ALREADY named functions (lines 70+).
The docCommand() .action() just routes between them. checkCommand() is also internal.

Step 1: Add to session.test.js:
  import { executeDoc, executeDocCheck } from '../../src/commands/doc.js';

Step 2: Run → FAIL

Step 3: Implement
  Export generateFlow as executeDoc — rename and export:
    export async function executeDoc(message, opts) {  /* was generateFlow */ }
  
  The .action() in docCommand():
    .action((message, opts) => {
      if (opts.explain !== undefined) return explainFlow(message, opts);
      return executeDoc(message, opts);
    })
  
  The checkCommand() internal function → export as executeDocCheck:
    export function executeDocCheck(opts) { /* was checkCommand() action body */ }
  The checkCommand() .action():
    .action((opts) => executeDocCheck(opts))

Step 4: Run → PASS
Step 5: Full suite → no regressions
```

**Subtask 1d — `src/commands/audit.js`**

```
Step 1: Add to session.test.js:
  import { executeAudit } from '../../src/commands/audit.js';

Step 2: Run → FAIL

Step 3: Implement
  audit.js already has a named inner function executeAudit(opts) (line ~27).
  Simply add the export keyword: export async function executeAudit(opts) { ... }
  The .action() already calls it: .action((opts) => executeAudit(opts))  ← verify this is the case;
  if it's an inline anonymous function, hoist the same way.

Step 4: Run → PASS
Step 5: Full suite → no regressions
```

**Subtask 1e — `src/commands/init.js`**

```
Step 1: Add import { executeInit } assertion to session.test.js
Step 2: Run → FAIL
Step 3: In init.js, the .action() is:
    async (opts) => { try { const scope = await resolveScope... } }
  Extract to:
    export async function executeInit(opts) {
      const scope = await resolveScope(opts);
      const answers = await gatherCredentials(opts);
      saveConnection({ ... }, { scope });
      output.success(...);
    }
  .action((opts) => executeInit(opts))
Step 4: Run → PASS
Step 5: Full suite → no regressions
```

**Subtask 1f — `src/commands/connect.js`**

```
Step 1: Add import { executeConnect } assertion
Step 2: Run → FAIL
Step 3: Extract action body:
    export async function executeConnect(apiKey, opts) { ... }
    .action((apiKey, opts) => executeConnect(apiKey, opts))
Step 4: Run → PASS
Step 5: Full suite → no regressions
```

**Subtask 1g — `src/commands/disconnect.js`**

```
Step 1: Add import { executeDisconnect } assertion
Step 2: Run → FAIL
Step 3: Export:
    export async function executeDisconnect(opts) { ... }
    .action((opts) => executeDisconnect(opts))
Step 4: Run → PASS
Step 5: Full suite → no regressions
```

**Subtask 1h — `src/commands/status.js`**

```
Step 1: Add import { executeStatus } assertion
Step 2: Run → FAIL
Step 3: Export:
    export function executeStatus() { ... }
    .action(() => executeStatus())
Step 4: Run → PASS
Step 5: Full suite → no regressions
```

**Subtask 1i — `src/commands/config.js`**

```
Step 1: Add import { executeConfigList, executeConfigSet, executeConfigReset } assertions
Step 2: Run → FAIL
Step 3: In config.js:
  configListCommand() action → export function executeConfigList(opts) { ... }
  configSetCommand() action  → export function executeConfigSet(key, value, opts) { ... }
  configResetCommand() action → export async function executeConfigReset(opts) { ... }
  Each .action() delegates: .action((opts) => executeConfigList(opts)), etc.
Step 4: Run → PASS
Step 5: Full suite → no regressions
```

**Commit after Task 1:** `feat: export action functions from all command modules for session dispatch`

---

### Task 2 — Create `src/session/session.js`

**Why:** The core REPL loop and dispatch table. Depends on Task 1 (imports from command modules).

**Full file structure:**

```javascript
// src/session/session.js
import readline from 'node:readline';
import * as output from '../utils/output.js';
import { readConfig } from '../services/configStore.js';

// Command action imports
import { executeApiList, executeApiCheck } from '../commands/api.js';
import { executeGithubConnect, executeGithubProfile, executeGithubAnalyze } from '../commands/github.js';
import { executeDoc, executeDocCheck } from '../commands/doc.js';
import { executeAudit } from '../commands/audit.js';
import { executeInit } from '../commands/init.js';
import { executeConnect } from '../commands/connect.js';
import { executeDisconnect } from '../commands/disconnect.js';
import { executeStatus } from '../commands/status.js';
import { executeConfigList, executeConfigSet, executeConfigReset } from '../commands/config.js';
```

**Dispatch table** (maps slash-command string → handler):

Each entry shape: `{ handler: async (args, opts) => ..., description: '...' }`

```javascript
const DISPATCH = {
  'api list':        { handler: (_, opts) => executeApiList(opts),           description: 'List detected API routes' },
  'api check':       { handler: (_, opts) => executeApiCheck(opts),          description: 'Health-check detected routes against a running backend' },
  'github connect':  { handler: () => executeGithubConnect(),                description: 'Authenticate with GitHub' },
  'github profile':  { handler: (_, opts) => executeGithubProfile(opts),     description: 'Show your GitHub profile and commit activity' },
  'github analyze':  { handler: (_, opts) => executeGithubAnalyze(opts),     description: 'Analyse a repo\'s commits (with optional AI summary)' },
  'doc':             { handler: ([msg], opts) => executeDoc(msg, opts),       description: 'Generate project documentation' },
  'doc check':       { handler: (_, opts) => executeDocCheck(opts),          description: 'Report whether documentation is stale' },
  'audit':           { handler: (_, opts) => executeAudit(opts),             description: 'Run all core checks and report a combined summary' },
  'init':            { handler: (_, opts) => executeInit(opts),               description: 'Interactive setup wizard — connect LLM provider and GitHub' },
  'connect':         { handler: ([key], opts) => executeConnect(key, opts),   description: 'Store an LLM API key' },
  'disconnect':      { handler: (_, opts) => executeDisconnect(opts),         description: 'Remove stored credentials' },
  'status':          { handler: () => executeStatus(),                        description: 'Show connection state and last audit result' },
  'config list':     { handler: (_, opts) => executeConfigList(opts),         description: 'Show the effective configuration' },
  'config set':      { handler: ([k,v], opts) => executeConfigSet(k, v, opts),description: 'Set a config value by dotted key' },
  'config reset':    { handler: (_, opts) => executeConfigReset(opts),        description: 'Reset config to defaults' },
};
```

**Group definitions** (for group-level slash command help, e.g. `/api` alone):

```javascript
const GROUPS = {
  api:     'Auto-detect and health-check your API routes',
  github:  'GitHub activity analysis and authentication',
  doc:     'Documentation generation and freshness checks',
  config:  'View and update configuration',
};
```

**Slash command parser:**

```javascript
// parseSlashInput('/api list --json')
// → { command: 'api list', positional: [], opts: { json: true } }
// parseSlashInput('/api')
// → { command: 'api', positional: [], opts: {} }
export function parseSlashInput(raw) {
  const trimmed = raw.trimStart().replace(/^\//, '');
  const tokens = trimmed.split(/\s+/);
  const positional = [];
  const opts = {};
  const commandTokens = [];

  // Consume command tokens until we hit a flag or run out
  // Logic: first token is always the command group (api, github, doc, ...)
  // Second token may be a subcommand (list, check, connect, ...) if not a flag
  // Remaining tokens are positional args or flags
  let i = 0;
  while (i < tokens.length && !tokens[i].startsWith('-')) {
    commandTokens.push(tokens[i]);
    i++;
    // Command is at most 2 tokens (group + subcommand)
    if (commandTokens.length === 2) break;
  }
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      // Next token is value if it doesn't start with -
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        opts[camelCase(key)] = tokens[i + 1];
        i += 2;
      } else {
        opts[camelCase(key)] = true;
        i++;
      }
    } else {
      positional.push(tok);
      i++;
    }
  }

  return { command: commandTokens.join(' '), positional, opts };
}
```

**`/help` renderer:**

```javascript
function renderHelp() {
  output.heading('Available commands');
  // Group commands by their first token
  const grouped = {};
  for (const [cmd, entry] of Object.entries(DISPATCH)) {
    const group = cmd.split(' ')[0];
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push({ cmd, description: entry.description });
  }
  for (const [group, entries] of Object.entries(grouped)) {
    output.info(`  /${group}`);
    for (const { cmd, description } of entries) {
      output.dim(`    /${cmd.padEnd(20)} ${description}`);
    }
  }
  output.dim('');
  output.dim('  /exit   End the session');
  output.dim('  /help   Show this help');
  output.dim('');
  output.dim('Flags work after any command: /api list --json');
}
```

**`startSession()` — main REPL loop:**

```javascript
export async function startSession() {
  const config = readConfig();  // load once
  printBanner(config);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  // Handle Ctrl+D (EOF)
  rl.on('close', () => {
    output.dim('\nGoodbye.');
    process.exit(0);
  });

  // Handle Ctrl+C — readline emits SIGINT
  rl.on('SIGINT', () => {
    output.dim('\nGoodbye.');
    rl.close();
    process.exit(0);
  });

  const prompt = () => {
    rl.question('decode> ', async (line) => {
      const input = line.trim();

      if (!input) { prompt(); return; }

      if (input === '/exit') {
        output.dim('Goodbye.');
        rl.close();
        process.exit(0);
      }

      if (input === '/help') {
        renderHelp();
        prompt();
        return;
      }

      if (input.startsWith('/')) {
        const { command, positional, opts } = parseSlashInput(input);

        // Group-level command: show mini help
        if (GROUPS[command]) {
          renderGroupHelp(command);
          prompt();
          return;
        }

        const entry = DISPATCH[command];
        if (!entry) {
          output.error(`Unknown command: /${command}. Type /help to see available commands.`);
          prompt();
          return;
        }

        try {
          await entry.handler(positional, opts);
        } catch (err) {
          // Error never kills the session
          const { errorPrompt } = await import('../ui/prompt.js');
          const formatted = errorPrompt({
            type: 'Command failed',
            explanation: err.message || 'An unexpected error occurred.',
            actions: [{ command: '/help', description: 'see available commands' }],
          });
          output.plain(formatted);
        }
        prompt();
        return;
      }

      // Non-slash input: AI agent seam (intentionally empty — AI agent will handle this branch)
      prompt();
    });
  };

  prompt();
}
```

**`printBanner()`:**

```javascript
function printBanner(config) {
  output.heading('DeCode — Interactive Session');
  output.dim('Type /help for available commands, /exit to quit.');
  if (!config.llm?.configured) {
    output.info('Tip: run /init to set up your LLM provider and GitHub token.');
  }
}
```

**`renderGroupHelp(group)`:**

```javascript
function renderGroupHelp(group) {
  output.info(`/${group} subcommands:`);
  for (const [cmd, entry] of Object.entries(DISPATCH)) {
    if (cmd.startsWith(group + ' ')) {
      output.dim(`  /${cmd.padEnd(22)} ${entry.description}`);
    }
  }
}
```

**Step-by-step TDD:**

```
Step 1: Write failing unit tests in test/unit/session.test.js
  - parseSlashInput('/api list --json') → { command: 'api list', positional: [], opts: { json: true } }
  - parseSlashInput('/api') → { command: 'api', positional: [], opts: {} }
  - parseSlashInput('/config set llm.provider openai') → { command: 'config set', positional: ['llm.provider', 'openai'], opts: {} }
  - parseSlashInput('/audit') → { command: 'audit', positional: [], opts: {} }
  - parseSlashInput('/connect mykey123') → { command: 'connect', positional: ['mykey123'], opts: {} }

Step 2: Run → FAIL (session.js doesn't exist)

Step 3: Create src/session/session.js with full implementation above

Step 4: Run unit tests → PASS

Step 5: Run full test suite → PASS

Step 6: Manual smoke test:
  $ node bin/decode.js
  Should show banner and decode> prompt
  Type /help → grouped command list
  Type /api → mini help for api subcommands
  Type /unknown → "Unknown command" error, prompt continues
  Type /exit → clean exit
  Ctrl+C → clean exit
```

**Commit after Task 2:** `feat: add src/session/session.js with REPL loop and dispatch table`

---

### Task 3 — Update `src/index.js` entry point

**Why:** Gate that triggers the session when no args are given.

**Current code (lines ~1–50):**

```javascript
// Near bottom of src/index.js, the no-args branch:
if (process.argv.length === 2) {
  renderLandingScreen();
  process.exit(0);
}
```

**Change to:**

```javascript
import { startSession } from './session/session.js';

// ...

if (process.argv.length === 2) {
  await startSession();
  process.exit(0);
}
```

(The `renderLandingScreen` import can stay — it's used nowhere else, but removing it avoids dead import. Remove the import of `renderLandingScreen` if it's only used in this branch.)

**TDD steps:**

```
Step 1: Run existing integration test suite → confirm all pass (baseline)
  $ npx vitest run test/integration/

Step 2: Implement the change in src/index.js

Step 3: Verify one-shot path unchanged:
  $ node bin/decode.js status
  $ node bin/decode.js api list
  $ node bin/decode.js --help
  All should work exactly as before.

Step 4: Verify session path:
  $ echo '/exit' | node bin/decode.js
  Should print banner + prompt + goodbye, exit 0.

Step 5: Run full test suite → PASS
```

**Commit after Task 3:** `feat: wire src/index.js to start interactive session when no args given`

---

### Task 4 — Write `test/unit/session.test.js`

**Why:** Unit-test the pure functions in session.js (parser, dispatch lookup, help renderer output). Written iteratively alongside Tasks 1–3, but the final full file is committed here.

**Test cases:**

```javascript
// test/unit/session.test.js
import { describe, it, expect } from 'vitest';
import { parseSlashInput } from '../../src/session/session.js';

describe('parseSlashInput', () => {
  it('parses a two-token command with a boolean flag', () => {
    expect(parseSlashInput('/api list --json')).toEqual({
      command: 'api list', positional: [], opts: { json: true }
    });
  });

  it('parses a group-only command', () => {
    expect(parseSlashInput('/api')).toEqual({
      command: 'api', positional: [], opts: {}
    });
  });

  it('parses positional args after a two-token command', () => {
    expect(parseSlashInput('/config set llm.provider openai')).toEqual({
      command: 'config set', positional: ['llm.provider', 'openai'], opts: {}
    });
  });

  it('parses a single-token command', () => {
    expect(parseSlashInput('/audit')).toEqual({
      command: 'audit', positional: [], opts: {}
    });
  });

  it('parses a positional arg on a connect command', () => {
    expect(parseSlashInput('/connect mykey123')).toEqual({
      command: 'connect', positional: ['mykey123'], opts: {}
    });
  });

  it('parses a flag with a value', () => {
    expect(parseSlashInput('/api check --base-url http://localhost:3000')).toEqual({
      command: 'api check', positional: [], opts: { baseUrl: 'http://localhost:3000' }
    });
  });

  it('handles extra whitespace', () => {
    expect(parseSlashInput('  /api   list  --json  ')).toEqual({
      command: 'api list', positional: [], opts: { json: true }
    });
  });

  it('handles missing leading slash', () => {
    // parseSlashInput already strips leading /; if called without, still parses
    expect(parseSlashInput('audit')).toEqual({
      command: 'audit', positional: [], opts: {}
    });
  });
});
```

**Run:** `$ npx vitest run test/unit/session.test.js`

**Commit after Task 4:** `test: add unit tests for session slash command parser`

---

### Task 5 — Write `test/integration/session.test.js`

**Why:** End-to-end confirmation that the session starts, responds to slash commands, and exits cleanly — using the same `execa` pattern as `test/integration/cli.test.js`.

**Pattern reference:** `test/integration/cli.test.js` uses:

```javascript
import { execa } from 'execa';
const CLI = new URL('../../bin/decode.js', import.meta.url).pathname;
const run = (args, opts) => execa(process.execPath, [CLI, ...args], { reject: false, ...opts });
```

**Test cases:**

```javascript
// test/integration/session.test.js
import { describe, it, expect } from 'vitest';
import { execa } from 'execa';

const CLI = new URL('../../bin/decode.js', import.meta.url).pathname;

async function runSession(input) {
  return execa(process.execPath, [CLI], {
    reject: false,
    input,                        // piped stdin
    timeout: 10_000,
  });
}

describe('interactive session', () => {
  it('starts a session when called with no args and exits on /exit', async () => {
    const { stdout, exitCode } = await runSession('/exit\n');
    expect(stdout).toMatch(/DeCode/);          // banner present
    expect(stdout).toMatch(/decode>/);          // prompt present
    expect(exitCode).toBe(0);
  });

  it('shows /help output listing known commands', async () => {
    const { stdout } = await runSession('/help\n/exit\n');
    expect(stdout).toMatch(/\/api/);
    expect(stdout).toMatch(/\/audit/);
    expect(stdout).toMatch(/\/init/);
    expect(stdout).toMatch(/\/status/);
    expect(stdout).toMatch(/\/config/);
  });

  it('shows group help for /api alone', async () => {
    const { stdout } = await runSession('/api\n/exit\n');
    expect(stdout).toMatch(/api list/);
    expect(stdout).toMatch(/api check/);
  });

  it('prints an error for an unknown slash command but continues the session', async () => {
    const { stdout, exitCode } = await runSession('/unknowncmd\n/exit\n');
    expect(stdout).toMatch(/Unknown command/);
    expect(exitCode).toBe(0);    // session continued and exited cleanly
  });

  it('silently ignores non-slash input (AI seam)', async () => {
    const { stdout, exitCode } = await runSession('hello world\n/exit\n');
    // no error message, banner still there, exits cleanly
    expect(stdout).not.toMatch(/error/i);
    expect(exitCode).toBe(0);
  });

  it('one-shot commands are unaffected by the session change', async () => {
    // Verify the non-session path still works
    const { stdout, exitCode } = await execa(process.execPath, [CLI, '--help'], { reject: false });
    expect(stdout).toMatch(/decode/i);
    expect(exitCode).toBe(0);
  });
});
```

**Run:** `$ npx vitest run test/integration/session.test.js`

**Commit after Task 5:** `test: add integration tests for interactive session`

---

### Task 6 — Update docs and TASKS.md

**Files and changes:**

**`README.md`** — add after the "Commands" section:

```markdown
## Interactive Session

Run `decode` with no arguments to start a persistent session:

```
$ decode
DeCode — Interactive Session
Type /help for available commands, /exit to quit.
decode> /api list
decode> /audit
decode> /init
decode> /exit
Goodbye.
```

All commands work exactly as in one-shot mode. Flags apply after slash commands:
```
decode> /api check --base-url http://localhost:3000
decode> /config list --json
```
```

**`ARCHITECTURE.md`** — add `src/session/session.js` to the folder structure table, and add a paragraph to the High-Level Design section:

> **Interactive Session.** `src/session/session.js` implements the REPL loop. When `decode` is invoked with no arguments, `src/index.js` calls `startSession()` instead of printing the landing screen. The session loads config once, then presents a `decode>` prompt using Node's built-in `readline`. Slash commands (`/api list --json`) are parsed by `parseSlashInput()` and dispatched via a table that maps command strings to exported action functions in the command modules. Non-slash input is a silent stub reserved for a future AI agent. Errors inside a dispatch are caught and formatted with `errorPrompt()` — the session loop never terminates on a bad command.

**`TASKS.md`** — append a task log entry for this feature.

**Commit after Task 6:** `docs: add interactive session docs to README and ARCHITECTURE.md`

---

## Final Verification

After all tasks are committed, run the full suite and lint:

```
$ npx vitest run
$ npm run lint
```

Both must pass with zero failures before the feature is considered done.

One-shot regression spot-check:

```
$ node bin/decode.js status
$ node bin/decode.js --help
$ node bin/decode.js api list
```

All should behave identically to before.
