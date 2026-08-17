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
