// vitest.config.js
import { defineConfig, defaultExclude } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Point every test at a throwaway global config dir so we never read the
    // real ~/.decode. Without this, test/setup.js is dead code and the suite
    // can leak into the developer's real config.
    setupFiles: ['./test/setup.js'],
    // This repo nests two parallel git worktrees inside it
    // (.claude/worktrees/ink-session-ui and .worktrees/ink-session-ui). By
    // default Vitest's glob recurses into them and runs duplicate copies of
    // same-named test files, inflating/duplicating every run. Exclude them.
    exclude: [...defaultExclude, '**/.claude/**', '**/.worktrees/**'],
  },
});
