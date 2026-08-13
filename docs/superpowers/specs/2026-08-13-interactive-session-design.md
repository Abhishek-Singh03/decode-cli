# Interactive Session Mode — Design Spec

**Date:** 2026-08-13
**Status:** Approved
**Author:** Ahmed Raza Khan + Antigravity

---

## Overview

Add a persistent interactive REPL session to DeCode on top of the existing one-shot CLI. Running `decode` with no arguments starts the session; `decode <command>` continues to work exactly as it does today.

The session dispatches to the same exported action functions the one-shot CLI uses — no command logic is duplicated or reimplemented inside the session.

---

## 1. Entry Point Change

**File:** `src/index.js`

The `process.argv.length === 2` branch currently calls `renderLandingScreen()` and exits with code 0. This changes to call `startSession()` imported from `src/session/session.js`.

All other paths (one-shot `decode <command>`) are completely untouched — commander handles them exactly as before.

`bin/decode.js` is unchanged.

---

## 2. Session Module

**File:** `src/session/session.js`

### Startup

1. Load config once via `readConfig()` from `src/services/configStore.js`.
2. Detect project root (already done by `readConfig` internally).
3. Print a short banner: project path, config source (local/global), and `/help for commands, /exit to quit`.

### REPL Loop

- Uses `inquirer` (already a project dependency, used in `init.js`) with an `input` prompt. No new dependencies.
- Runs a `while (true)` loop, reading one line at a time.
- `Ctrl+C` and `Ctrl+D` are caught and exit the process cleanly.

### Input Handling

Two branches, decided by whether the input starts with `/`:

**Slash commands** (`/` prefix):
- Parsed as: command token(s) + flags.
- Example: `/api list --json` → command `api list`, opts `{ json: true }`.
- Dispatched via the dispatch table (see below).
- `/api` or `/config` or `/github` with no subcommand → prints a mini help block listing the group's subcommands with descriptions.
- Unrecognized slash command (e.g. `/foo`) → prints `Not a recognized command. Type /help to see available commands.`

**Non-slash input (AI agent seam):**
```js
// EXTENSION POINT: route non-slash input to the AI assistant here.
// In a future iteration, this branch calls the assistant instead of no-oping.
```
This branch is intentionally empty in this iteration. No error is shown to the user.

### Dispatch Table

A plain object mapping command token strings to `{ fn, description }` entries. Descriptions are the single source of truth for `/help` — no second hand-written list.

Full surface:

| Slash command | Maps to | Description |
|---|---|---|
| `/init` | `executeInit(opts)` | interactive setup wizard — connect LLM and GitHub |
| `/connect` | `executeConnect(apiKey, opts)` | store an LLM/API provider key |
| `/disconnect` | `executeDisconnect(opts)` | remove stored credentials |
| `/status` | `executeStatus()` | show connection state and last audit result |
| `/config list` | `executeConfigList(opts)` | show effective config and scope each value came from |
| `/config set` | `executeConfigSet(key, value, opts)` | update a config value |
| `/config reset` | `executeConfigReset(opts)` | reset config to defaults |
| `/api list` | `executeApiList(opts)` | scan and list detected API routes |
| `/api check` | `executeApiCheck(opts)` | health-check routes against a running backend |
| `/github connect` | `executeGithubConnect(opts)` | verify your GitHub token |
| `/github profile` | `executeGithubProfile(opts)` | show profile and recent commit history |
| `/github analyze` | `executeGithubAnalyze(opts)` | analyze a repo's commit activity |
| `/doc` | `executeDoc(opts)` | generate documentation |
| `/audit` | `executeAudit(opts)` | run all checks and show a combined summary |
| `/help` | `showSessionHelp()` | show this list |
| `/exit` | exits loop | quit the session |

### Flag Parsing

Tokens after the command name are parsed into an opts object:
- Boolean flags: `--json` → `{ json: true }`
- Value flags: `--base-url http://localhost:3000` → `{ baseUrl: 'http://localhost:3000' }`
- Arguments (positional): collected as an array and passed as the first parameter where the command expects them (e.g. `/connect <api-key>`).

### Error Handling

