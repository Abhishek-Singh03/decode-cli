# DeCode

**Your terminal-native dev companion — API health, GitHub activity, and living docs, without leaving the command line.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

DeCode watches your project the way a good senior engineer would: it knows when your API routes are broken, when your docs have drifted from your code, and what your recent commits actually say about the health of the codebase — all from one CLI, with zero context-switching to a dashboard.

Run it once for a snapshot (`decode audit`), or drop into the interactive session and keep it open the whole time you're working.

---

## Install

```bash
git clone https://github.com/s8tn2546/decode-cli/
cd decode-cli
npm install
sudo npm link   # makes the `decode` command available globally
```

## Quick Start

```bash
decode init      # interactive setup — connect your LLM provider and GitHub
decode status    # confirm everything's connected
decode audit     # run a full check: API health + doc freshness + repo health
```

Prefer to stay in one place? Run `decode` with no arguments and use `/init`, `/status`, `/audit` inside the session instead — see [Interactive Session](#interactive-session) below.

## Interactive Session

Run `decode` with no arguments to drop into a persistent session — no need to type `decode` before every command:

```
╭──────────────────────────────────────────────────────────────╮
│    ██╗██╗    ██╗          |  Tips for getting started         │
│   ██╔╝╚██╗  ██╔╝          |  /help   list all commands        │
│  ██╔╝  ╚██╗██╔╝           |  /exit   quit the session         │
│ ██╔╝   ██╔╝╚██╗           |                                   │
│██╔╝   ██╔╝  ╚██╗          |  What's new                       │
│╚═╝    ╚═╝    ╚═╝          |  • Interactive session UI         │
│                           |                                   │
│DeCode                     |                                   │
│Your Project, Decoded.     |                                   │
│                           |                                   │
│Welcome back!              |                                   │
│~/your-project             |                                   │
│Provider: groq             |                                   │
╰──────────────────────────────────────────────────────────────╯
decode>
 ● session   ? for shortcuts   your-project
```

Inside the session, every command drops the `decode` prefix and starts with `/` instead — `/audit`, `/api list`, `/github profile`, and so on. See the [Commands](#commands) table below for the full slash-command reference. The same commands are also available as `decode <command>` from your regular shell (outside the session) for scripting and CI — both forms run identically.

Type `/help` for the full command list, `/exit` to quit. Non-slash input is reserved for the upcoming AI agent feature.

**Non-TTY / CI fallback:** when stdout isn't a TTY (piped output, CI runners), `decode` automatically falls back to a plain readline session — no figlet banner, no terminal graphics. Scripted and CI usage is unaffected either way.

## Commands

Shown here in slash-command form (used inside the interactive session). Drop the `/` and add `decode` in front to run the same command as a one-shot from your regular shell — e.g. `/audit` inside the session is `decode audit` outside it. Flags and behavior are identical either way.

| Command | Description |
|---|---|
| `/init` | Interactive setup wizard |
| `/connect <api-key>` | Store an LLM/API provider key |
| `/disconnect` | Remove stored credentials |
| `/status` | Show connection state, which config scope each credential came from, and config paths |
| `/config list [--json] / set <key> <value> [--global\|--local] / reset [--yes] [--global\|--local]` | View or update configuration (no secrets; `reset` keeps `.env` credentials). Global config at `~/.decode`, local overrides it per-field |
| `/audit [--ci] [--json]` | Run all core checks together |
| `/api list [--refresh] [--json]` | Auto-detect backend routes from the project source (Express today); dynamic-segment routes are flagged |
| `/api check [paths...] [--base-url <url>] [--spec <path\|url>] [--json] [--ci]` | Check detected routes against a live backend (base from `--base-url` / `PORT` / common dev ports); dynamic routes are skipped, not requested |
| `/github connect` | Authenticate with GitHub (verifies your stored token) |
| `/github profile` | Show your profile, recently active repos, recent commit history (message · date · files changed), and an AI activity narrative |
| `/github analyze [repo] [--json]` | Analyze repo activity — commits, contributors, and an AI summary (defaults to current repo) |
| `/doc [message] [--yes] [--dry-run] [--out <path>]` | Generate project documentation (previewed and approval-gated before writing) |
| `/doc --explain [instruction]` | Explain the project or a specific part (read-only) |
| `/doc check [--json]` | Check if docs are stale (exit 1 when stale) |

Run `/help` inside the session, or `decode help` from your shell, for the full list at any time.

## Roadmap

- **Natural-language AI code edits** — describe a change in plain English, review a proposed diff, approve with `y` before anything is written
- **`decode ask`** — read-only Q&A about your project

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

DeCode is a CLI, not a web app, so it ships no Playwright browser tests. Unit tests (`vitest`) plus execa-driven CLI integration tests exercise the real shipped binary end-to-end instead — the same gate a browser harness would provide, minus the browser. See [`ARCHITECTURE.md`](./ARCHITECTURE.md#testing-strategy).

Tests run hermetically: `test/setup.js` isolates them from your real `~/.decode` config, and `vitest.config.js` excludes the nested git worktrees, so a plain `npm test` covers the main repo only (25 files, 217 tests) — no extra flags needed.

## Contributing

Issues and pull requests are welcome. If you're adding a new framework adapter (FastAPI, Django, NestJS, etc.) for `decode api`, or a new provider for the LLM client, open an issue first so we can align on the interface before you build against it.

## License

MIT
