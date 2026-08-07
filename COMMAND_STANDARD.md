# DeCode Command Standard

**Version:** 1.0.0  
**Status:** Official Engineering Standard  
**Date:** 2026-08-08  
**Reference Implementation:** `src/commands/audit.js`

---

## Purpose

This document defines the **architectural standard** for all DeCode commands.

Every command, regardless of complexity, follows the same lifecycle, uses the same patterns, and maintains the same quality bar.

**Consistency is not negotiable.**

---

## Guiding Principles

### 1. Separation of Concerns

```
Commands describe WHAT to show.
Services describe HOW to compute.
Renderer describes HOW to display.
```

Commands are **presentation controllers**, not business logic containers.

### 2. Zero Terminal Coupling

Commands never call:
- ❌ `console.log()`
- ❌ `console.error()`
- ❌ `process.stdout.write()`
- ❌ `chalk` directly
- ❌ `ora` or spinners
- ❌ Raw ANSI codes

**Everything** flows through `renderer`.

### 3. Observable Work Only

Progress indicators represent **real work**, not fake activity.
- Use `renderer.progressive()` for multi-stage operations
- Use `renderer.progress()` for measurable tasks
- Use `renderer.scan()` for indefinite operations
- **Never** use spinners unless absolutely necessary

### 4. Intelligent by Default

Commands parse, format, and contextualize service output.

Raw data from services → Formatted for humans.

### 5. Three Modes, Always

Every command supports:
1. **Interactive** (default) — Full UI experience
2. **CI** (`--ci`) — Plain text, parseable, no color
3. **JSON** (`--json`) — Machine-readable, bypasses UI

---

## Command Lifecycle

### Phase 1: Input Validation

**Before** calling services, validate all inputs.

```javascript
export function myCommand() {
  return new Command('my-command')
    .description('Command description')
    .argument('[arg]', 'Argument description')
    .option('--flag', 'Flag description')
    .option('--json', 'Output machine-readable JSON')
    .option('--ci', 'CI-friendly plain output')
    .action(async (arg, opts) => {
      try {
        // Validate inputs
        if (!validateInputs(arg, opts)) {
          renderError(new Error('Invalid input'));
          process.exitCode = 1;
          return;
        }

        await executeCommand(arg, opts);
      } catch (err) {
        renderError(err);
        process.exitCode = 1;
      }
    });
}
```

**Rules:**
- Validate before executing services
- Return early on invalid input
- Use `renderError()` for validation failures
- Set `process.exitCode = 1` on failure

---

### Phase 2: Service Execution

**After** validation, execute business logic through services.

```javascript
async function executeCommand(arg, opts) {
  // JSON mode bypasses UI
  if (opts.json) {
    const result = await runService(arg);
    renderer.render(JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
    return;
  }

  // CI mode uses simplified rendering
  if (opts.ci) {
    const result = await runService(arg);
    renderCiOutput(result);
    if (!result.success) process.exitCode = 1;
    return;
  }

  // Interactive mode
  await renderInteractive(arg, opts);
}
```

**Rules:**
- Services return **data**, not UI
- Commands never implement business logic
- Always handle JSON mode first (bypasses UI entirely)
- Always handle CI mode second (simplified rendering)
- Interactive mode is the showcase

---

### Phase 3: Data Normalization

**Transform** service output into display-ready data.

```javascript
async function renderInteractive(arg, opts) {
  // Show progress
  const stages = renderer.progressive();
  stages.stage(ui.body('Processing...'));

  // Execute service
  const rawResult = await runService(arg);

  stages.finish();

  // Normalize data
  const normalized = normalizeResult(rawResult);

  // Build UI
  renderScreen(normalized);
}
```

**Rules:**
- Services return raw strings/objects
- Commands parse and format for display
- Extract verdicts, details, counts
- Truncate long outputs (file lists, logs)
- Summarize where appropriate

**Example:**
```javascript
function normalizeResult(raw) {
  return {
    verdict: parseVerdict(raw.detail),    // "stale" from "stale: file1, file2"
    detail: parseDetail(raw.detail),      // "41 files" from "file1, file2, ..."
    status: raw.status,                   // pass/fail/skip
    count: extractCount(raw.detail),      // 41 from "stale: 41 files"
  };
}
```

