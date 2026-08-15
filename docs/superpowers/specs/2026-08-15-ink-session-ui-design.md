# Ink Session UI — Design Spec

**Date:** 2026-08-15
**Status:** Approved
**Author:** Ahmed Raza Khan + Antigravity

---

## Overview

Wrap the existing `decode` interactive session (no-args mode) in a proper
terminal UI built with Ink. The Ink layer is purely presentational — it
renders components and routes input to the same `parseSlashInput` +
dispatch table that already exists in `session.js`. No command logic moves.

One-shot commands (`decode api`, `decode audit`, etc.) are completely
unaffected. Non-TTY environments (piped stdin, CI) fall back to the
existing readline loop unchanged.

---

## 1. Visual Design

### Color palette

Two colors only — black and white — for a minimalist look.

| Role | Ink prop |
|---|---|
| Primary text | default (white on black) |
| Secondary / metadata | `dimColor` |
| Bold emphasis | `bold` |
| Border | default (no color override) |

No accent color. No cyan. No ACCENT_COLOR constant. The only theme export
needed is documentation of this decision, not a runtime constant.

### Welcome banner (shown once on session start)

```
╭──────────────────────────────────────────────────────╮
│  /><                   │  Tips for getting started   │
│  DeCode                │  /help   list all commands  │
│  Your Project, Decoded.│  /exit   quit the session   │
│                        │                             │
│  Welcome back!         │  What's new in v0.1.0       │
│  ~/my-project          │  • Interactive session mode │
│  Provider: claude      │                             │
╰──────────────────────────────────────────────────────╯
```

- Border: `borderStyle="round"`, no `borderColor` override (terminal default white)
- Left column:
  1. `/><` — `<Text bold>` — tight, no spaces between glyphs
  2. `DeCode` — `<Text bold>`
  3. `Your Project, Decoded.` — `<Text dimColor>`
  4. blank line
  5. `Welcome back!` or `Welcome!` (first-run) — plain `<Text>`
  6. `process.cwd()` — `<Text dimColor>`
  7. `Provider: <name>` or `Provider: —` — `<Text dimColor>`
- Right column:
  - `Tips for getting started` heading — `<Text bold>`
  - TIPS array items — `<Text dimColor>`
  - blank line
  - `What's new` heading — `<Text bold>`
  - WHATS_NEW array items — `<Text dimColor>`
- TIPS and WHATS_NEW exported as arrays at the top of `WelcomeBanner.jsx`
  for easy per-release updates without touching JSX

**First-run detection:** `config.llm.provider === null` — no new flag
needed, reuses the existing configStore shape.

**Banner lifetime:** hidden (`showBanner = false`) after the first command
is submitted. Not re-rendered per command.

### Prompt line

```
decode> █
```

Static `decode> ` prefix as `<Text>`, followed by `<TextInput>` from
`ink-text-input`. Clears after submit.

### Status bar (pinned bottom)

```
  ● session   ? for shortcuts   my-project
```

Single line, entirely `<Text dimColor>`. Shows: mode indicator, shortcut
hint, basename of `process.cwd()`. Deliberately muted — contrast with the
bold banner above is intentional.

### Message log

Renders between the banner and the prompt line. Displays `messages[]`
from App state — one `<Text>` per line. Chalk ANSI sequences in the
strings are passed through by Ink unchanged, so command output retains
its existing formatting. No restyling. No scroll management beyond
Ink's default terminal scroll.

---

## 2. Architecture

### File layout

```
src/ui/ink/                  ← new subdirectory (Ink components only)
  App.jsx
  WelcomeBanner.jsx
  MessageLog.jsx
  PromptLine.jsx
  StatusBar.jsx

src/session/session.js       ← modified: TTY gate + dispatchCommand export
test/unit/ui/
  WelcomeBanner.test.jsx
  StatusBar.test.jsx
  PromptLine.test.jsx
```

The existing `src/ui/` chalk/boxen system is untouched.

### TTY gate in `session.js`

