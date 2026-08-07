# DeCode Terminal Rendering Engine

## Architecture Overview

```
Commands
    ↓
Renderer (presentation layer)
    ↓
Motion (animation primitives)
    ↓
UI Components (visual building blocks)
    ↓
Theme Tokens (design system)
    ↓
Terminal (capability abstraction)
```

## Core Modules

### `terminal.js` — Terminal Capability Abstraction

Low-level terminal access and capability detection.

**Responsibilities:**
- Detect terminal dimensions (width, height)
- Handle resize events
- Detect Unicode, 256-color, true-color support
- Provide ANSI control sequences (cursor movement, clearing)
- Abstract stdout/stderr access
- Graceful fallback for non-TTY environments

**Key Functions:**
- `isTTY()` — Check if running in interactive terminal
- `getDimensions()` — Get current width × height
- `getCapabilities()` — Full capability report
- `write()`, `writeLine()`, `writeError()` — Output primitives
- `clearLine()`, `clearScreen()` — Clearing operations
- `moveCursor*()`, `hideCursor()`, `showCursor()` — Cursor control

**Design Principle:** Never assume capabilities. Always detect, always fallback.

---

### `motion.js` — Animation & Progress Primitives

Observable work representation, not fake progress.

**Responsibilities:**
- In-place updates (progress counters)
- Progressive replacement (multi-stage operations)
- Progress tracking with automatic throttling
- Health pulse animation (launch screens)
- Section transitions
- Batch updates to prevent flicker

**Key Functions:**
- `inPlaceUpdate(renderFn)` — Update same line repeatedly
- `progressTracker({ render, total })` — Auto-throttled progress
- `scanningIndicator({ render })` — Indefinite operations
- `progressiveReplacement()` — Replace stages sequentially
- `animateHealthPulse(statuses, renderDot)` — Signature animation
- `spinner(label)` — Last resort (use sparingly)

**Design Principle:** Motion represents observable work. Every update is honest and measurable.

---

### `renderer.js` — The Presentation Heart

Commands describe WHAT to show. Renderer decides HOW.

**Responsibilities:**
- Compose UI components into screens
- Route screen types (launch, standard, error, success, empty)
- Manage terminal output (no direct console.log allowed)
- Provide snapshot functionality for testing
- Handle animated rendering
- Batch operations for performance

**Key Functions:**
- `render(content)` — Primary rendering (commands call this)
- `snapshot(content)` — Testing/documentation snapshots
- `renderAnimated({ screen, healthStatuses })` — Animated launch
- `update(renderFn)` — In-place updates
- `progress({ render, total })` — Progress tracking
- `progressive()` — Multi-stage rendering

**Screen Types:**
```javascript
// Standard screen
render({
  command: 'decode audit',
  context: '— project health',
  content: '...',
  actions: '...'
})

// Launch screen
render({
  type: 'launch',
  content: '...'
})

// Error screen
render({
  type: 'error',
  command: 'decode api check',
  error: '...'
})

// Success screen
render({
  type: 'success',
  command: 'decode doc',
  confirmation: '...',
  metadata: '...',
  suggestion: '...'
})

// Empty state
render({
  type: 'empty',
  command: 'decode api list',
  message: '...',
  actions: '...'
})
```

**Design Principle:** Commands never touch terminal directly. All output flows through renderer.

---

## Integration Pattern

### Before (Old Pattern)
```javascript
import chalk from 'chalk';
import ora from 'ora';

export function myCommand() {
  console.log(chalk.green('✓') + ' Success');
  const spinner = ora('Loading...').start();
  // ...
}
```

### After (Rendering Engine)
```javascript
import * as ui from '../ui/index.js';
import * as renderer from '../ui/renderer.js';

export function myCommand() {
  // Build screen using UI components
  const content = [
    ui.statusRow({ status: 'pass', label: 'api', verdict: '5/5' }),
    ui.space('normal'),
    ui.statusSummary({ passed: 5, warning: 0, critical: 0 })
  ].join('');

  // Render through engine
  renderer.render({
    command: 'decode my-command',
    content
  });
}
```

### With Progress
```javascript
const tracker = renderer.progress({
  render: (current, total) => 
    ui.progressCounter({ label: 'Processing', current, total }),
  total: 500
});

for (let i = 0; i < 500; i++) {
  await processItem(i);
  tracker.tick();
}

tracker.complete();
```

---

## Terminal Engine Benefits

### 1. **Consistency**
Every screen follows the same layout rules. No ad-hoc formatting.

### 2. **Testability**
Snapshots capture rendered output without terminal noise.

```javascript
const snapshot = renderer.snapshot({
  command: 'decode audit',
  content: '...'
});

// Compare against golden snapshot
expect(snapshot).toMatchSnapshot();
```

### 3. **Capability Awareness**
Terminal limitations are handled automatically.

```javascript
if (renderer.supports('unicode')) {
  // Use dots ●○◆
} else {
  // Fall back to ASCII
}
```

### 4. **Performance**
Batch updates prevent flicker. Progress throttling prevents spam.

### 5. **Future-Proof**
- Web renderer: Same components, different output target
- Visual regression testing: Snapshot comparisons
- Documentation: Automated screenshot generation

---

## Motion Patterns

