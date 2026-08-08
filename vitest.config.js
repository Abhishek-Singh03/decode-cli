import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    // Hermetic global config: sets DECODE_GLOBAL_CONFIG_DIR to an empty temp dir
    // so no test ever reads a real ~/.decode (see test/setup.js).
    setupFiles: ['./test/setup.js'],
    // execa integration tests spawn the real CLI as a subprocess and can slow
    // down under parallel full-suite load; be generous.
    testTimeout: 60000,
  },
});
