/**
 * test/unit/projectScanner.test.js
 * Unit tests for the read-only project scanner.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { scanProject } from '../../src/services/projectScanner.js';

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-scan-'));
  fs.mkdirSync(path.join(tmp, 'src', 'services'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'node_modules'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '.git'), { recursive: true });

  fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"demo","version":"1.0.0"}');
  fs.writeFileSync(path.join(tmp, 'src', 'index.js'), 'console.log("hi");');
  fs.writeFileSync(path.join(tmp, 'src', 'services', 'x.js'), 'export const x = 1;');
  fs.writeFileSync(path.join(tmp, 'node_modules', 'junk.js'), 'should be ignored');
  fs.writeFileSync(path.join(tmp, 'docs', 'architecture.md'), 'should be ignored');
  fs.writeFileSync(path.join(tmp, '.env'), 'SECRET=never');
  fs.writeFileSync(path.join(tmp, '.git', 'config'), '[core]');
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('scanProject', () => {
  it('returns the tree excluding generated/private directories', () => {
    const { tree } = scanProject({ cwd: tmp });
    expect(tree).toContain('package.json');
    expect(tree).toContain('src/index.js');
    expect(tree).toContain('src/services/x.js');
    expect(tree).not.toContain('node_modules/junk.js');
    expect(tree).not.toContain('docs/architecture.md');
    expect(tree).not.toContain('.env');
    expect(tree).not.toContain('.git/config');
  });

  it('samples key source files with real content', () => {
    const { keyFiles } = scanProject({ cwd: tmp });
    const pkg = keyFiles.find((f) => f.path === 'package.json');
    const src = keyFiles.find((f) => f.path === 'src/index.js');
    expect(pkg.content).toContain('demo');
    expect(src.content).toContain('console.log("hi")');
  });
});
