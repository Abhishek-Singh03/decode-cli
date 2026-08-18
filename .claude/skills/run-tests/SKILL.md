---
name: run-tests
description: Run the decode-cli vitest suite without being misled by the two nested parallel worktree repos (.claude/worktrees, .worktrees). Use whenever you need to run or verify tests in this repo.
---

# Run the decode-cli test suite

`decode-cli` is a Node ESM CLI (`type: "module"`). Tests are vitest.

## The trap (read this before running anything)

This repo contains **two parallel git worktrees nested inside it**:

```
.claude/worktrees/ink-session-ui/   # worktree-ink-session-ui branch
.worktrees/ink-session-ui/          # ink-session-ui branch
```

Both are independent in-progress feature branches of this same project,
each with its own copy of `test/...`.

**vitest recurses into them on every invocation, AND it matches by
relative path.** Practical consequences:

- `npx vitest run`, `npx vitest run test/`, even
  `npx vitest run test/integration/api.test.js` all pull in the nested
  repos. A same-named file (`api.test.js`) exists in a worktree too, so a
  "single file" run reports 2–3 files instead of 1.
- `--exclude '**/worktrees/**'` does NOT reliable stop this — the nested
  repos are collected before the exclude filter applies.
- vitest's verbose output also truncates, hiding per-file failure names.

A bare `npx vitest run` here shows ~21 failed *tests* / ~16 failed *files*,
but most are from the worktrees, not the main repo.

## The verified recipe

1. Run the specific test file **by full relative path**:

   ```bash
   npx vitest run test/integration/api.test.js --reporter=dot
   ```

2. **Filter results to the main repo only.** Trust only lines that do NOT
   contain `worktrees`. The worktree copies will still run and may fail
   (often on 5000ms timeouts), but they are not your concern:

   ```bash
   npx vitest run test/integration/api.test.js --reporter=dot 2>&1 \
     | grep -E "FAIL |Test Files|Tests " | grep -v worktrees
   ```

   A green main-repo file shows **0** matching `FAIL` lines.
   (Confirmed: `api.test.js` → 30/30 pass in the main repo, 0 filtered failures.)

3. For a single describe/it group, add `--name`:

   ```bash
   npx vitest run test/integration/api.test.js --name "decode api list"
   ```

4. To sweep the whole main repo, run the individual files in `test/unit/`
   and `test/integration/` one at a time and apply the `grep -v worktrees`
   filter to each. There is no single command that cleanly excludes the
   worktrees — accept that they run alongside and filter them out.

## Known pre-existing (unrelated) failures

As of 2026-08-18, main-repo failures that are present WITHOUT the
rendering-engine migration and are NOT caused by it:

- `test/integration/config.test.js` — `decode config list` test times out (5000ms)
- `test/integration/connect.test.js` — `decode connect / disconnect` test times out (5000ms)
- `test/unit/llmClient.test.js` — 2 cases: `isLlmConfigured is false with no
  provider/key`, `rejects with a clear message when not configured`
- `test/unit/docGenerator.test.js` — `rejects clearly when no LLM is configured`
- `test/unit/githubClient.test.js` — `throws a clear error when no token is stored`

These fail (often on timeout or assertion shape) independent of the
migrated commands (`src/commands/api.js`, `init.js`, `status.js`). The
migration's own tests (`api.test.js`) are 30/30 green after the
`renderError` / `ui.metadata` fixes.

## Notes

- Node >=18 (tested on v22). Deps already installed; run `npm install`
  only if `node_modules` is missing.
- Lint the migrated command files with:
  `npx eslint src/commands/api.js src/commands/init.js src/commands/status.js`
