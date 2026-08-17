# DeCode

AI-powered developer productivity CLI — check your API health, understand your GitHub activity, generate documentation, and run a composite health audit, all from the terminal. (AI-assisted code edits are on the roadmap.)

Built for **Deploy or Die: HowToAlgo x GDGoC KIIT Hackathon** (Track B — Developer Productivity Tools).

## Install

```bash
git clone https://github.com/s8tn2546/decode-cli/
cd decode-cli
npm install
sudo npm link   # makes the `decode` command available globally for local testing
```

## Quick Start

```bash
decode init          # interactive setup — connect your LLM provider and GitHub
decode status         # confirm everything's connected
decode audit           # run a full check: API health + doc freshness + repo health
```

## Interactive Session

Run `decode` with no arguments to start the visual session:

```
╭──────────────────────────────────────────────────────╮
│  /><                   │  Tips for getting started   │
│  DeCode                │  /help   list all commands  │
│  Your Project, Decoded.│  /exit   quit the session   │
│                        │                             │
│  Welcome back!         │  What's new                 │
│  ~/my-project          │  • Interactive session UI   │
│  Provider: claude      │                             │
╰──────────────────────────────────────────────────────╯
decode>
```

Type `/help` for all commands, `/exit` to quit.

**Non-TTY / CI fallback:** When stdout is not a TTY (piped output, CI
environments), `decode` automatically falls back to the plain readline
session — no Ink, no terminal graphics. Existing scripted usage is
unaffected.

Slash commands map to the same logic as the one-shot CLI (`/api list` = `decode api list`), so flags work identically. Type `/help` inside the session for the full command list. Non-slash input is reserved for the upcoming AI agent feature.

## Commands

| Command | Description |
|---|---|
| `decode init` | Interactive setup wizard |
| `decode connect <api-key>` | Store an LLM/API provider key |
| `decode disconnect` | Remove stored credentials |
| `decode status` | Show connection state, which config scope each credential came from, and config paths |
| `decode config list [--json] / set <key> <value> [--global\|--local] / reset [--yes] [--global\|--local]` | View or update configuration (no secrets; `reset` keeps `.env` credentials). Global config at `~/.decode`, local overrides it per-field |
| `decode audit [--ci] [--json]` | Run all core checks together |
| `decode api list [--refresh] [--json]` | Auto-detect backend routes from the project source (Express today); dynamic-segment routes are flagged |
| `decode api check [paths...] [--base-url <url>] [--spec <path\|url>] [--json] [--ci]` | Check detected routes against a live backend (base from `--base-url` / `PORT` / common dev ports); dynamic routes are skipped, not requested |
| `decode github connect` | Authenticate with GitHub (verifies your stored token) |
| `decode github profile` | Show your profile, recently active repos, recent commit history (message · date · files changed), and an AI activity narrative |
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
npm run dev      # run the CLI
npm test         # run the test suite
npm run lint     # lint the codebase
```

DeCode is a CLI, not a web app, so it ships no Playwright browser tests. Unittest cases (`vitest`) plus execa-driven CLI integration tests exercise the real shipped binary end-to-end instead — the same gate a browser harness would provide, minus the browser. See
[`ARCHITECTURE.md`](./ARCHITECTURE.md#testing-strategy).

## License

MIT
