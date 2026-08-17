# Ink Session UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the `decode` interactive session (no-args mode) in an Ink terminal UI with a two-column welcome banner, message log, prompt line, and status bar — while leaving all command dispatch logic and one-shot commands completely unchanged.

**Architecture:** `session.js` gates on `process.stdout.isTTY`; TTY path dynamically imports and renders `<App />` via Ink; non-TTY path runs the existing readline loop verbatim. `App.jsx` owns all React state, patches `console.log`/`console.error` before each command dispatch to capture output into a `messages[]` array, and calls the extracted `dispatchCommand()` named export from `session.js`.

**Tech Stack:** Ink 5.x (ESM), ink-text-input, ink-testing-library (dev), React 18, Vitest 3.x, ESM throughout (`"type": "module"`).

## Global Constraints

- ESM only — all files use `import`/`export`, no `require()`.
- `.jsx` extension for all Ink component files — required for JSX transform.
- Vitest must be configured with `@vitejs/plugin-react` (or equivalent) to handle JSX in tests.
- Two colors only: default white and `dimColor` — no accent colors, no cyan, no hex values.
- `/><` rendered as a single `<Text bold>` string — no spaces between glyphs.
- `TIPS` and `WHATS_NEW` exported as arrays at the top of `WelcomeBanner.jsx`.
- Do not modify any file in `src/commands/`, `src/services/`, or `src/utils/`.
- Do not modify `src/ui/` (chalk/boxen system) — Ink components live in `src/ui/ink/` only.
- Existing tests (`test/unit/session.test.js`, `test/integration/session.test.js`) must pass unchanged.
- `npm test` and `npm run lint` must be green at the end of every task.

---

## File Map

**New files:**
- `src/ui/ink/App.jsx` — root Ink component; owns all state
- `src/ui/ink/WelcomeBanner.jsx` — two-column bordered banner, shown once
- `src/ui/ink/MessageLog.jsx` — renders captured console output lines
- `src/ui/ink/PromptLine.jsx` — ink-text-input prompt row
- `src/ui/ink/StatusBar.jsx` — dim single-line footer
- `test/unit/ui/WelcomeBanner.test.jsx` — component tests
- `test/unit/ui/StatusBar.test.jsx` — component tests
- `test/unit/ui/PromptLine.test.jsx` — component tests

**Modified files:**
- `package.json` — add `ink`, `ink-text-input` to dependencies; add `ink-testing-library`, `@vitejs/plugin-react` to devDependencies
- `vitest.config.js` — create (does not exist yet); configure React JSX transform
- `src/session/session.js` — extract `dispatchCommand()` as named export; add TTY gate; rename readline section to `startReadlineSession()`
- `README.md` — update interactive session section
- `docs/architecture.md` — add `src/ui/ink/` layer description

---

## Task 1: Install dependencies and configure JSX transform

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`

**Interfaces:**
- Produces: `import { render } from 'ink'` works; `import TextInput from 'ink-text-input'` works; JSX in `.jsx` test files compiles under `vitest run`

- [ ] **Step 1: Install runtime dependencies**

```bash
cd /path/to/decode-cli
npm install ink ink-text-input
```

Verify `package.json` `dependencies` now contains `"ink"` and `"ink-text-input"`.

- [ ] **Step 2: Install dev dependencies**

```bash
npm install --save-dev ink-testing-library @vitejs/plugin-react
```

- [ ] **Step 3: Create vitest.config.js**

Vitest needs to know how to handle `.jsx` files with the React JSX transform that Ink requires. Create this file at the project root:

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: Verify existing tests still pass**

```bash
npm test
```

Expected: all existing tests pass (same count as before).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js
git commit -m "chore: add ink, ink-text-input, ink-testing-library, vitest react plugin"
```

---

## Task 2: Extract `dispatchCommand` from `session.js`

**Files:**
- Modify: `src/session/session.js`
- Test: `test/unit/session.test.js` (run to confirm no regression)