Each dispatch call is wrapped in `try/catch`. Errors are formatted with `ui.errorPrompt()` (same pattern as one-shot commands) and printed. The loop continues — one bad command never kills the session.

### Session State (in-memory)

- Config object loaded at startup, held in closure.
- `history` array of command strings (for future use — not exposed in this iteration).
- Nothing is persisted to disk in this version.

---

## 3. Command Module Exports

Each command module exposes its core action function as a named export. The commander `.action()` handler becomes a thin wrapper that calls it. One-shot behavior is identical.

Modules to update:

| File | New exports |
|---|---|
| `src/commands/api.js` | `executeApiList(opts)`, `executeApiCheck(opts)` |
| `src/commands/github.js` | `executeGithubConnect(opts)`, `executeGithubProfile(opts)`, `executeGithubAnalyze(opts)` |
| `src/commands/doc.js` | `executeDoc(opts)` |
| `src/commands/audit.js` | `executeAudit(opts)` (already a named inner fn — just export it) |
| `src/commands/init.js` | `executeInit(opts)` |
| `src/commands/connect.js` | `executeConnect(apiKey, opts)` |
| `src/commands/disconnect.js` | `executeDisconnect(opts)` |
| `src/commands/status.js` | `executeStatus()` |
| `src/commands/config.js` | `executeConfigList(opts)`, `executeConfigSet(key, value, opts)`, `executeConfigReset(opts)` |

---

## 4. `/help` Output

Generated from the dispatch table. Groups rendered with headers, subcommands indented:

```
Setup
  /init                    interactive setup wizard — connect LLM and GitHub
  /connect <api-key>       store an LLM/API provider key
  /disconnect              remove stored credentials
  /status                  show connection state and last audit result

Configuration
  /config list             show effective config and scope each value came from
  /config set <key> <val>  update a config value
  /config reset            reset config to defaults

Analysis
  /api list                scan and list detected API routes
  /api check               health-check routes against a running backend
  /github connect          verify your GitHub token
  /github profile          show profile and recent commit history
  /github analyze          analyze a repo's commit activity
  /doc                     generate documentation
  /audit                   run all checks and show a combined summary

Session
  /help                    show this list
  /exit                    quit the session
```

---

## 5. Tests

### `test/unit/session.test.js`

Uses a stubbed input stream (not real stdin). Covers:

- Slash command parsing: `/api list --json` → `{ command: 'api list', opts: { json: true } }`
- Flag parsing: `--base-url http://localhost:3000` → `{ baseUrl: 'http://localhost:3000' }`
- Group with no subcommand: `/api` → prints subcommand hint, does not dispatch
- Unrecognized slash command `/foo` → prints not-recognized message
- Non-slash input → hits AI seam branch, no error thrown, loop continues
- Error containment: dispatch throws → error formatted, loop continues

### `test/integration/session.test.js`

Spawns `bin/decode.js` with no args via `execa` with piped stdin. Covers:

- Session starts — banner appears in stdout
- `/help` → stdout contains all command groups
- `/exit` → exits with code 0
- `/audit` → dispatches correctly (service stubbed), output contains expected markers
- `/foo` → prints not-recognized message, process does not exit

---

## 6. Documentation Updates

### README.md

Add a short "Interactive Session" section above the command reference:

```
$ decode
decode> /api list
decode> /audit
decode> /exit
```

One-line explanation of session mode and how to start it.

### ARCHITECTURE.md

- Add `src/session/session.js` to the Folder Structure block.
- Add a paragraph in High-Level Design noting that:
  - The session dispatches to the same exported action functions the one-shot CLI uses.
  - The unrecognized non-`/` input branch in the session input handler is the explicit extension point for the AI assistant (planned next iteration).

### TASKS.md

Add a task entry for this work per the existing log format.

---

## Implementation Order

1. Export action functions from command modules (no behavior change).
2. Write `src/session/session.js` with dispatch table and REPL loop.
3. Update `src/index.js` entry point branch.
4. Write unit tests.
5. Write integration tests.
6. Update README, ARCHITECTURE.md, TASKS.md.
7. Run full test suite and lint.
