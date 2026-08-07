# AGENTS.md — Agent Rules & Constitution for DeCode

This file governs how AI coding agents (Claude Code and any others used on this project) should behave while working on this repository.

## Project Context
DeCode (`decode-cli`) is a Node.js CLI tool. Commands live under `src/commands/`, shared services under `src/services/`, tests under `test/`. The CLI entry point is `bin/decode.js`.

## Core Rules

1. **Human approval before destructive or file-writing actions.** Any agent-proposed code change must be presented as a diff and explicitly approved before being written — this applies both to how *you* (the coding agent) work on this repo, and is a design principle DeCode itself must implement in its own AI Assistant feature.
2. **Stay within the project directory.** Never read, write, or execute outside the current project root. Never run arbitrary shell commands beyond what's explicitly requested.
3. **No secrets in code or commits.** Never hardcode API keys, tokens, or credentials. Always read from `.env` (see `.env.example` for required variables) or the config store.
4. **Match existing conventions.** Follow the command/subcommand structure and naming already defined in `ARCHITECTURE.md` — don't introduce new top-level commands or rename existing ones without updating that document.
5. **Every new command needs a corresponding test.** No command is considered complete without at least one unit test and one CLI integration test (via `execa`).
6. **Keep commits atomic and descriptive.** One logical change per commit, conventional commit style preferred (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
7. **Terminal output must follow the established style.** Use `chalk` for color, `cli-table3` for tabular data, `ora` for long-running operations, `boxen` for summary panels — don't introduce a new formatting library without discussion.
8. **Exit codes matter.** Every command must return a non-zero exit code on failure so DeCode remains scriptable/CI-friendly.
9. **Don't fabricate data.** If an API call fails, a repo can't be reached, or a file can't be read, report the failure clearly — never invent plausible-looking output.

## Custom Agents & Skills
See `AGENTS_AND_SKILLS.md` for the specific custom agent ("Repo Analyst") and custom skill ("API Contract Verifier" / "Doc Generator") built for this project, including their scope and invocation.

## When Unsure
If a requested change conflicts with these rules, or the correct approach isn't clear from `ARCHITECTURE.md`, stop and flag it rather than guessing.
