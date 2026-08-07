/**
 * src/ui/README.md
 * DeCode UI Framework Documentation
 *
 * This directory contains the complete UI system for DeCode.
 * Every screen in DeCode is built from these reusable primitives.
 */

# DeCode UI Framework

A component-based terminal UI system implementing the DeCode Design System.

## Philosophy

1. **Verdict-first layouts** — Truth at top, evidence below, actions at bottom
2. **Whitespace creates hierarchy** — Dense = urgent, sparse = calm
3. **Dots are the visual signature** — `●○◆` form scannable patterns
4. **Typography establishes importance** — Bold = critical, dim = metadata
5. **Colors are semantic** — Green = healthy, yellow = warning, red = critical

## Architecture

```
theme.js          — Design tokens (colors, spacing, typography scales)
typography.js     — Text styling primitives
layout.js         — Spacing and alignment primitives
icons.js          — Dot language and symbols

status.js         — Status dots and health indicators
health-pulse.js   — Compact multi-status displays
table.js          — Structured data display
panel.js          — Bordered containers (rare)
divider.js        — Section breaks (sparse)
progress.js       — Long-running task feedback
prompt.js         — Interactive decisions and hints
screen.js         — Top-level layout structure

index.js          — Public API (import from here)
```

## Usage

### Import Pattern

```javascript
import * as ui from '../ui/index.js';
```

All components are available through the `ui` namespace.

### Basic Screen Structure

Every DeCode screen follows this pattern:

```javascript
const output = ui.screen({
  command: 'decode audit',
  context: '— project health',
  content: '...',  // Main screen content
  actions: '...'   // Optional next steps
});

console.log(output);
```

### Typography

```javascript
ui.title('Screen Title')           // Bold, large
ui.body('Default text')            // Normal weight
ui.metadata('Supporting info')     // Dim, smaller
ui.emphasis('42')                  // Bold numbers/values
ui.interactive('→ decode audit')   // Cyan actions
ui.success('Success message')      // Green
ui.error('Error message')          // Red, bold
ui.warning('Warning message')      // Yellow
```

### Status Indicators

```javascript
// Single status dot
ui.statusDot('pass')    // Green ●
ui.statusDot('warn')    // Yellow ○
ui.statusDot('fail')    // Red ◆

// Status row (audit/health display)
ui.statusRow({
  status: 'pass',
  label: 'api',
  verdict: '5/5 routes passing',
  detail: 'avg 23ms'
})

// Status summary line
ui.statusSummary({
  passed: 2,
  warning: 1,
  critical: 0
})
// Output: "2 passed · 1 warning · 0 critical"

// Compact dots (for overviews)
ui.statusDots(['pass', 'pass', 'warn'])
// Output: "●●○"
```

### Health Pulse Components

```javascript
// Health overview
ui.healthPulse({
  label: 'health',
  items: [
    { status: 'pass', name: 'api', detail: '5/5 passing' },
    { status: 'warn', name: 'docs', detail: 'stale' },
    { status: 'pass', name: 'repo', detail: 'healthy' }
  ],
  summary: '2 passed, 1 warning'
})

// Activity summary
ui.activityPulse({
  label: 'activity',
  commits: 47,
  contributors: 3,
  pattern: '●●●○○●●',
  peak: 'aug 5 — 12 commits'
})

// Connection status
ui.connectionPulse({
  services: [
    { name: 'anthropic', connected: true },
    { name: 'github', connected: true }
  ]
})
```

### Tables

```javascript
// Simple table
ui.table({
  headers: ['Route', 'Status', 'Time'],
  rows: [
    ['https://api.example.com/users', '200', '18ms'],
    ['https://api.example.com/posts', '200', '24ms']
  ]
})

// Key-value list (for status displays)
ui.keyValueList([
  { label: 'LLM provider', value: 'anthropic' },
  { label: 'GitHub configured', value: 'yes' }
])

// Contributor table
ui.contributorTable([
  { login: 'phewww', count: 32 },
  { login: 'contributor2', count: 9 }
])
```

### Panels

```javascript
// Documentation preview
ui.docPreview(markdown, maxLines)

// AI summary (no border, just indented prose)
ui.aiSummary('The repository shows consistent daily activity...')

// Generic bordered panel
ui.panel({
  title: 'Generated documentation preview',
  content: '...',
  truncate: true
})
```

### Progress Indicators