```js
export async function startSession() {
  const config = readConfig();

  if (!process.stdout.isTTY) {
    // non-TTY fallback: existing readline loop (unchanged)
    return startReadlineSession(config);
  }

  // TTY path: Ink UI
  const { render } = await import('ink');
  const { default: App } = await import('../ui/ink/App.jsx');
  render(<App config={config} />);
}
```

Dynamic imports keep Ink out of the non-TTY code path entirely.

### `dispatchCommand` — named export from `session.js`

The `rl.on('line', ...)` handler logic is extracted into a standalone
async function:

```js
export async function dispatchCommand(raw, config) {
  // same logic as the current readline line handler:
  // parseSlashInput → built-ins (exit/help/group-help) → DISPATCH table
  // Returns: { type: 'exit' } | { type: 'output' /* console captured */ }
}
```

`App.jsx` imports and calls this. The readline loop calls it too (same
function, no duplication).

### Output capture (B1 pattern)

Before calling `dispatchCommand`, App patches `console.log` and
`console.error` to push strings into the `messages` state array. After
the command promise resolves, the originals are restored. Chalk ANSI
sequences pass through Ink unchanged.

```js
const origLog = console.log;
const origErr = console.error;
console.log = (...args) => setMessages(m => [...m, args.join(' ')]);
console.error = (...args) => setMessages(m => [...m, args.join(' ')]);
await dispatchCommand(raw, config);
console.log = origLog;
console.error = origErr;
```

### State in `App.jsx`

| State | Type | Purpose |
|---|---|---|
| `messages` | `string[]` | Captured console output lines |
| `showBanner` | `boolean` | Hide banner after first submit |
| `input` | `string` | Controlled input for PromptLine |
| `running` | `boolean` | Disable input while command runs |

---

## 3. Dependencies

Two new packages added to `dependencies` (not devDependencies — they ship
with the binary):

- `ink` — React-based terminal UI renderer
- `ink-text-input` — controlled text input component for Ink

`ink-testing-library` added to `devDependencies` for component tests.

The project is `"type": "module"` (ESM). Ink 5.x is ESM-native —
compatible.

---

## 4. Testing

### Component tests (`ink-testing-library`)

**`test/unit/ui/WelcomeBanner.test.jsx`**
- Renders with a mock config (`llm.provider: 'claude'`) → checks `/><`,
  `DeCode`, `Your Project, Decoded.`, provider name, project path appear
- Renders with unconfigured config (`llm.provider: null`) → checks
  `Welcome!` (not `Welcome back!`)
- Checks TIPS and WHATS_NEW content renders

**`test/unit/ui/StatusBar.test.jsx`**
- Renders with session state → checks mode text and shortcut hint appear

**`test/unit/ui/PromptLine.test.jsx`**
- Simulates text input + Enter → verifies `onSubmit` called with typed string
- Verifies input clears after submit

### Existing tests — unchanged

- `test/unit/session.test.js` — `parseSlashInput` parser tests and command
  module export checks. No changes needed.
- `test/integration/session.test.js` — spawns real binary via execa with
  piped stdin → exercises non-TTY readline fallback. All assertions remain
  valid (`'DeCode Interactive Session'` in banner, `'decode>'` prompt,
  dispatch behavior). No changes needed.

---

## 5. Non-TTY / CI fallback

When `process.stdout.isTTY` is falsy (piped stdout, CI, scripted use):

- `startReadlineSession(config)` runs — the current readline loop verbatim
- Ink is never imported
- Output is identical to current behavior
- All existing integration tests continue to pass as-is

---

## 6. Doc updates

**`README.md`** — replace the interactive session example with a note on
the visual UI and mention the non-TTY fallback.

**`docs/architecture.md`** — add `src/ui/ink/` layer, note it is
presentation-only with no command logic (command logic stays in
`src/commands/` and `session.js`'s `dispatchCommand`).

---

## 7. Out of scope

- No new slash commands
- No assistant/AI wiring
- No restyling of command output (chalk output passes through as-is)
- No image rendering (the `/><` mark is terminal text, not a graphic)
- No scrollback management beyond what Ink provides natively
