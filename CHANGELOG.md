# Changelog

All notable changes to DeCode will be documented in this file.

## [Unreleased]

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
  `✗ Audit failed`) and a single-line CI summary
  (`Summary: N passed, M failed, K skipped`), so the audit UI matches its tests
  and is CI-parseable.

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

### Changed
- Config resolution now walks upward from the working directory to the nearest
  `decode.config.json` (like git finds `.git`), so commands run from a
  subdirectory (e.g. `backend/api`) resolve the project config and merge with
  the global tier.
- `findProjectRoot` / global-path helpers are exported from the config store and
  testable via `DECODE_GLOBAL_CONFIG_DIR` so integration tests stay hermetic.

## [0.1.0] - TBD
- First tagged release for hackathon submission