/**
 * src/services/projectScanner.js
 * Read-only project scanner — builds a file tree and samples key source files
 * so the Doc Generator skill can see real project structure and content.
 * Fully autonomous (read-only); no writes ever happen here.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Directories always excluded from the scan (generated/private/vendored). */
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.env',
  '.remember',
  '.claude',
  'coverage',
  'dist',
  'build',
  'docs',
  '.github',
]);

/** File extensions considered "key source" for documentation purposes. */
const KEY_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json']);

/** Per-file and total content caps keep the LLM prompt bounded. */
const MAX_FILE_BYTES = 10000;
const MAX_TOTAL_BYTES = 50000;

/**
 * Walks the project and returns its file tree + sampled key-file contents.
 * @param {{ cwd?: string }} options
 * @returns {{ root: string, tree: string[], keyFiles: { path: string, content: string }[] }}
 */
export function scanProject({ cwd } = {}) {
  const root = cwd || process.cwd();
  const tree = [];
  const keyFiles = [];
  let totalBytes = 0;

  const walk = (dir, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir — skip
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        if (isExcludedFile(entry.name)) continue; // e.g. .env — never scan secrets
        tree.push(relPath);
        if (isKeyFile(relPath)) {
          const content = readCapped(fullPath);
          if (content !== null && totalBytes + content.length <= MAX_TOTAL_BYTES) {
            totalBytes += content.length;
            keyFiles.push({ path: relPath, content });
          }
        }
      }
    }
  };

  walk(root, '');
  tree.sort();
  return { root, tree, keyFiles };
}

function isExcludedFile(name) {
  return name === '.env';
}

function isKeyFile(relPath) {
  const base = path.basename(relPath);
  if (relPath === 'package.json' || relPath === 'README.md') return true;
  if (!relPath.includes('/')) return false; // root-level file, already covered above
  if (!/^(src|bin|lib)\//.test(relPath)) return false;
  return KEY_EXTENSIONS.has(path.extname(base));
}

function readCapped(fullPath) {
  try {
    const stat = fs.statSync(fullPath);
    if (stat.size > MAX_FILE_BYTES) return null; // skip oversized files entirely
    return fs.readFileSync(fullPath, 'utf8');
  } catch {
    return null;
  }
}
