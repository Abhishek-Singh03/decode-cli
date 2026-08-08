# TASKS — Session Log (2026-08-08)

Work executed on the DeCode CLI in this session, in the order requested. Each
task is a self-contained commit on `main` (`git log --oneline` → see
CHANGELOG.md for user-facing notes).

---

## Task 1 — LLM requests failing with 404 (blocking)
**Fixes (commit `2faf8bd`):**
- Root cause: `providers` map in `src/services/llmClient.js` used
  `https://api.groq.com` as the Groq base; the client appends `/v1/chat/
  completions`, which produced `https://api.groq.com/v1/...` → 404. Groq's
  OpenAI-compatible root is `https://api.groq.com/openai`, so the final URL is
  now `https://api.groq.com/openai/v1/chat/completions`.
- Verified Groq's `llama-3.1-8b-instant` is a live production model (kept as
  the default).
- Added a `chatCompletionsEndpoint()` builder that doesn't double ` /v1` when
  `LLM_PROVIDER_BASE_URL` already ends in `/v1`.
- Added `--verbose` (and `DECODE_DEBUG`) to `github analyze`, `doc`,
  `doc --explain`; `llmClient` prints the exact outgoing URL + model to stderr
  before firing.
- Tests: `test/unit/llmClient.test.js` — asserted Groq endpoint, `/v1`
  normalization, and the verbose log line. End-to-end verified `doc --explain`
  and `github analyze` against a stub LLM server (no real network/key needed).

## Task 2 — Global vs. local config (local overrides global per-field)
**Changes (commit `5b75481`):**
- Two tiers: global `~/.decode/config.json` + `~/.decode/.env`, optional local
  `<project-root>/decode.config.json` + `.env`. Local overrides global
  **field-by-field**; absent local fields fall through to global → defaults.
- `findProjectRoot({ cwd })` walks up from the working directory to the nearest
  `decode.config.json` (git-like); `DECODE_GLOBAL_CONFIG_DIR` overrides the
  global dir for hermetic tests.
- `decode init` prompts global-vs-local (default: global on first run, local
  once a global setup exists); `--scope` for scripting.
- `decode config set/list/reset` accept `--global` / `--local`; `config list`
  shows each value's source (`local`/`global`/`default`).
- `decode status` labels each credential with the scope it came from
  (`**** (local)` / `**** (global)`).
- Docs: ARCHITECTURE.md "Data Model" section rewritten for the two-tier model.
- Tests: `test/unit/configStore.test.js` (global-only, local-only, both with a
  specific-field override, neither, `reset` per-scope, walk-up), integration
  tests in `init`/`config`/`connect` with isolated global dirs.

## Task 3 — API route auto-detection (manual `api add` dropped)
**Changes (commit `5315c75`):**
- New `src/services/routeDetector.js`: Express framework detection from
  package.json, regex extraction of `app.get/post/put/delete/patch` with source
  file + line + dynamic-segment flag, source fingerprinting, and a cached scan
  stored in the project-local config (`--refresh` rescans; changed sources
  rescan automatically).
- Reused `projectScanner` traversal via new `listSourceFiles()` (no new walker).
- `decode api list` — scans + prints `Method Path Source Flags`; `⚠ has params`
  for dynamic routes. `decode api check` — resolves base (`--base-url` → `PORT`
  in `.env` → reachable common dev ports), fails with "Backend not reachable at
  <url> — is it running?" when down, and SKIPS dynamic-param routes with a clear
  "skipped — dynamic param, no test data" note instead of guessing.
- Removed `api add` / `api remove`; audit now feeds off auto-detection; config
  summary surfaces the detected route paths.
- Docs: PRD story 1, ARCHITECTURE.md command modules, README command table,
  `examples/ui-showcase.js` updated to remove `api add` references.
- Tests: `test/unit/routeDetector.test.js` (fixture Express app + cache
  behavior) and a rewritten `test/integration/api.test.js` (list/check against
  a fixture Express project + live local server; unreachable + dynamic-skip
  scenarios). `audit.test.js` / `auditRunner.test.js` updated to the
  auto-detection model.

## Task 4 — Commit-quality heuristics for `github analyze`
**Changes (commit `22057c2`):**
- `src/services/repoAnalyst.js`: `isVagueCommitMessage`, `isDocsOnlyCommit`,
  `commitChangeCount`, `analyzeCommitQuality` (docs-only, vague-message,
  average/largest size, size outliers, commit-burst days). `analyzeCommits`
  returns an extra `quality` block; `buildSummaryPrompt` cites the computed
  metrics and asks for a short commit-hygiene assessment.
- `src/services/githubClient.js`: `getRepoCommitsDetailed` / `enrichCommits`
  enrich the newest commits with file/stats via bounded concurrency `getCommit`
  calls (tolerant — heuristics degrade gracefully).
- Terminal output now shows a "Commit hygiene" section even when the LLM fails.
- Tests: `test/unit/repoAnalyst.test.js` (docs-only, vague-message, size,
  burst-day, prompt grounding), `test/unit/githubClient.test.js` (enrichment +
  detailed), `test/integration/github.test.js` (mock exposes files →
  `quality.docsOnlyCount` asserted).

## Task 5 — Enriched `github profile`
**Changes (commit `91c4501`):**
- `githubClient.getUserCommitActivity` — collects the user's recent commits
  across their repos, newest-first, capped, enriched with file counts.
