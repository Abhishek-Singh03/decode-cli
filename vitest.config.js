import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    // execa integration tests spawn the real CLI as a subprocess.
    testTimeout: 20000,
  },
});
