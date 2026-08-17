#!/usr/bin/env -S node --import tsx/esm
/**
 * DeCode CLI entry point.
 * Bootstrapping (commander registration + argument parsing) lives in
 * src/index.js; this file only needs to pull it in.
 *
 * `--import tsx/esm` registers tsx as a Node ESM loader hook so that the
 * Ink session path can dynamically `import()` `.jsx` files at runtime
 * (Vitest handles JSX via @vitejs/plugin-react, but the plain CLI needs
 * tsx to do the same transform outside the test runner).
 */
import '../src/index.js';
