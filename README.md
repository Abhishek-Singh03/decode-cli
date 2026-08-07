# DeCode

AI-powered developer productivity CLI — check your API health, understand your GitHub activity, generate documentation, and run a composite health audit, all from the terminal. (AI-assisted code edits are on the roadmap.)

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
| `decode status` | Show connection state and config path |
| `decode config list [--json] / set <key> <value> / reset [--yes]` | View or update configuration (no secrets; `reset` keeps `.env` credentials) |
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

Run `decode help` for the full list at any time.

## Roadmap

- Natural-language AI code edits — describe a change in plain English, review a proposed diff, approve with `y` before anything is written
- `decode ask` — read-only Q&A about your project

Neither is implemented yet.

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
