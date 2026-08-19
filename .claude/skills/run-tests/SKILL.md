---
name: run-tests
description: Run the decode-cli vitest suite. As of 2026-08-19 the config excludes the two nested worktrees, so `npx vitest run` is clean. Use whenever you need to run or verify tests in this repo.
---

# Run the decode-cli test suite

`decode-cli` is a Node ESM CLI (`type: "module"`). Tests are vitest.

## How to run

Full suite (clean — main repo only, all green):

```bash
npx vitest run --reporter=dot
```

One file by full relative path:

```bash
npx vitest run test/integration/api.test.js --reporter=dot
```

One describe/it group:

```bash
npx vitest run test/integration/api.test.js --name "decode api list"
```

## Why there's no longer a "worktree trap"

This repo nests two parallel git worktrees inside it:

```
.claude/worktrees/ink-session-ui/   # worktree-ink-session-ui branch
.worktrees/ink-session-ui/          # ink-session-ui branch
```

Each is an independent feature branch with its own `test/` tree. Vitest's
default glob recurses into them and runs duplicate copies of same-named files
(e.g. a request for `test/integration/api.test.js` pulled in 3 files / 30 tests
instead of 1 / 10).

That is now handled in `vitest.config.js`, not in the shell:

- `exclude` extends `defaultExclude` with `**/.claude/**` and `**/.worktrees/**`,
  so the worktree copies never get collected.
- `setupFiles: ['./test/setup.js']` points `DECODE_GLOBAL_CONFIG_DIR` at a temp
  dir so tests never read the real `~/.decode`. (This was previously dead code —
  the config didn't load it; now it does.)

Do NOT reintroduce the old `grep -v worktrees` workaround; the proper fix is
in the config. If a single-file run ever reports more files than you asked for,
that means the `exclude` entries were dropped — restore them rather than grepping.

## Status

Main repo is green: 217 tests / 217 files pass, no failures. The ~21 failed
tests / ~16 failed files seen in mid-2026 were entirely worktree pollution, not
main-repo regressions — including the previously-documented `config.test.js`,
`connect.test.js`, `llmClient.test.js`, `docGenerator.test.js`,
`githubClient.test.js` timeouts/assertions. None reproduce once the worktrees
are excluded.

## Notes

- Node >=18 (tested on v22). Deps already installed; run `npm install` only if
  `node_modules` is missing.
- Lint migrated command files with:
  `npx eslint src/commands/api.js src/commands/init.js src/commands/status.js`
