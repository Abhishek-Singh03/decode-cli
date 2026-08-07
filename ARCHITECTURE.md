# DeCode — Architecture

## Overview
DeCode (`decode-cli`) is a Node.js CLI that gives developers four core capabilities from the terminal: API health checking, GitHub activity analysis, documentation generation, and an AI-assisted code editing flow — all gated by human approval before any file is written.

## Stack
- **Runtime:** Node.js (>=18)
- **CLI framework:** `commander`
- **Terminal UI:** `chalk` (color), `cli-table3` (tables), `ora` (spinners), `boxen` (summary panels), `inquirer` (interactive prompts)
- **GitHub integration:** `octokit` (REST/GraphQL)
- **LLM integration:** routed via [provider/router name] through Claude Code during development; runtime calls go through the configured provider in `decode.config.json`
- **Testing:** `vitest` (unit), `execa`-driven CLI integration tests
- **Linting:** ESLint

## High-Level Design

```
CLI Entry (bin/decode.js)
        │
        ▼
  Command Router (commander)
        │
   ┌────┴─────────────────────────┐
   │                               │
Matched command             Unmatched input
   │                               │
   ▼                               ▼
Command Modules              AI Agent Fallback
(api, github, doc,           (natural-language
 audit, config, etc.)         instruction handler)
   │                               │
   └───────────┬───────────────────┘
               ▼
        Shared Services
   ┌───────────┼────────────┐
   ▼           ▼            ▼
Config Store  LLM Client  GitHub Client
```

## Data Model
- **Config store** (`decode.config.json`, project-level; `~/.decode/config.json`, global): stores LLM provider + key reference, GitHub token reference, configured API routes, user preferences.
- **Credentials**: never stored in plaintext in the repo; read from `.env` locally or OS keychain where feasible. `.env.example` documents required variables.
- **No database** — DeCode is stateless between runs beyond the config file; each command reads fresh data (API responses, GitHub API data, filesystem) at call time.

## Command Modules
- `api` — route checking against a configured or provided route list
- `github` — repo/profile activity analysis via GitHub API
- `doc` — documentation generation and staleness checking
- `audit` — composes `api check` + `doc check` + repo health check into one summary
- `config` / `connect` / `disconnect` / `status` / `init` — account and settings lifecycle
- `ask` — read-only Q&A about the project, no file writes
- **AI Agent Fallback** — any unmatched input is treated as a natural-language coding instruction; proposes a diff, requires explicit `y/n` approval before writing to disk, sandboxed to the current project directory

## Folder Structure

```
decode-cli/
├── .github/
│   └── workflows/
│       └── ci.yml                  # CI pipeline: install → lint → test
│
├── bin/
│   └── decode.js                   # CLI entry point (maps to "bin" in package.json)
│
├── src/
│   ├── index.js                    # app bootstrap, registers commands with commander
│   │
│   ├── commands/                   # one file per command group — thin layer:
│   │   │                           # parse args → call service → format output
│   │   ├── init.js
│   │   ├── connect.js
│   │   ├── disconnect.js
│   │   ├── status.js
│   │   ├── config.js               # handles `config list/set/reset`
│   │   ├── api.js                  # handles `api list`, `api check`
│   │   ├── github.js               # handles `github connect/profile/analyze`
│   │   ├── doc.js                  # handles `doc`, `doc --explain`, `doc check`
│   │   ├── audit.js
│   │   ├── ask.js
│   │   └── agent.js                # natural-language fallback handler
│   │
│   ├── services/                   # actual logic, reused across commands
│   │   ├── llmClient.js            # wraps calls to the LLM provider/router
│   │   ├── githubClient.js         # wraps octokit calls
│   │   ├── apiChecker.js           # "API Contract Verifier" skill logic
│   │   ├── docGenerator.js         # "Doc Generator" skill logic
│   │   ├── repoAnalyst.js          # "Repo Analyst" agent logic
│   │   ├── configStore.js          # reads/writes decode.config.json
│   │   └── sandbox.js              # enforces the file-write safety boundary
│   │
│   ├── utils/
│   │   ├── output.js               # chalk/table/boxen formatting helpers
│   │   ├── diff.js                 # diff generation + colorized display
│   │   └── logger.js               # verbose/debug logging
│   │
│   └── constants.js                # command names, exit codes, config defaults
│
├── test/
│   ├── unit/                       # hits services directly
│   │   ├── apiChecker.test.js
│   │   ├── githubClient.test.js
│   │   ├── configStore.test.js
│   │   └── diff.test.js
│   └── integration/                # runs the built CLI binary via execa
│       ├── api.test.js
│       ├── github.test.js
│       ├── doc.test.js
│       └── audit.test.js
│
├── docs/                           # generated output lands here when a user
│   └── .gitkeep                    # runs `decode doc` — separate from project docs below
│
├── .env.example
├── .gitignore
├── .eslintrc.json
├── ARCHITECTURE.md                 # this file
├── AGENTS.md                       # agent rules/constitution
├── AGENTS_AND_SKILLS.md
├── PRD.md
├── TASKS.md
├── CHANGELOG.md
├── LICENSE
├── README.md
└── package.json
```

**Design rationale for the split:**
- `commands/` vs `services/` keeps command handlers thin and testable, and keeps the actual agent/API/GitHub logic independently unit-testable without spinning up the CLI parser.
- `agent.js` lives in `commands/` even though it isn't a named subcommand — it's still the handler `index.js` routes unmatched input to, so it belongs alongside the others structurally.
- `sandbox.js` is isolated from `agent.js` deliberately — it's the safety boundary referenced below, and keeping it as its own module makes it independently testable and easy to point to directly when explaining safety guarantees.
- `docs/` (generated output) is kept separate from the hand-written project docs at repo root, so DeCode's own generated architecture doc never collides with this one.

## Security & Safety Boundaries
- Agent file operations are restricted to the current working project directory — no arbitrary filesystem or shell access.
- No AI-proposed change is ever written without explicit human approval.
- API keys/tokens are read from environment/config, never hardcoded or committed.

## Testing Strategy
- Unit tests cover command parsing, API check logic, GitHub data transforms, and config read/write.
- Integration tests run the built CLI binary as a subprocess and assert on stdout/exit codes per command.

## CI/CD
GitHub Actions workflow runs on every push: install → lint → unit tests → integration tests. Must be green on the latest commit at submission time.

## Deferred / Roadmap
- Visual trace of agent actions (currently: step-by-step terminal output) — future iteration could add a companion visual/GUI trace.
- Region-select visual code editing (currently: `--file`/`--lines` targeting) — future iteration could add a GUI companion app for visual selection.
