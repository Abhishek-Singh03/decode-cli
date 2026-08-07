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
 * Walks the project directory calling `visitFile(relPath, fullPath)` for every
 * non-excluded file. Shared by scanProject and routeDetector so the traversal
 * rules (excluded dirs, excluded files) live in one place.
 * @param {string} root absolute directory to walk
 * @param {(relPath: string, fullPath: string) => void} visitFile
 * @param {{ excludedDirs?: Set<string>, excludedFile?: (name: string) => boolean }} options
 */
export function walkFiles(root, visitFile, options = {}) {
  const excludedDirs = options.excludedDirs || EXCLUDED_DIRS;
  const excluded = options.excludedFile || isExcludedFile;

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
        if (excludedDirs.has(entry.name)) continue;
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        if (excluded(entry.name)) continue; // e.g. .env — never scan secrets
        visitFile(relPath, fullPath);
      }
    }
  };

  walk(root, '');
}

/**
 * Lists the project's JavaScript source files (relative paths, sorted), reusing
 * the same traversal rules as scanProject. Route detection consumes this so it
 * never writes its own walker.
 * @param {{ cwd?: string }} options
 */
export function listSourceFiles({ cwd } = {}) {
  const root = cwd || process.cwd();
  const files = [];
  walkFiles(root, (relPath) => {
    const ext = path.extname(relPath);
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') files.push(relPath);
  });
  files.sort();
  return files;
}

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

  walkFiles(root, (relPath, fullPath) => {
    tree.push(relPath);
    if (isKeyFile(relPath)) {
      const content = readCapped(fullPath);
      if (content !== null && totalBytes + content.length <= MAX_TOTAL_BYTES) {
        totalBytes += content.length;
        keyFiles.push({ path: relPath, content });
      }
    }
  });

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