- `repoAnalyst.analyzeActivity` + `buildProfileSummaryPrompt`: per-repo commit
  counts, daily flow, docs-only/vague counts, avg files per commit — the AI
  narrative is grounded in these numbers (not just a table restated).
- `decode github profile` renders a "Recent commits" table (date · repo · files
  changed · message) and an "Activity summary" box; the tables remain visible if
  the LLM fails (resilient). New `--json` output for scripts.
- Tests: unit tests in `repoAnalyst` / `githubClient` + the github integration.

## Task 6 — CLI UX polish
**Changes (commit `be0f7ed`):**
- `program.showSuggestionAfterError()` — unknown subcommands now suggest the
  closest real command (`decode api lst` → "Did you mean list?").
- Re-registered a working `decode help` subcommand (the built-in one was removed
  for the custom landing screen).
- Config resolution verified to walk up from a nested cwd (`backend/api`) to the
  project-local config, merged with global (integration test added).
- `npm run lint` also cleaned of pre-existing UI-engine errors (`chore(lint)`
  commit) so CI's lint gate is green.

## Final verification
- `npm test` — **20 files, 170 tests, all passing**.
- `npm run lint` — clean (exit 0).
- `CHANGELOG.md` updated with entries for every fix/enhancement.
- This file documents what was actually done.

---

# Cleanup & Finalization Pass (2026-08-08) — hackathon submission prep

## Task A — Remove committed runtime state
- `decode.config.json` (committed, with a leftover manual test route + cached
  audit timestamps) is now **gitignored** and untracked (`git rm --cached`);
  the local file stays on disk but is no longer part of the repo.
- Added `decode.config.example.json` — a clean template showing the config
  shape (`llm.provider`, `llm.apiKeyRef`, `github.tokenRef`) with **no** routes
  array or audit cache, since routes are always auto-detected from source.
- Verified README has no instructions to hand-edit the config to add routes
  (it already documents auto-detection).

## Task B — Consolidate root-level docs
- **Deleted** `decode-base-document.md` — early planning draft, fully
  superseded by PRD.md + ARCHITECTURE.md; no unique content lost (its
  Playwright-substitution rationale is now stated explicitly in
  ARCHITECTURE.md's Testing Strategy).
- **Moved** `RENDERING_ENGINE_COMPLETE.md` → `src/ui/RENDERING_ENGINE_COMPLETE.md`
  (beside the ENGINE.md it complements); ARCHITECTURE.md links to the new path.
- **Deleted** `AUDIT_REFERENCE.md` — it duplicated `COMMAND_STANDARD.md` (same
  Verdict→Evidence→Action / output modes / error handling) and referenced the
  removed manual `api add`. Kept `COMMAND_STANDARD.md` as the single
  "how to write a command" style guide and pointed to it from ARCHITECTURE.md.
- Resulting root doc set: `README.md`, `ARCHITECTURE.md`, `AGENTS.md`,
  `AGENTS_AND_SKILLS.md`, `PRD.md`, `TASKS.md`, `CHANGELOG.md`,
  `COMMAND_STANDARD.md` (retained reference), `LICENSE`.

## Task C — ARCHITECTURE.md + PRD.md reality pass
- **ARCHITECTURE.md**: rewritten — api auto-detection (routeDetector, cached
  scan, no manual add), two-tier global/local config in Data Model, rendering
  engine (`src/ui/`) in the stack with a link to the moved report, folder tree
  rebuilt against the actual repo tree (added `src/ui/`, `examples/`,
  `decode.config.example.json`, `TASKS.md`, help.js, etc.), and a Doc Index.
- **PRD.md**: API story + auto-detection ACs (already current, confirmed), new
  config-scoping ACs under Setup & Account Management, and Story 5 (AI
  assistant) explicitly marked **Planned / not yet implemented**.

## Task D — Playwright substitution documented
- ARCHITECTURE Testing Strategy + README now state plainly that Playwright is
  intentionally not used (CLI, not a web app) and that `vitest` unit tests plus
  `execa`-driven CLI integration tests provide the equivalent end-to-end gate.

## Task E — CI fix
- `.github/workflows/ci.yml` `node-version` bumped `20` → `22` to remove the
  Node 20 deprecation warning in Actions.

## Task F — Release tag
- CHANGELOG `[0.1.0]` entry written (release summary + Added/Fixed/Changed),
  `package.json` version `0.1.0`, git tag `v0.1.0` created locally.
  **Not pushed** — the tag must be pushed by the user with `git push origin v0.1.0`.

## Final pass verification
- `npm test` — **20 files, 170 tests, all passing** (also confirms the doc/config
  changes broke nothing).
- `npm run lint` — clean (exit 0).
- During final verification a test-hermeticity gap surfaced: the developer's own
  `~/.decode` global config (created with `decode init`, i.e. the feature itself)
  leaked into unit tests that read config without isolating the global tier —
  and one test fired a real LLM request. Fixed by a Vitest `setupFiles`
  (`test/setup.js`) that points `DECODE_GLOBAL_CONFIG_DIR` at an empty temp dir
  for every run, bumping the integration `testTimeout` to 60s, and correcting a
  `resolveBackendBaseUrl` unit test that injected its fake `fetchImpl` in the
  wrong position.