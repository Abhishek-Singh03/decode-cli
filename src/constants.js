/**
 * src/constants.js
 * Shared constants: command identity, package version, exit codes, defaults.
 */
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

export const NAME = 'decode';
export const DESCRIPTION = packageJson.description;
export const VERSION = packageJson.version;

export const EXIT_CODES = {
  OK: 0,
  ERROR: 1,
};

/** Default per-request timeout for API health checks (ms). */
export const API_CHECK_TIMEOUT_MS = 10000;

export const CONFIG_FILE_NAME = 'decode.config.json';
export const ENV_FILE_NAME = '.env';