---

### Phase 4: ViewModel Creation

**Build** the screen content using UI components.

```javascript
function renderScreen(normalized) {
  // Verdict: What's the truth?
  const statusRows = buildStatusRows(normalized);

  // Evidence: Why is that true?
  const summary = buildSummary(normalized);

  // Action: What should I do?
  const actions = buildActions(normalized);
  const warnings = buildWarnings(normalized);

  // Compose
  const content = [
    statusRows,
    ui.space('normal'),
    summary,
    actions ? ui.space('normal') + actions : '',
    warnings ? ui.space('normal') + warnings : '',
  ].filter(Boolean).join('');

  // Render
  renderer.render({
    command: 'decode my-command',
    context: '— context description',
    content,
  });

  // Exit code
  if (!normalized.success) {
    process.exitCode = 1;
  }
}
```

**Rules:**
- Use the **Verdict → Evidence → Action** hierarchy
- Build content with UI components only
- Never construct strings manually
- Compose in order: status → summary → actions → warnings
- Use `ui.space()` for vertical rhythm

---

### Phase 5: Renderer Integration

**Pass** the composed content to the renderer.

```javascript
renderer.render({
  command: 'decode my-command',
  context: '— optional context',
  content: '...',          // Required
  actions: '...',          // Optional
});
```

**Screen Types:**

```javascript
// Standard screen
renderer.render({ command, context, content });

// Error screen
renderer.render({ type: 'error', command, error });

// Success screen
renderer.render({ type: 'success', command, confirmation, metadata, suggestion });

// Empty state
renderer.render({ type: 'empty', command, message, actions });

// Launch screen
renderer.render({ type: 'launch', content });
```

**Rules:**
- Always provide `command`
- Provide `context` for clarity (e.g., "— project health")
- Build `content` from UI components
- Never pass raw strings from services
- Use appropriate screen type

---

### Phase 6: Interactive Mode

**Default** mode — full UI experience.

```javascript
async function renderInteractive(arg, opts) {
  // 1. Show progress
  const stages = renderer.progressive();
  stages.stage(ui.body('Working...'));

  // 2. Execute
  const result = await runService(arg);

  stages.finish();

  // 3. Build UI
  const content = buildContent(result);

  // 4. Render
  renderer.render({
    command: 'decode my-command',
    content,
  });

  // 5. Exit code
  if (!result.success) process.exitCode = 1;
}
```

**Required Elements:**
- Observable progress (if operation takes >1s)
- Status indicators (dots: ●○◆)
- Summary line (bold numbers with separators)
- Context-aware actions
- Selective warnings (only when actionable)

**Pattern:**
```
<progress indicator>
decode <command> — <context>

<status rows with dots>

<summary with bold numbers>

<context-aware actions>

<selective warnings>
```

---

### Phase 7: CI Mode

**Simplified** output for automation.

```javascript
function renderCiOutput(result) {
  const lines = [];

  // Status lines
  for (const item of result.items) {
    const label = item.status === 'pass' ? 'PASS' :
                 item.status === 'fail' ? 'FAIL' :
                 'SKIP';
    lines.push(`${label} ${item.name} — ${item.detail}`);
  }

  // Summary
  lines.push('');
  lines.push(`Summary: ${result.passed} passed, ${result.failed} failed`);

  renderer.render(lines.join('\n'));
}
```

**Rules:**
- Plain text only
- No colors, no ANSI codes
- Parseable format: `LABEL item — detail`
- Always include summary line
- One status per line
- Exit code reflects success/failure

**Pattern:**
```
PASS item1 — detail
FAIL item2 — detail
SKIP item3 — detail

Summary: X passed, Y failed, Z skipped
```

---

### Phase 8: JSON Mode

**Machine-readable** output, bypasses UI.

```javascript
if (opts.json) {
  const result = await runService(arg);
  renderer.render(JSON.stringify(result, null, 2));
  if (!result.success) process.exitCode = 1;
  return;
}
```

**Rules:**
- Handle **first** (before any UI rendering)
- Output service result directly (no parsing)
- Pretty-print with 2-space indent
- Set exit code based on result
- No progress indicators
- No UI components