### Pattern 1: Progress Counter
```javascript
const tracker = renderer.progress({
  render: (c, t) => ui.progressCounter({ label: 'Fetching', current: c, total: t }),
  total: 500
});

// Auto-throttled updates (100ms intervals)
tracker.tick();
tracker.complete();
```

### Pattern 2: Scanning
```javascript
const scanner = renderer.scan({
  render: (count) => ui.scanningIndicator('Scanning project', count)
});

files.forEach(file => {
  scanner.increment();
});

scanner.finish();
```

### Pattern 3: Multi-Stage
```javascript
const stages = renderer.progressive();

stages.stage('Scanning project...');
// work
stages.stage('Generating documentation...');
// more work
stages.finish();
```

### Pattern 4: Health Pulse Animation
```javascript
await renderer.renderAnimated({
  screen: { type: 'launch', content: '...' },
  healthStatuses: ['pass', 'pass', 'warn']
});
```

---

## Terminal Capabilities

The engine detects and adapts:

| Capability | Detection | Fallback |
|------------|-----------|----------|
| TTY | `process.stdout.isTTY` | Static output |
| Width/Height | `process.stdout.columns/rows` | 80×24 default |
| Unicode | `LANG`, `TERM_PROGRAM` | ASCII symbols |
| 256 colors | `TERM`, `COLORTERM` | Basic 8 colors |
| True color | `COLORTERM=truecolor` | 256 colors |
| Interactive | `stdin.isTTY` | Batch mode |

---

## Health Pulse Signature

The Health Pulse is DeCode's visual identity. It appears in:

1. **Launch** — Connection status dots animate on
2. **Status** — Last audit summary with dots
3. **Audit** — Component health matrix
4. **Project Review** — Combined health + activity

Every pulse follows the pattern:
```
●●○  health          2 passed, 1 warning
●    api             5/5 routes passing, avg 23ms
○    docs            stale, last updated 6h ago
●    repo            healthy, last commit 6h ago
```

Users recognize DeCode by the dots at the left edge.

---

## Snapshot System

Every screen is serializable:

```javascript
// Render to terminal
renderer.render(screenConfig);

// Capture snapshot (no ANSI)
const snap = renderer.snapshot(screenConfig);

// Use for:
// - Visual regression tests
// - Documentation screenshots  
// - Design review
// - Golden file comparisons
```

Snapshots strip ANSI codes for clean diffs.

---

## Performance Considerations

### Throttling
Progress updates throttle to 100ms intervals. No spam.

### Batching
```javascript
renderer.batch([
  () => renderer.append(line1),
  () => renderer.append(line2),
  () => renderer.append(line3)
]);
```

Cursor is hidden during batch, prevents flicker.

### Cursor Management
```javascript
terminal.hideCursor();  // Before updates
// ... render operations ...
terminal.showCursor();  // After complete
```

Motion primitives handle this automatically.

---

## Future Enhancements

### Web Renderer
Same UI components, different terminal backend:

```javascript
import * as webRenderer from '../ui/renderer-web.js';

webRenderer.render({
  command: 'decode audit',
  content: '...'
});

// Outputs HTML instead of ANSI
```

### Visual Regression Testing
```bash
npm run test:visual
```

Compares snapshots against golden files.

### Interactive Mode
```javascript
renderer.interactive({
  screens: [launch, status, audit],
  navigation: 'arrows'
});
```

Navigate screens with keyboard.

---

## Design Principles

1. **Commands describe, renderer presents**
   - Commands build content structure
   - Renderer handles layout and output

2. **Observable work only**
   - Progress is measurable
   - Spinners are last resort
   - Every update is honest

3. **Capability-aware**
   - Detect, don't assume
   - Fallback gracefully
   - Work in any terminal

4. **Snapshot-driven development**
   - Every screen is testable
   - Visual regression is automated
   - Documentation is generated

5. **Future-proof architecture**
   - Multiple output targets
   - Composable primitives
   - Zero coupling to terminal

---

## Command Integration Checklist

When updating a command to use the rendering engine:

- [ ] Remove all `console.log()` / `console.error()`
- [ ] Remove direct `chalk` imports
- [ ] Remove `ora` / spinner usage
- [ ] Import `* as ui from '../ui/index.js'`
- [ ] Import `* as renderer from '../ui/renderer.js'`
- [ ] Build content using UI components
- [ ] Call `renderer.render()` with screen config
- [ ] Use `renderer.progress()` for long operations
- [ ] Test with `renderer.snapshot()` in tests

---

## Files

```
src/ui/
├── terminal.js       — Terminal capability abstraction (267 lines)
├── motion.js         — Animation primitives (276 lines)
├── renderer.js       — Presentation engine (278 lines)
├── theme.js          — Design tokens
├── typography.js     — Text styling
├── layout.js         — Spacing/alignment
├── icons.js          — Dot language
├── status.js         — Status indicators
├── health-pulse.js   — Health displays
├── table.js          — Data tables
├── panel.js          — Bordered containers
├── divider.js        — Section breaks
├── progress.js       — Progress displays
├── prompt.js         — Interactive prompts
├── screen.js         — Screen layouts
├── index.js          — Public API
└── README.md         — Component docs

examples/
├── ui-showcase.js    — Living design reference
└── README.md         — Showcase docs
```

Total: ~3,000 lines of production-grade rendering infrastructure.

---

The DeCode Terminal Rendering Engine is complete and ready for command integration.
