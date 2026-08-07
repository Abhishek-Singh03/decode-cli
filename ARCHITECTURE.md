# DeCode — Architecture

## Overview
DeCode (`decode-cli`) is a Node.js CLI that gives developers core capabilities from the terminal: API health checking, GitHub activity analysis, documentation generation, and a composite audit that summarizes all of them. Any file writes are gated by human approval; an AI-assisted code editing flow (PRD story 5) is planned but not yet implemented.

## Stack
- **Runtime:** Node.js (>=18)
- **CLI framework:** `commander`
- **Terminal UI:** `chalk` (color), `cli-table3` (tables), `ora` (spinners), `boxen` (summary panels), `inquirer` (interactive prompts)
- **GitHub integration:** `octokit` (REST/GraphQL)
- **LLM integration:** runtime calls go through the provider configured in `decode.config.json` (anthropic / openai / groq / other), via `src/services/llmClient.js`
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
Matched command             Unmatched input (planned —
   │                         not yet implemented)
   ▼                               │
Command Modules                    ▼
(api, github, doc,           AI Agent Fallback
 audit, config, etc.)         (natural-language
                                instruction handler)
   │                               │
   └───────────┬───────────────────┘
               ▼
        Shared Services
   ┌───────────┼────────────┐
   ▼           ▼            ▼
Config Store  LLM Client  GitHub Client
```

## Data Model
- **Two-tier config store** — DeCode resolves configuration from two scopes and merges them **field-by-field** (never all-or-nothing):
  - **Global** (`~/.decode/config.json`): machine-wide, set once and applies to every project by default. Its secrets live in `~/.decode/.env`.
  - **Local** (`<project-root>/decode.config.json`, optional): only the fields explicitly set locally override the global value; anything not set falls back to global, then to defaults. Secrets live in `<project-root>/.env`.
  - The project root is found by walking upward from the working directory to the nearest `decode.config.json` (mirrors how git finds `.git`), so commands run from a subdirectory still resolve the project-local config.
  - `decode init` picks the scope (defaults to global on a first-ever run, local once a global setup exists); `decode config set/list/reset` take `--global` / `--local`; `decode status` labels each credential with the scope it came from.
- **Config shape** — the merged config stores the LLM provider + key reference, the GitHub token reference, configured API routes, and user preferences (`updatedAt`, last audit summary, cached route scan).
- **Credentials**: never stored in plaintext in the repo; read from `.env` (local or global tier) or OS keychain where feasible. `.env.example` documents required variables.
- **No database** — DeCode is stateless between runs beyond the config files; each command reads fresh data (API responses, GitHub API data, filesystem) at call time.

## Command Modules
- `api` — auto-detected route discovery (`list`, cached in the project config with `--refresh`) and health checking (`check`) against a live backend. Routes are detected from the project's Express source (`src/services/routeDetector.js`); dynamic-segment routes are flagged / skipped rather than guessed. The manual `add`/`remove` flow no longer exists
- `github` — repo/profile activity analysis via GitHub API (`connect`/`profile`/`analyze`)
- `doc` — documentation generation (`doc [message]`, `doc --explain`) and staleness checking (`doc check`)
- `audit` — composes the API, docs, and repo-health checks into one summary (`--json` / `--ci`)
- `init` / `connect` / `disconnect` / `status` / `config` — account and settings lifecycle
- **Planned (not yet implemented):** `ask` (read-only Q&A) and the AI Agent Fallback (natural-language code edits, PRD story 5)

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
│   │   ├── api.js                  # handles `api list/add/remove/check`
│   │   ├── github.js               # handles `github connect/profile/analyze`
│   │   ├── doc.js                  # handles `doc`, `doc --explain`, `doc check`
│   │   ├── config.js               # handles `config list/set/reset`
│   │   └── audit.js                # composite audit summary
│   │
│   ├── services/                   # actual logic, reused across commands
│   │   ├── apiChecker.js           # "API Contract Verifier" skill logic
│   │   ├── auditRunner.js          # composes api + docs + repo checks
│   │   ├── configStore.js          # reads/writes decode.config.json + .env
│   │   ├── docGenerator.js         # "Doc Generator" skill logic
│   │   ├── docStaleness.js         # mtime-based doc staleness heuristic
│   │   ├── githubClient.js         # wraps octokit calls
│   │   ├── llmClient.js            # wraps calls to the LLM provider/router
│   │   ├── projectScanner.js       # read-only file tree + key-file sampler
│   │   ├── repoAnalyst.js          # "Repo Analyst" agent logic
│   │   ├── repoHealth.js           # git-local, token-free repo health check
│   │   └── routeDetector.js        # auto-detects Express routes from source
│   │
│   ├── utils/
│   │   └── output.js               # chalk/table/boxen formatting helpers
│   │
│   └── constants.js                # CLI name/version, timeout, exit codes
│
├── test/
│   ├── unit/                       # hits services directly
│   │   ├── apiChecker.test.js
│   │   ├── auditRunner.test.js
│   │   ├── configStore.test.js
│   │   ├── docGenerator.test.js
│   │   ├── docStaleness.test.js
│   │   ├── githubClient.test.js
│   │   ├── llmClient.test.js
│   │   ├── output.test.js
│   │   ├── projectScanner.test.js
│   │   ├── repoAnalyst.test.js
│   │   ├── repoHealth.test.js
│   │   └── routeDetector.test.js
│   └── integration/                # runs the built CLI binary via execa
│       ├── api.test.js
│       ├── audit.test.js
│       ├── cli.test.js
│       ├── config.test.js
│       ├── connect.test.js
│       ├── doc.test.js
│       ├── github.test.js
│       └── init.test.js
│
├── docs/                           # generated output (docs/architecture.md) —
│   └── architecture.md             # written by `decode doc`, separate from the
│                                   # hand-written project docs below
│
├── .env.example
├── .gitignore
├── .eslintrc.json
├── ARCHITECTURE.md                 # this file
├── AGENTS.md                       # agent rules/constitution
├── AGENTS_AND_SKILLS.md
├── PRD.md
├── CHANGELOG.md
├── LICENSE
├── README.md
└── package.json
```

**Design rationale for the split:**
- `commands/` vs `services/` keeps command handlers thin and testable, and keeps the actual API/GitHub/doc/repo logic independently unit-testable without spinning up the CLI parser.
- `docs/` (generated output) is kept separate from the hand-written project docs at repo root, so DeCode's own generated architecture doc never collides with this one.

## Security & Safety Boundaries
- Any AI-proposed file write (planned assistant, PRD story 5) is restricted to the current working project directory — no arbitrary filesystem or shell access.
- No proposed change is ever written without explicit human approval.
- API keys/tokens are read from environment/config, never hardcoded or committed.

## Testing Strategy
- Unit tests cover command parsing, API check logic, GitHub data transforms, and config read/write.
- Integration tests run the built CLI binary as a subprocess and assert on stdout/exit codes per command.

## CI/CD
GitHub Actions workflow runs on every push: install → lint → unit tests → integration tests. Must be green on the latest commit at submission time.

## Deferred / Roadmap
- Visual trace of agent actions (currently: step-by-step terminal output) — future iteration could add a companion visual/GUI trace.
- Region-select visual code editing (currently: `--file`/`--lines` targeting) — future iteration could add a GUI companion app for visual selection.