**Output:**
```json
{
  "items": [...],
  "summary": { "passed": 2, "failed": 1, "success": false },
  "timestamp": "2026-08-08T00:00:00.000Z"
}
```

---

### Phase 9: Error Handling

**Consistent** error screens for all failures.

```javascript
try {
  await executeCommand(arg, opts);
} catch (err) {
  renderError(err);
  process.exitCode = 1;
}

function renderError(err) {
  const error = ui.errorPrompt({
    type: 'Command failed',
    explanation: err.message || 'An unexpected error occurred.',
    actions: [
      { command: 'decode status', description: 'check configuration' },
      { command: 'decode --help', description: 'view available commands' },
    ],
  });

  renderer.render({
    type: 'error',
    command: 'decode my-command',
    error,
  });
}
```

**Rules:**
- Catch **all** errors at command level
- Never let errors bubble to terminal
- Provide recovery actions
- Use `ui.errorPrompt()` for formatting
- Always set `process.exitCode = 1`
- Log errors for debugging (not to user)

**Error Screen Pattern:**
```
decode <command>

◆  Error type

Explanation of what went wrong.
What the user should know.

→ decode <recovery-command>    suggested fix
→ decode --help                fallback action
```

---

### Phase 10: Exit Codes

**Consistent** exit codes for automation.

```javascript
// Success
process.exitCode = 0;  // (default, no need to set)

// Failure
process.exitCode = 1;

// Never use other codes
```

**Rules:**
- `0` = success (all checks passed)
- `1` = failure (one or more checks failed, or error occurred)
- Set exit code **before** rendering (not after)
- Set exit code in **all** failure paths
- Never use custom exit codes (2, 3, etc.)

**When to Set:**
```javascript
// After service execution
if (!result.success) {
  process.exitCode = 1;
}

// In error handler
catch (err) {
  renderError(err);
  process.exitCode = 1;
}

// For validation failures
if (!isValid(input)) {
  renderError(new Error('Invalid input'));
  process.exitCode = 1;
  return;
}
```

---

### Phase 11: Context-Aware Actions

**Dynamic** action suggestions based on state.

```javascript
function buildActions(result) {
  const actions = [];

  // Priority 1: Fix failures
  if (result.hasFailed) {
    actions.push({
      command: 'decode fix-command',
      description: 'resolve the issue',
    });
  }

  // Priority 2: Fix skipped items
  if (result.hasSkipped) {
    actions.push({
      command: 'decode setup-command',
      description: 'configure missing items',
    });
  }

  // Priority 3: All good — suggest next steps
  if (result.isSuccess && actions.length === 0) {
    actions.push({
      command: 'decode next-command',
      description: 'continue workflow',
    });
  }

  return actions.length > 0 ? ui.nextActions(actions) : null;
}
```

**Rules:**
- Actions change based on result state
- Never show static actions
- Priority order: failures → skipped → next steps
- Limit to 2-3 actions (not a menu)
- Always include description
- Use `ui.nextActions()` for formatting

**Action Format:**
```
→ decode <command>              <description>
```

---

### Phase 12: Logging Philosophy

**Silent** by default, verbose on demand.

```javascript
// ❌ Never log to console in commands
console.log('Processing...');
console.error('Error:', err);

// ✅ Log through debug system (future)
debug('Processing item:', item.id);
debug.error('Service failed:', err);

// ✅ Show progress through renderer
const stages = renderer.progressive();
stages.stage(ui.body('Processing...'));
```

**Rules:**
- **Never** `console.log()` in commands
- **Never** `console.error()` in commands
- Use `renderer.progressive()` for progress
- Use `ui.warningPrompt()` for warnings
- Use `ui.errorPrompt()` for errors
- Debug logs go to debug system (not implemented yet)
- Verbose mode controlled by environment variable (future)

**Philosophy:**
- Commands are **quiet** by default
- Progress is **observable**, not verbose
- Errors are **formatted**, not dumped
- Success is **concise**, not celebratory

---

### Phase 13: Testing Strategy

**Multi-level** testing approach.

#### Unit Tests (Service Layer)

