/**
 * test/unit/docStaleness.test.js
 * Unit tests for the doc staleness heuristic (deterministic via utimesSync).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { checkDocStaleness } from '../../src/services/docStaleness.js';

let tmp;

const DOC_TIME = new Date('2026-08-01T00:00:00Z').getTime();
const OLDER = new Date('2026-07-30T00:00:00Z').getTime();
const NEWER = new Date('2026-08-05T00:00:00Z').getTime();

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-stale-'));
  fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function write(file, at) {
  const full = path.join(tmp, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, 'x');
  fs.utimesSync(full, new Date(at), new Date(at));
  return full;
}

describe('checkDocStaleness', () => {
  it('reports fresh when docs are newer than all sources', () => {
    write('src/index.js', OLDER);
    write('docs/architecture.md', DOC_TIME);
    const result = checkDocStaleness({ cwd: tmp });
    expect(result.stale).toBe(false);
    expect(result.docFiles).toContain('docs/architecture.md');
    expect(result.staleSources).toEqual([]);
  });

  it('reports stale and lists the changed source when a source is newer', () => {
    write('docs/architecture.md', DOC_TIME);
    write('src/index.js', NEWER);
    const result = checkDocStaleness({ cwd: tmp });
    expect(result.stale).toBe(true);
    expect(result.staleSources).toContain('src/index.js');
  });

  it('reports stale when no documentation exists at all', () => {
    write('src/index.js', NEWER);
    const result = checkDocStaleness({ cwd: tmp });
    expect(result.stale).toBe(true);
    expect(result.lastDocUpdate).toBeNull();
  });
});
