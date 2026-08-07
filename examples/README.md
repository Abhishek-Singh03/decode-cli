# DeCode UI Showcase

Living design reference for the DeCode Design System.

## Purpose

This is NOT a demo or prototype. This is the **single source of truth** for how DeCode looks and behaves.

Every screen state, every component, every interaction pattern is rendered here. Think of this as Storybook for DeCode.

## Usage

```bash
# View all screens
node examples/ui-showcase.js

# View specific screen
node examples/ui-showcase.js launch
node examples/ui-showcase.js status
node examples/ui-showcase.js audit
node examples/ui-showcase.js api
node examples/ui-showcase.js github
node examples/ui-showcase.js doc
node examples/ui-showcase.js error
node examples/ui-showcase.js warning
node examples/ui-showcase.js success
node examples/ui-showcase.js empty
node examples/ui-showcase.js progress
node examples/ui-showcase.js review
```

## Available Screens

1. **Launch** — First screen, connection status, ready state
2. **Status** — Configuration overview, last audit summary
3. **Audit** — Project health check with component statuses
4. **API Check** — Route health monitoring with timing
5. **GitHub Analysis** — Repository activity with AI summary
6. **Documentation** — Doc generation preview with approval
7. **Error** — Critical failure with recovery actions
8. **Warning** — Non-blocking issues with suggestions
9. **Success** — Completion confirmation with metadata
10. **Empty State** — No data yet, invitation to start
11. **Progress** — Long-running task with measurable progress
12. **Project Review** — Meta view combining health + activity

## Design Validation

Use this showcase to:

- **Visual regression testing** — Compare snapshots across changes
- **Terminal compatibility** — Test rendering in different terminals
- **Design review** — Show stakeholders the actual UI
- **Documentation** — Screenshot reference for design docs
- **Onboarding** — New contributors see the visual language

## Integration Testing

Each screen can be rendered through the renderer:

```javascript
import * as renderer from '../src/ui/renderer.js';
import { renderAudit } from './ui-showcase.js';

// Render to terminal
renderer.render(renderAudit());

// Snapshot for testing
const snapshot = renderer.snapshot(renderAudit());
```

## Guidelines

### When Adding New Screens

1. Add render function following existing patterns
2. Register in `screens` object
3. Use only UI framework components (no raw chalk/console)
4. Test in multiple terminal emulators
5. Verify accessibility with screen readers

### When Modifying Screens

1. Update showcase first (design source of truth)
2. Validate visual consistency across all screens
3. Check spacing follows design system (2-line gaps, etc.)
4. Ensure dot language is used correctly
5. Run full showcase to check for regressions

## Visual Identity Checklist

Every screen should exhibit:

- ✓ Dots at left edge for status (`●○◆`)
- ✓ 2-line gap after command header
- ✓ Metadata in dim gray
- ✓ Numbers bold in summaries
- ✓ Actions prefixed with `→`
- ✓ Consistent spacing rhythm
- ✓ No color backgrounds
- ✓ Max 3 levels of hierarchy

## Terminal Compatibility

Tested terminals:

- macOS Terminal.app
- iTerm2
- Ghostty
- VS Code integrated terminal
- Linux terminal emulators

Known limitations:

- Dot symbols require Unicode support
- Progress updates require TTY
- Colors degrade gracefully in limited environments

## Future Enhancements

- [ ] Web renderer for documentation
- [ ] Automated visual regression tests
- [ ] Screenshot generation for docs
- [ ] Interactive mode (arrow keys to navigate screens)
- [ ] Export to SVG/PNG
- [ ] Dark/light theme variants