```javascript
// test/unit/myService.test.js
import { describe, it, expect } from 'vitest';
import { runService } from '../src/services/myService.js';

describe('runService', () => {
  it('returns success for valid input', async () => {
    const result = await runService({ valid: true });
    expect(result.success).toBe(true);
  });

  it('returns failure for invalid input', async () => {
    const result = await runService({ valid: false });
    expect(result.success).toBe(false);
  });
});
```

#### Integration Tests (Command Layer)

```javascript
// test/integration/myCommand.test.js
import { describe, it, expect } from 'vitest';
import { execa } from 'execa';

describe('decode my-command', () => {
  it('runs successfully', async () => {
    const { stdout, exitCode } = await execa('node', ['bin/decode.js', 'my-command']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('success indicator');
  });

  it('handles failures', async () => {
    const { exitCode } = await execa('node', ['bin/decode.js', 'my-command', 'invalid'], {
      reject: false,
    });
    expect(exitCode).toBe(1);
  });
});
```

#### Snapshot Tests (Rendering Layer)

```javascript
// test/snapshots/myCommand.test.js
import { describe, it, expect } from 'vitest';
import * as renderer from '../src/ui/renderer.js';
import { buildScreen } from '../src/commands/myCommand.js';

describe('my-command rendering', () => {
  it('renders success state correctly', () => {
    const screen = buildScreen({ success: true });
    const snapshot = renderer.snapshot(screen);
    expect(snapshot).toMatchSnapshot();
  });

  it('renders failure state correctly', () => {
    const screen = buildScreen({ success: false });
    const snapshot = renderer.snapshot(screen);
    expect(snapshot).toMatchSnapshot();
  });
});
```

**Rules:**
- **Unit tests** for services (business logic)
- **Integration tests** for CLI (end-to-end)
- **Snapshot tests** for rendering (visual regression)
- Test all three modes (interactive, CI, JSON)
- Test error states
- Test edge cases (empty, missing data, etc.)

---

### Phase 14: Snapshot Strategy

**Visual regression** through snapshots.

```javascript
function buildScreen(result) {
  const content = buildContent(result);

  return {
    command: 'decode my-command',
    context: '— description',
    content,
  };
}

// Export for testing
export { buildScreen };
```

**Rules:**
- **Separate** screen building from rendering
- **Export** `buildScreen()` function for tests
- **Strip** ANSI codes in snapshots (renderer does this)
- **Commit** snapshots to version control
- **Review** snapshot diffs in PRs
- **Update** snapshots when design changes intentionally

**Snapshot Test:**
```javascript
it('renders audit screen', () => {
  const result = {
    items: [
      { status: 'pass', name: 'api', detail: '5/5 passing' },
      { status: 'fail', name: 'docs', detail: 'stale' },
    ],
    summary: { passed: 1, failed: 1, success: false },
  };

  const screen = buildScreen(result);
  const snapshot = renderer.snapshot(screen);

  expect(snapshot).toMatchSnapshot();
});
```

**Snapshot Output:**
```
decode my-command — description

●  api         5/5 passing         
◆  docs        stale                

1 passed · 1 warning · 0 critical

→ decode fix-command            resolve issues
```

---

### Phase 15: Performance Expectations

**Fast** by default, measured in practice.

| Operation | Target | Max |
|-----------|--------|-----|
| Input validation | < 1ms | 10ms |
| Data normalization | < 5ms | 50ms |
| UI building | < 10ms | 100ms |
| Rendering | < 10ms | 100ms |
| Total (excluding service) | < 50ms | 200ms |

**Service Layer:**
- Network calls: As fast as the network
- File operations: As fast as the filesystem
- Computation: Should be optimized

**Command Layer:**
- Parsing: O(n) where n = result size
- Formatting: O(n) where n = items to display
- Rendering: O(1) (pre-composed strings)

**Rules:**
- **Profile** before optimizing
- **Measure** with realistic data
- **Optimize** hot paths only
- **Avoid** premature optimization
- **Cache** expensive computations
- **Paginate** large result sets

**Progress Indicators:**
- Show if operation > 1 second
- Update at 100ms intervals (auto-throttled)
- Hide if operation < 100ms

