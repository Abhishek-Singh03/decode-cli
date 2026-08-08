/**
 * test/setup.js
 * Vitest `setupFiles` entry — makes the whole suite hermetic with respect to the
 * machine-wide global config store.
 *
 * DeCode's config store reads `~/.decode` by default. On a real developer
 * machine that directory holds live credentials (API keys, tokens), so tests
 * must NEVER read it: doing so makes CI depend on the runner's home directory
 * and can accidentally fire real network/LLM requests. Pointing the global dir
 * at an empty temp directory here means every test file starts with a clean
 * global tier; individual tests that need a specific global fixture override
 * `DECODE_GLOBAL_CONFIG_DIR` in their own beforeEach (as the integration tests
 * already do).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DECODE_GLOBAL_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-global-test-'));
