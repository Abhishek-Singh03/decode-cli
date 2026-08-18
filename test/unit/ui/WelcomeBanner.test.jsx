import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import WelcomeBanner, { TIPS, WHATS_NEW } from '../../../src/ui/ink/WelcomeBanner.jsx';

const configuredConfig = { llm: { provider: 'claude' } };
const freshConfig = { llm: { provider: null } };

describe('WelcomeBanner', () => {
  it('renders figlet logo art for /›‹', () => {
    const { lastFrame } = render(
      <WelcomeBanner config={configuredConfig} cwd="/home/user/my-project" />
    );
    expect(lastFrame()).toContain('██╗');
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