---

## Command Template

```javascript
/**
 * src/commands/myCommand.js
 * `decode my-command` — Brief description.
 *
 * Pattern: Verdict → Evidence → Action
 * Reference: src/commands/audit.js
 */
import { Command } from 'commander';
import * as ui from '../ui/index.js';
import * as renderer from '../ui/renderer.js';
import { runMyService } from '../services/myService.js';

export function myCommand() {
  return new Command('my-command')
    .description('Command description')
    .argument('[arg]', 'Argument description')
    .option('--json', 'Output machine-readable JSON')
    .option('--ci', 'CI-friendly plain output')
    .action(async (arg, opts) => {
      try {
        await executeCommand(arg, opts);
      } catch (err) {
        renderError(err);
        process.exitCode = 1;
      }
    });
}

async function executeCommand(arg, opts) {
  // JSON mode
  if (opts.json) {
    const result = await runMyService(arg);
    renderer.render(JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
    return;
  }

  // CI mode
  if (opts.ci) {
    const result = await runMyService(arg);
    renderCiOutput(result);
    if (!result.success) process.exitCode = 1;
    return;
  }

  // Interactive mode
  await renderInteractive(arg, opts);
}

async function renderInteractive(arg, opts) {
  // Show progress
  const stages = renderer.progressive();
  stages.stage(ui.body('Processing...'));

  // Execute service
  const result = await runMyService(arg);

  stages.finish();

  // Normalize data
  const normalized = normalizeResult(result);

  // Build screen
  const content = buildContent(normalized);

  // Render
  renderer.render({
    command: 'decode my-command',
    context: '— description',
    content,
  });

  // Exit code
  if (!normalized.success) {
    process.exitCode = 1;
  }
}

function normalizeResult(raw) {
  return {
    verdict: parseVerdict(raw.detail),
    detail: parseDetail(raw.detail),
    success: raw.status === 'pass',
  };
}

function buildContent(normalized) {
  const statusRows = buildStatusRows(normalized);
  const summary = buildSummary(normalized);
  const actions = buildActions(normalized);

  return [
    statusRows,
    ui.space('normal'),
    summary,
    actions ? ui.space('normal') + actions : '',
  ].filter(Boolean).join('');
}

function buildStatusRows(normalized) {
  return ui.statusRow({
    status: normalized.success ? 'pass' : 'fail',
    label: 'component',
    verdict: normalized.verdict,
    detail: normalized.detail,
  });
}

function buildSummary(normalized) {
  return ui.statusSummary({
    passed: normalized.success ? 1 : 0,
    warning: normalized.success ? 0 : 1,
    critical: 0,
  });
}

function buildActions(normalized) {
  const actions = [];

  if (!normalized.success) {
    actions.push({
      command: 'decode fix-command',
      description: 'resolve the issue',
    });
  }

  return actions.length > 0 ? ui.nextActions(actions) : null;
}

function renderCiOutput(result) {
  const label = result.success ? 'PASS' : 'FAIL';
  const lines = [
    `${label} component — ${result.detail}`,
    '',
    `Summary: ${result.success ? '1 passed' : '1 failed'}`,
  ];

  renderer.render(lines.join('\n'));
}

function renderError(err) {
  const error = ui.errorPrompt({
    type: 'Command failed',
    explanation: err.message,
    actions: [
      { command: 'decode status', description: 'check configuration' },
      { command: 'decode --help', description: 'view available commands' },
    ],
  });

  renderer.render({
    type: 'error',
    command: 'decode my-command',
    error,
  });
}

function parseVerdict(detail) {
  return detail.split(':')[0].trim();
}

function parseDetail(detail) {
  return detail.includes(':') ? detail.split(':')[1].trim() : '';
}
```

---

## File Organization

Every command follows this structure:

```
src/commands/
├── myCommand.js         # Command controller (presentation logic)
│
src/services/
├── myService.js         # Business logic (computation, API calls)
│
test/unit/
├── myService.test.js    # Service unit tests
│
test/integration/
├── myCommand.test.js    # Command integration tests
│
test/snapshots/
├── myCommand.test.js    # Rendering snapshot tests
```