**Interfaces:**
- Produces: `dispatchCommand(raw: string, config: object): Promise<{ type: 'exit' } | { type: 'ok' }>` — named export from `src/session/session.js`
- Produces: `startReadlineSession(config: object): void` — internal function (not exported) containing the existing readline loop
- Existing exports unchanged: `parseSlashInput` still exported, `startSession` still exported

The goal is to pull the `rl.on('line', ...)` handler body into a standalone async function so `App.jsx` can call it without going through readline. `startSession()` itself stays as the public entry point but will be extended in Task 5 to add the TTY gate.

- [ ] **Step 1: Read the current `session.js` in full before editing**

Open `src/session/session.js` and locate the `rl.on('line', async (line) => { ... })` handler — lines ~182–241. This is the logic being extracted.

- [ ] **Step 2: Add `dispatchCommand` as a named export**

Below the `renderGroupHelp` function (around line 154) and above `printBanner`, insert:

```js
// ---------------------------------------------------------------------------
// dispatchCommand — exported so App.jsx can call it directly (Ink path)
// ---------------------------------------------------------------------------
/**
 * Processes one raw input line from the REPL.
 * Returns { type: 'exit' } if the session should terminate, { type: 'ok' } otherwise.
 * Side effects: calls command handlers which write to console.log/console.error.
 */
export async function dispatchCommand(raw, _config) {
  if (!raw) return { type: 'ok' };

  if (raw.startsWith('/')) {
    const parsed = parseSlashInput(raw);
    if (!parsed) {
      output.error('Could not parse command. Type /help for a list.');
      return { type: 'ok' };
    }

    const { command, args, opts } = parsed;

    if (command === 'exit' || command === 'quit') {
      return { type: 'exit' };
    }
    if (command === 'help') {
      renderHelp();
      return { type: 'ok' };
    }
    if (GROUPS[command]) {
      renderGroupHelp(command);
      return { type: 'ok' };
    }

    const entry = DISPATCH[command];
    if (!entry) {
      output.error(`Unknown command: /${command}. Type /help for a list.`);
      return { type: 'ok' };
    }

    try {
      await entry.handler(args, opts);
    } catch (err) {
      output.error(`/${command} failed: ${err.message}`);
    }
    return { type: 'ok' };
  }

  // Non-slash input: AI agent seam (intentionally empty for now)
  return { type: 'ok' };
}
```

- [ ] **Step 3: Rename the readline loop to `startReadlineSession`**

