/**
 * src/services/docStaleness.js
 * `decode doc check` — data-driven staleness detection (PRD story 3, AC4).
 *
 * Heuristic: documentation (docs/** + README.md) is considered stale when any
 * source file (src/**, bin/**, package.json) was modified after the newest
 * doc. No LLM involved; nothing is fabricated.
 */
import fs from 'node:fs';
import path from 'node:path';

const DOC_DIRS = ['docs'];
const SOURCE_GLOBS = ['src', 'bin'];

/**
 * @param {{ cwd?: string }} options
 * @returns {{ stale: boolean, docFiles: string[], staleSources: string[], lastDocUpdate: string|null }}
 */
export function checkDocStaleness({ cwd } = {}) {
  const root = cwd || process.cwd();

  const docFiles = findFiles(root, DOC_DIRS, { root: true });
  const sourceFiles = findFiles(root, SOURCE_GLOBS, { includeRoot: ['package.json'] });

  let lastDocUpdate = null;
  for (const file of docFiles) {
    const mtime = fs.statSync(path.join(root, file)).mtimeMs;
    if (lastDocUpdate === null || mtime > lastDocUpdate) lastDocUpdate = mtime;
  }

  if (docFiles.length === 0) {
    return { stale: true, docFiles, staleSources: [], lastDocUpdate: null };
  }

  const staleSources = sourceFiles.filter((file) => {
    const mtime = fs.statSync(path.join(root, file)).mtimeMs;
    return mtime > lastDocUpdate;
  });

  return {
    stale: staleSources.length > 0,
    docFiles,
    staleSources,
    lastDocUpdate: lastDocUpdate === null ? null : new Date(lastDocUpdate).toISOString(),
  };
}

/** Collects files under the given dirs (recursively) plus explicit root files. */
function findFiles(root, dirs, { includeRoot = [] } = {}) {
  const files = [];
  for (const dir of dirs) {
    collectFiles(path.join(root, dir), dir, files);
  }
  for (const file of includeRoot) {
    if (fs.existsSync(path.join(root, file))) files.push(file);
  }
  return files.sort();
}

function collectFiles(dir, rel, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // dir missing/unreadable — not an error
  }
  for (const entry of entries) {
    const relPath = `${rel}/${entry.name}`;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      collectFiles(fullPath, relPath, out);
    } else if (entry.isFile()) {
      out.push(relPath);
    }
  }
}