**Separation:**
- **Commands** = presentation controllers
- **Services** = business logic
- **Unit tests** = service behavior
- **Integration tests** = end-to-end CLI
- **Snapshot tests** = visual regression

---

## Code Quality Checklist

Before merging a command:

- [ ] Zero `console.log()` or `console.error()` calls
- [ ] No direct `chalk` or `ora` usage
- [ ] Imports `* as ui` and `* as renderer`
- [ ] Supports `--json` mode
- [ ] Supports `--ci` mode (if applicable)
- [ ] Has observable progress for >1s operations
- [ ] Uses `renderer.progressive()` for multi-stage work
- [ ] Parses service output for display
- [ ] Builds content with UI components
- [ ] Follows Verdict → Evidence → Action hierarchy
- [ ] Has context-aware actions
- [ ] Has selective warnings (not all failures)
- [ ] Has error handling with `renderError()`
- [ ] Sets exit codes correctly
- [ ] Has JSDoc comments
- [ ] Has unit tests (services)
- [ ] Has integration tests (CLI)
- [ ] Has snapshot tests (rendering)
- [ ] Passes linting
- [ ] Matches template structure
- [ ] References audit.js as pattern

---

## Anti-Patterns

**Never do these:**

### ❌ Direct Console Output
```javascript
// WRONG
console.log('Processing...');
console.error('Failed:', err);

// RIGHT
const stages = renderer.progressive();
stages.stage(ui.body('Processing...'));
```

### ❌ Business Logic in Commands
```javascript
// WRONG
async function executeCommand() {
  const data = await fetchFromAPI();
  const processed = processData(data);  // Logic in command
  return processed;
}

// RIGHT
async function executeCommand() {
  const result = await runService();  // Logic in service
  return result;
}
```

### ❌ Raw String Building
```javascript
// WRONG
const output = `● api: ${result.api}\n○ docs: ${result.docs}`;

// RIGHT
const output = [
  ui.statusRow({ status: 'pass', label: 'api', verdict: result.api }),
  ui.statusRow({ status: 'warn', label: 'docs', verdict: result.docs }),
].join('\n');
```

### ❌ Static Actions
```javascript
// WRONG
const actions = ui.nextActions([
  { command: 'decode status', description: 'view status' },
  { command: 'decode --help', description: 'get help' },
]);

// RIGHT
function buildActions(result) {
  if (result.needsSetup) {
    return ui.nextActions([
      { command: 'decode setup', description: 'configure missing items' },
    ]);
  }
  return null;
}
```

### ❌ Verbose Warnings
```javascript
// WRONG
if (result.failed) {
  warnings.push(ui.warningPrompt({
    message: 'Check failed',
    impact: 'It failed',
    action: { command: 'decode fix', description: 'fix it' }
  }));
}

// RIGHT
if (result.failed && hasActionableInsight(result)) {
  warnings.push(ui.warningPrompt({
    message: 'Multiple API routes are failing',
    impact: 'This may indicate backend issues or network problems.',
    action: { command: 'decode api check', description: 'view detailed diagnostics' }
  }));
}
```

### ❌ Missing Exit Codes
```javascript
// WRONG
async function executeCommand() {
  const result = await runService();
  if (!result.success) {
    renderError(new Error('Failed'));
    // Missing: process.exitCode = 1
  }
}

// RIGHT
async function executeCommand() {
  const result = await runService();
  if (!result.success) {
    renderError(new Error('Failed'));
    process.exitCode = 1;
  }
}
```

---

## Version History

### 1.0.0 (2026-08-08)
- Initial standard based on audit.js
- Defined 15-phase lifecycle
- Established Verdict → Evidence → Action pattern
- Created command template
- Defined testing strategy
- Established performance expectations

---

## References

- **Reference Implementation:** `src/commands/audit.js`
- **UI Framework:** `src/ui/README.md`
- **Rendering Engine:** `src/ui/ENGINE.md`
- **Design System:** `src/ui/theme.js`

---

## Approval

This standard is **official** and **non-negotiable**.

Every command in DeCode follows this pattern. No exceptions.

**Consistency is the feature.**

---

**END OF STANDARD**