Rename the existing `startSession` to `startReadlineSession` (keep it unexported — it's internal). Then replace the `rl.on('line', ...)` handler body with a call to `dispatchCommand`:

```js
async function startReadlineSession(config) {
  printBanner(config);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'decode> ',
    terminal: true,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const raw = line.trim();
    const result = await dispatchCommand(raw, config);
    if (result.type === 'exit') {
      rl.close();
      return;
    }
    rl.prompt();
  });

  rl.on('close', () => {
    output.plain('\nGoodbye!');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    rl.close();
  });
}
```

- [ ] **Step 4: Keep `startSession` as the public entry point (non-TTY only for now)**

```js
export async function startSession() {
  const config = readConfig();
  return startReadlineSession(config);
}
```

The TTY gate comes in Task 5. For now `startSession` always goes to readline so existing integration tests continue passing.

- [ ] **Step 5: Run existing tests**

```bash
npm test
```

Expected: all tests pass. The integration tests exercise the readline path; the unit tests exercise `parseSlashInput` and the module exports — both unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/session/session.js
git commit -m "refactor: extract dispatchCommand from session readline handler"
```

---

## Task 3: Build `WelcomeBanner.jsx`

**Files:**
- Create: `src/ui/ink/WelcomeBanner.jsx`
- Create: `test/unit/ui/WelcomeBanner.test.jsx`

**Interfaces:**
- Consumes: `config: { llm: { provider: string | null }, ... }` prop; `cwd: string` prop
- Produces: `<WelcomeBanner config={config} cwd={cwd} />` — default export

**First-run detection:** `config.llm.provider === null` → show `Welcome!`; otherwise show `Welcome back!`

- [ ] **Step 1: Write the failing tests**

Create `test/unit/ui/WelcomeBanner.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import WelcomeBanner, { TIPS, WHATS_NEW } from '../../../src/ui/ink/WelcomeBanner.jsx';

const configuredConfig = { llm: { provider: 'claude' } };
const freshConfig = { llm: { provider: null } };

describe('WelcomeBanner', () => {
  it('renders the /›‹ logo mark', () => {
    const { lastFrame } = render(
      <WelcomeBanner config={configuredConfig} cwd="/home/user/my-project" />
    );
    expect(lastFrame()).toContain('/><');
  });

  it('renders DeCode name and tagline', () => {
    const { lastFrame } = render(
      <WelcomeBanner config={configuredConfig} cwd="/home/user/my-project" />
    );
    expect(lastFrame()).toContain('DeCode');
    expect(lastFrame()).toContain('Your Project, Decoded.');
  });

  it('shows Welcome back! when provider is configured', () => {
    const { lastFrame } = render(
      <WelcomeBanner config={configuredConfig} cwd="/home/user/my-project" />
    );
    expect(lastFrame()).toContain('Welcome back!');
    expect(lastFrame()).not.toContain('Welcome!');
  });

  it('shows Welcome! on first run (provider null)', () => {
    const { lastFrame } = render(
      <WelcomeBanner config={freshConfig} cwd="/home/user/my-project" />
    );
    expect(lastFrame()).toContain('Welcome!');
    expect(lastFrame()).not.toContain('Welcome back!');
  });

  it('renders the cwd path', () => {
    const { lastFrame } = render(
      <WelcomeBanner config={configuredConfig} cwd="/home/user/my-project" />
    );
    expect(lastFrame()).toContain('/home/user/my-project');
  });

  it('renders provider name', () => {
    const { lastFrame } = render(
      <WelcomeBanner config={configuredConfig} cwd="/home/user/my-project" />
    );
    expect(lastFrame()).toContain('claude');
  });

  it('renders — when provider is null', () => {
    const { lastFrame } = render(
      <WelcomeBanner config={freshConfig} cwd="/home/user/my-project" />
    );
    expect(lastFrame()).toContain('—');
  });

  it('renders TIPS content', () => {
    const { lastFrame } = render(
      <WelcomeBanner config={configuredConfig} cwd="/home/user/my-project" />
    );
    for (const tip of TIPS) {
      expect(lastFrame()).toContain(tip);
    }
  });

  it('renders WHATS_NEW content', () => {
    const { lastFrame } = render(
      <WelcomeBanner config={configuredConfig} cwd="/home/user/my-project" />
    );
    for (const item of WHATS_NEW) {
      expect(lastFrame()).toContain(item);
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- test/unit/ui/WelcomeBanner.test.jsx
```

Expected: FAIL — `WelcomeBanner.jsx` does not exist yet.

- [ ] **Step 3: Create `src/ui/ink/WelcomeBanner.jsx`**

```jsx
import React from 'react';
import { Box, Text } from 'ink';

export const TIPS = [
  '/help   list all commands',
  '/exit   quit the session',
];

export const WHATS_NEW = [
  '• Interactive session UI',
];

export default function WelcomeBanner({ config, cwd }) {
  const isFirstRun = config.llm?.provider === null || config.llm?.provider === undefined;
  const provider = config.llm?.provider ?? '—';

  return (
    <Box borderStyle="round" flexDirection="row" paddingX={1}>
      {/* Left column */}
      <Box flexDirection="column" marginRight={2} minWidth={24}>
        <Text bold>/&gt;&lt;</Text>
        <Text bold>DeCode</Text>
        <Text dimColor>Your Project, Decoded.</Text>
        <Text> </Text>
        <Text>{isFirstRun ? 'Welcome!' : 'Welcome back!'}</Text>
        <Text dimColor>{cwd}</Text>
        <Text dimColor>Provider: {provider}</Text>
      </Box>

      {/* Divider */}
      <Box borderStyle="classic" borderLeft borderRight={false} borderTop={false} borderBottom={false} marginRight={2} />

      {/* Right column */}
      <Box flexDirection="column" minWidth={28}>
        <Text bold>Tips for getting started</Text>
        {TIPS.map((tip) => (
          <Text key={tip} dimColor>{tip}</Text>
        ))}
        <Text> </Text>
        <Text bold>What&apos;s new</Text>
        {WHATS_NEW.map((item) => (
          <Text key={item} dimColor>{item}</Text>
        ))}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- test/unit/ui/WelcomeBanner.test.jsx
```

Expected: all WelcomeBanner tests PASS.

- [ ] **Step 5: Run full suite to confirm no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/ink/WelcomeBanner.jsx test/unit/ui/WelcomeBanner.test.jsx
git commit -m "feat: add WelcomeBanner Ink component"
```

---

## Task 4: Build `StatusBar.jsx`, `MessageLog.jsx`, and `PromptLine.jsx`

**Files:**
- Create: `src/ui/ink/StatusBar.jsx`
- Create: `src/ui/ink/MessageLog.jsx`
- Create: `src/ui/ink/PromptLine.jsx`
- Create: `test/unit/ui/StatusBar.test.jsx`
- Create: `test/unit/ui/PromptLine.test.jsx`

**Interfaces:**
- `<StatusBar cwd={string} />` — default export from `StatusBar.jsx`
- `<MessageLog messages={string[]} />` — default export from `MessageLog.jsx`
- `<PromptLine onSubmit={(raw: string) => void} />` — default export from `PromptLine.jsx`

- [ ] **Step 1: Write failing tests for StatusBar**

Create `test/unit/ui/StatusBar.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import StatusBar from '../../../src/ui/ink/StatusBar.jsx';

describe('StatusBar', () => {
  it('renders session mode indicator', () => {
    const { lastFrame } = render(<StatusBar cwd="/home/user/my-project" />);
    expect(lastFrame()).toContain('session');
  });

  it('renders shortcut hint', () => {
    const { lastFrame } = render(<StatusBar cwd="/home/user/my-project" />);
    expect(lastFrame()).toContain('? for shortcuts');
  });

  it('renders the basename of cwd', () => {
    const { lastFrame } = render(<StatusBar cwd="/home/user/my-project" />);
    expect(lastFrame()).toContain('my-project');
  });
});
```

- [ ] **Step 2: Write failing tests for PromptLine**

Create `test/unit/ui/PromptLine.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import PromptLine from '../../../src/ui/ink/PromptLine.jsx';

describe('PromptLine', () => {
  it('renders the decode> prefix', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(<PromptLine onSubmit={onSubmit} />);
    expect(lastFrame()).toContain('decode>');
  });

  it('calls onSubmit with typed input on Enter', () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<PromptLine onSubmit={onSubmit} />);
    stdin.write('/help');
    stdin.write('\r');
    expect(onSubmit).toHaveBeenCalledWith('/help');
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm test -- test/unit/ui/StatusBar.test.jsx test/unit/ui/PromptLine.test.jsx
```

Expected: FAIL — files do not exist.

- [ ] **Step 4: Create `src/ui/ink/StatusBar.jsx`**

```jsx
import React from 'react';
import { Box, Text } from 'ink';
import path from 'node:path';

export default function StatusBar({ cwd }) {
  const basename = path.basename(cwd);

  return (
    <Box paddingX={1}>
      <Text dimColor>● session   ? for shortcuts   {basename}</Text>
    </Box>
  );
}
```

- [ ] **Step 5: Create `src/ui/ink/MessageLog.jsx`**

No test file needed — it is a pure display component with no logic; it is exercised via `App` in integration. Create the file:

```jsx
import React from 'react';
import { Box, Text } from 'ink';

export default function MessageLog({ messages }) {
  if (!messages.length) return null;

  return (
    <Box flexDirection="column">
      {messages.map((line, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  );
}
```

- [ ] **Step 6: Create `src/ui/ink/PromptLine.jsx`**

```jsx
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export default function PromptLine({ onSubmit }) {
  const [value, setValue] = useState('');

  function handleSubmit(submitted) {
    setValue('');
    onSubmit(submitted);
  }

  return (
    <Box>
      <Text>decode&gt; </Text>
      <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
    </Box>
  );
}
```

- [ ] **Step 7: Run component tests**

```bash
npm test -- test/unit/ui/StatusBar.test.jsx test/unit/ui/PromptLine.test.jsx
```

Expected: all PASS.

- [ ] **Step 8: Run full suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/ui/ink/StatusBar.jsx src/ui/ink/MessageLog.jsx src/ui/ink/PromptLine.jsx \
        test/unit/ui/StatusBar.test.jsx test/unit/ui/PromptLine.test.jsx
git commit -m "feat: add StatusBar, MessageLog, and PromptLine Ink components"
```

---

## Task 5: Build `App.jsx` and wire it into `session.js`

**Files:**
- Create: `src/ui/ink/App.jsx`
- Modify: `src/session/session.js` (add TTY gate to `startSession`)

**Interfaces:**
- Consumes: `dispatchCommand` from `src/session/session.js`
- Consumes: `WelcomeBanner`, `MessageLog`, `PromptLine`, `StatusBar` from their respective files
- Consumes: `config: object` prop passed from `startSession`
- Produces: `<App config={config} />` — default export

**Output capture pattern:**
```
origLog = console.log
origErr = console.error
console.log = (...args) => push to messages state
console.error = (...args) => push to messages state
await dispatchCommand(raw, config)
console.log = origLog
console.error = origErr
```

- [ ] **Step 1: Create `src/ui/ink/App.jsx`**

```jsx
import React, { useState, useCallback } from 'react';
import { Box, useApp } from 'ink';
import WelcomeBanner from './WelcomeBanner.jsx';
import MessageLog from './MessageLog.jsx';
import PromptLine from './PromptLine.jsx';
import StatusBar from './StatusBar.jsx';
import { dispatchCommand } from '../../session/session.js';

export default function App({ config }) {
  const { exit } = useApp();
  const [messages, setMessages] = useState([]);
  const [showBanner, setShowBanner] = useState(true);
  const cwd = process.cwd();

  const handleSubmit = useCallback(async (raw) => {
    if (!raw.trim()) return;

    setShowBanner(false);

    // Capture console output from command handlers
    const captured = [];
    const origLog = console.log;
    const origErr = console.error;
    console.log = (...args) => captured.push(args.join(' '));
    console.error = (...args) => captured.push(args.join(' '));

    let result;
    try {
      result = await dispatchCommand(raw.trim(), config);
    } finally {
      console.log = origLog;
      console.error = origErr;
    }

    if (captured.length) {
      setMessages((prev) => [...prev, ...captured]);
    }

    if (result?.type === 'exit') {
      exit();
    }
  }, [config, exit]);

  return (
    <Box flexDirection="column">
      {showBanner && <WelcomeBanner config={config} cwd={cwd} />}
      <MessageLog messages={messages} />
      <PromptLine onSubmit={handleSubmit} />
      <StatusBar cwd={cwd} />
    </Box>
  );
}
```

- [ ] **Step 2: Add the TTY gate to `startSession` in `session.js`**

Replace the current `startSession` export (the one that always calls `startReadlineSession`) with:

```js
export async function startSession() {
  const config = readConfig();

  if (!process.stdout.isTTY) {
    return startReadlineSession(config);
  }

  // TTY path: Ink UI
  // Dynamic imports keep Ink entirely out of the non-TTY code path.
  const { render } = await import('ink');
  const React = (await import('react')).default;
  const { default: App } = await import('../ui/ink/App.jsx');

  render(React.createElement(App, { config }));
}
```

Note: dynamic `import('ink')` is used (not a top-level import) so `ink` is never loaded when running in non-TTY mode, keeping CI/pipe paths clean.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests pass. The integration tests go through the non-TTY readline path (piped stdin → `isTTY` is false) and hit `startReadlineSession` exactly as before.

- [ ] **Step 4: Commit**

```bash
git add src/ui/ink/App.jsx src/session/session.js
git commit -m "feat: add App.jsx and wire Ink UI into startSession with TTY gate"
```

---

## Task 6: Update docs and run final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update README.md interactive session section**

Find the section describing the interactive session (the one added in the previous pass). Replace the example with:

```markdown
### Interactive session

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
```

- [ ] **Step 2: Update docs/architecture.md**

Find the `src/` structure section. Add `src/ui/ink/` after the existing `src/ui/` entry:

```markdown
│   ├── ui/                          # Two-layer UI system:
│   │   ├── theme.js / typography.js / ...   # chalk/boxen rendering (one-shot commands)
│   │   └── ink/                     # Ink React components (session mode only)
│   │       ├── App.jsx              # Root component — state, output capture, dispatch
│   │       ├── WelcomeBanner.jsx    # Two-column bordered banner (shown once)
│   │       ├── MessageLog.jsx       # Captured command output display
│   │       ├── PromptLine.jsx       # ink-text-input prompt row
│   │       └── StatusBar.jsx        # Dim single-line footer
│   │
│   │   **Presentation only** — `src/ui/ink/` contains zero command logic.
│   │   Command logic stays in `src/commands/` and `session.js`'s
│   │   `dispatchCommand()`. App.jsx calls `dispatchCommand` as a plain
│   │   function import; it does not re-implement parsing or dispatch.
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Run the full test suite one final time**

```bash
npm test
```

Expected: all tests pass. Confirm the count includes the new component tests.

- [ ] **Step 5: Final commit**

```bash
git add README.md docs/architecture.md
git commit -m "docs: update README and architecture for Ink session UI"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `src/ui/ink/` directory with all five component files — Tasks 3, 4, 5
- [x] `WelcomeBanner.jsx` — two-column, round border, `/><` bold, name, tagline, welcome/welcome-back, path, provider — Task 3
- [x] TIPS and WHATS_NEW as exported arrays at top of file — Task 3
- [x] `PromptLine.jsx` wrapping ink-text-input — Task 4
- [x] `StatusBar.jsx` dim single line — Task 4
- [x] `MessageLog.jsx` pass-through display — Task 4
- [x] `App.jsx` composing all components — Task 5
- [x] Console capture (B1 pattern) — Task 5
- [x] TTY gate in `startSession` — Task 5
- [x] `dispatchCommand` named export — Task 2
- [x] Non-TTY fallback to readline — Task 2 + 5
- [x] Existing tests unchanged — verified in every task step
- [x] One-shot commands unaffected (Ink never imported in non-TTY path) — Task 5
- [x] ink + ink-text-input in dependencies, ink-testing-library in devDependencies — Task 1
- [x] ink-testing-library component tests for WelcomeBanner, StatusBar, PromptLine — Tasks 3, 4
- [x] README update — Task 6
- [x] docs/architecture.md update — Task 6
- [x] Black/white only palette enforced throughout — no color overrides in any component

**Type consistency:**
- `dispatchCommand(raw: string, config: object)` — defined in Task 2, consumed in Task 5 ✓
- `<WelcomeBanner config={config} cwd={cwd} />` — defined in Task 3, consumed in Task 5 ✓
- `<MessageLog messages={string[]} />` — defined in Task 4, consumed in Task 5 ✓
- `<PromptLine onSubmit={(raw: string) => void} />` — defined in Task 4, consumed in Task 5 ✓
- `<StatusBar cwd={string} />` — defined in Task 4, consumed in Task 5 ✓