```javascript
// Progress counter (for known totals)
ui.progressCounter({
  label: 'Fetching commits',
  current: 347,
  total: 500
})

// Scanning indicator (unknown total)
ui.scanningIndicator('Scanning project', 78)

// Auto-updating progress
const update = ui.createProgressUpdater('Processing', 500);
update(100);  // Updates in-place
update(250);
ui.finishProgress();  // Move to next line
```

### Prompts & Actions

```javascript
// Next action suggestions
ui.nextActions([
  { command: 'decode audit', description: 'run full check' },
  { command: 'decode api check', description: 'check routes only' }
])

// Approval options
ui.actionOptions([
  { key: 'y', description: 'write file' },
  { key: 'n', description: 'cancel' },
  { key: 'e', description: 'edit prompt and regenerate' }
])

// Error with recovery actions
ui.errorPrompt({
  type: 'Network unreachable',
  explanation: 'All 5 routes failed to respond...',
  actions: [
    { command: 'decode api list', description: 'show configured routes' }
  ]
})

// Warning with optional action
ui.warningPrompt({
  message: 'Documentation is out of sync...',
  impact: "This won't block your workflow...",
  action: { command: 'decode doc', description: 'regenerate' }
})
```

### Layout & Spacing

```javascript
// Vertical spacing
ui.space('tight')    // 1 line
ui.space('normal')   // 2 lines (default)
ui.space('loose')    // 3 lines (empty states)
ui.space(5)          // Custom line count

// Indentation
ui.indent(text, 1)   // Indent by 1 level (3 spaces)

// Alignment
ui.alignRow('Left text', 'Right text', 80)
ui.pad('text', 20, 'right')  // Pad to width

// Text wrapping
ui.wrap(text, 70)    // Wrap to max width
```

## Design Tokens

Access theme values directly:

```javascript
import { spacing, colors, layout } from '../ui/theme.js';

spacing.normal    // 2 (lines)
spacing.tight     // 1
spacing.loose     // 3

colors.healthy    // 'green'
colors.warning    // 'yellow'
colors.critical   // 'red'

layout.maxWidth       // 80
layout.indentSize     // 3
```

## Screen Types

Different screen types are pre-composed:

```javascript
// Standard screen
ui.screen({ command, context, content, actions })

// Launch screen (no header)
ui.launchScreen(content)

// Empty state
ui.emptyScreen({ command, message, actions })

// Error screen
ui.errorScreen({ command, error })

// Success screen
ui.successScreen({ command, confirmation, metadata, suggestion })
```

## Examples

### Audit Screen

```javascript
import * as ui from '../ui/index.js';

const items = [
  { status: 'pass', label: 'api', verdict: '5/5 routes passing', detail: 'avg 23ms' },
  { status: 'warn', label: 'docs', verdict: 'stale', detail: 'src/api.js modified 2h ago' },
  { status: 'pass', label: 'repo', verdict: 'healthy', detail: 'last commit 6h ago' }
];

const content = [
  ui.statusList(items),
  ui.space('normal'),
  ui.statusSummary({ passed: 2, warning: 1, critical: 0 })
].join('');

console.log(ui.screen({
  command: 'decode audit',
  context: '— project health',
  content
}));
```

### Launch Screen

```javascript
const services = [
  { name: 'anthropic', connected: true },
  { name: 'github', connected: true }
];

const content = [
  ui.brand('decode'),
  ui.connectionPulse({ services }),
  ui.space('tight'),
  ui.metadata('Last audit   ●  2 passed, 1 warning — 6h ago'),
  ui.metadata('Config       /Users/dev/project/decode.config.json'),
  ui.space('normal'),
  ui.readyState()
].join('\n');

console.log(ui.launchScreen(content));
```

## Guidelines

### Do

- Use `ui.screen()` for consistent structure
- Use dots (`●○◆`) for all status displays
- Use `ui.space()` for vertical rhythm
- Use `ui.statusRow()` for health checks
- Use semantic typography (`ui.emphasis()` for numbers)
- Keep actions at the bottom with `ui.nextActions()`

### Don't

- Don't create custom colored text outside the typography system
- Don't add borders/boxes except via `ui.panel()` (use sparingly)
- Don't use spinners — prefer `ui.progressCounter()`
- Don't mix different status indicators (stick to dots)
- Don't create ad-hoc spacing (use `ui.space()`)
- Don't announce AI features — let them flow naturally

## Integration

To adopt the UI framework in a command:

1. Import: `import * as ui from '../ui/index.js';`
2. Build content using UI components
3. Wrap in `ui.screen()` structure
4. Replace `console.log` statements with single output

See integration examples in `/docs/ui-integration-examples.md` (coming soon).
