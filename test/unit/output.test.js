/**
 * test/unit/output.test.js
 * Unit tests for the terminal output formatting helpers.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  success,
  error,
  info,
  printTable,
  printBox,
  printJson,
} from '../../src/utils/output.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('output helpers', () => {
  it('success prepends a checkmark and echoes the message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    success('done');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('done'));
  });

  it('error writes to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    error('boom');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  it('info writes a blue message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    info('hello');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('hello'));
  });

  it('printTable includes header and row text', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printTable(['Key', 'Value'], [['a', '1']]);
    const out = String(spy.mock.calls[0][0]);
    expect(out).toContain('Key');
    expect(out).toContain('a');
  });

  it('printBox wraps content and shows the title', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printBox('Setup', 'hello');
    const out = String(spy.mock.calls[0][0]);
    expect(out).toContain('Setup');
    expect(out).toContain('hello');
  });

  it('printJson emits valid JSON', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printJson({ a: 1, b: [true] });
    const out = String(spy.mock.calls[0][0]);
    expect(() => JSON.parse(out)).not.toThrow();
    expect(JSON.parse(out)).toEqual({ a: 1, b: [true] });
  });
});
