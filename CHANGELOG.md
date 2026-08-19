# Changelog

All notable changes to DeCode will be documented in this file.

## [Unreleased]

### Fixed
- **Test suite pollution from nested worktrees** — `vitest.config.js` now sets
  `exclude` (extending `defaultExclude` with `**/.claude/**` and `**/.worktrees/**
  ) so Vitest stops recursing into the two parallel git worktrees nested inside
  the repo (`.claude/worktrees/ink-session-ui`, `.worktrees/ink-session-ui`) and
  running duplicate copies of same-named test files. It also now loads
  `setupFiles: ['./test/setup.js']`, which points `DECODE_GLOBAL_CONFIG_DIR` at a
  temp dir so tests never read the real `~/.decode` (this guard was previously
  dead code — the config didn't reference it). After the fix, `npm test` runs the
  main repo only: **25 files, 217 tests, all passing**.

## [0.1.0] - 2026-08-08

**Release summary** — DeCode's initial hackathon-ready release: a complete CLI
with auto-detected API health checking, GitHub activity analysis and commit
hygiene, documentation generation/freshness, a composite audit, and a
two-tier global/local config store — all served by a composable terminal
rendering engine. Includes the custom *Repo Analyst* agent and *API Contract
Verifier* skill (see `AGENTS_AND_SKILLS.md`).

### Added
- **Two-tier global/local config** — a machine-wide config (`~/.decode/config.
  json` + `~/.decode/.env`) applies to every project by default, while an
  optional project-local `decode.config.json` overrides it field-by-field
  (never all-or-nothing). `config set/list/reset` accept `--global` / `--local`;
  `config list` labels each value's source (`local` / `global` / `default`);
  `decode status` shows the scope each credential came from; `decode init` asks
  global-or-local (global on first run, local once a global setup exists).
- **API route auto-detection** — replaced the manual `api add <url>` flow. `api
  list` scans the project's Express source (reusing the project scanner's
  file-walking), flags dynamic-segment routes (`⚠ has params`), and caches the
  result in the project config (`--refresh` to rescan). `api check` checks the
  detected routes against a live backend (`--base-url`, `PORT` in `.env`, or
  common dev ports), skips dynamic-param routes with an explicit note, and
  fails with "Backend not reachable at <url> — is it running?" instead of a
  raw connection error.
- **Commit-quality heuristics for `github analyze`** — a locally-computed layer
  (docs-only rate, vague/low-quality messages, commit-size averages/outliers,
  commit-burst days) that grounds the AI summary in real signal instead of
  restated counts; the heuristic summary is always printed, even when the LLM
  call fails. Commit enrichment (`getCommit` file stats) is bounded and
  concurrency-limited.
- **Enriched `github profile`** — a recent commit history section (message, date,
  files changed) across the user's repos plus an AI activity narrative grounded
  in computed activity metrics; the tables render even if the LLM fails.
- **CLI UX** — unknown subcommands now suggest the closest real command
  (commander `showSuggestionAfterError`), and `decode help` is functional again.
- **Rendering engine foundation (`src/ui/`)** — composable terminal rendering
  layer (renderer → components → theme) used by the audit command and landing
  screen; docs live in `src/ui/ENGINE.md` and `src/ui/RENDERING_ENGINE_COMPLETE.md`.

### Fixed
- **LLM 404 on Groq** — the Groq base URL now includes the `/openai` segment, so
  `github analyze`, `doc`, and `doc --explain` POST to the correct
  `https://api.groq.com/openai/v1/chat/completions` instead of 404ing. Added a
  `--verbose` debug log that prints the exact outgoing URL + model before the
  request fires, and an override-safe endpoint builder that never duplicates the
  `/v1` segment.
- **Pre-existing lint errors** in the UI engine (`src/ui/*`) and the help screen
  (`no-control-regex`, unused imports/variables) — `npm run lint` is green again.
- **Audit output** now exposes a clear overall verdict (`✓ Audit passed` /
  `✗ Audit failed`) and a single-line summary
  (`Summary: N passed, M failed, K skipped`), so the audit UI matches its tests
  and is CI-parseable.

### Changed
- Config resolution now walks upward from the working directory to the nearest
  `decode.config.json` (like git finds `.git`), so commands run from a
  subdirectory (e.g. `backend/api`) resolve the project config and merge with
  the global tier.
- `findProjectRoot` / global-path helpers are exported from the config store and
  testable via `DECODE_GLOBAL_CONFIG_DIR` so integration tests stay hermetic.
- Local runtime config (`decode.config.json`) is gitignored and untracked; a
  clean `decode.config.example.json` is committed instead (routes are always
  auto-detected, never stored as a static list).
- CI now runs on Node 22, and the docs were consolidated and refreshed to match
  the shipped system (see ARCHITECTURE.md/PRD.md).