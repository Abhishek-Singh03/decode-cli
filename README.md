# DeCode

AI-powered developer productivity CLI — check your API health, understand your GitHub activity, generate documentation, and get AI-assisted code edits, all from the terminal, with a human approving every change.

Built for **Deploy or Die: HowToAlgo x GDGoC KIIT Hackathon** (Track B — Developer Productivity Tools).

## Install

```bash
git clone <repo-url>
cd decode-cli
npm install
npm link   # makes the `decode` command available globally for local testing
```

## Quick Start

```bash
decode init          # interactive setup — connect your LLM provider and GitHub
decode status         # confirm everything's connected
decode audit           # run a full check: API health + doc freshness + repo health
```

## Commands

| Command | Description |
|---|---|
| `decode init` | Interactive setup wizard |
| `decode connect <api-key>` | Store an LLM/API provider key |
| `decode disconnect` | Remove stored credentials |
| `decode status` | Show connection status, last audit result, config path |
| `decode config list / set / reset` | View or update configuration |
| `decode audit [--ci] [--json]` | Run all core checks together |
| `decode api list` | List configured API routes |
| `decode api check [routes...] [--json] [--ci] [--spec <path\|url>]` | Check API routes; reports status, time, and pass/fail; exits non-zero on failure |
| `decode api add <url>` | Add a route to check |
| `decode api remove <url>` | Remove a configured route |
| `decode github connect` | Authenticate with GitHub (verifies your stored token) |
| `decode github profile` | Show your profile + recently active repos |
| `decode github analyze [repo] [--json]` | Analyze repo activity — commits, contributors, and an AI summary (defaults to current repo) |
| `decode doc [message] [--yes] [--dry-run] [--out <path>]` | Generate project documentation (previewed and approval-gated before writing) |
| `decode doc --explain [instruction]` | Explain the project or a specific part (read-only) |
| `decode doc check [--json]` | Check if docs are stale (exit 1 when stale) |
| `decode ask <question>` | Ask a read-only question about the project |
| `decode <natural language instruction>` | AI assistant — proposes a diff, asks for approval before writing |

Run `decode help` for the full list at any time.

## How the AI Assistant Works

Any input that isn't a recognized command is treated as a natural-language coding instruction:

```bash
decode add error handling to the auth route
decode fix this --file auth.js --lines 20-45
```

The agent reads the relevant file(s), proposes a diff, and asks for explicit approval before writing anything to disk. Nothing is changed without a `y`.

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full system design.

## Agents & Skills

See [`AGENTS_AND_SKILLS.md`](./AGENTS_AND_SKILLS.md) for the custom agent and skill built for this project.

## Development

```bash
npm run dev      # run the CLI locally
npm test         # run the test suite
npm run lint     # lint the codebase
```

## License

MIT
