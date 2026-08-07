/**
 * src/commands/api.js
 * `decode api` group — auto-detected route discovery and health checks (PRD
 * story 1, redesigned).
 *
 * Subcommands: list, check.
 *  - `api list`  scans the project's backend source (Express today) and shows
 *                the detected routes, caching the result in the project-local
 *                config so repeated calls don't rescan. `--refresh` rescans.
 *  - `api check` tests the detected routes against a running backend. The base
 *                URL comes from `--base-url`, else PORT in .env, else a
 *                reachable common dev port. Routes with dynamic segments are
 *                skipped with an explicit note rather than requested blindly.
 *
 * The old manual `api add` / `api remove` flow no longer exists — routes are
 * derived from source, never hand-maintained.
 */
import { Command } from 'commander';
import ora from 'ora';

import { API_CHECK_TIMEOUT_MS } from '../constants.js';
import { checkRoutes, loadSpec } from '../services/apiChecker.js';
import { isBackendReachable, resolveBackendBaseUrl, scanRoutes } from '../services/routeDetector.js';
import * as output from '../utils/output.js';

export function apiCommand() {
  return new Command('api')
    .description('Auto-detect backend API routes and check them against a live server')
    .addCommand(apiListCommand())
    .addCommand(apiCheckCommand());
}

function apiListCommand() {
  return new Command('list')
    .description('Auto-detect backend routes from the project source (cached; --refresh rescans)')
    .option('--refresh', 'Force a fresh scan instead of using the cached result')
    .option('--json', 'Output machine-readable JSON to stdout')
    .action((opts) => {
      try {
        const scan = scanRoutes({ refresh: opts.refresh });

        if (opts.json) {
          output.printJson({ framework: scan.framework, routes: scan.routes, cached: scan.cached, scannedAt: scan.scannedAt });
          return;
        }

        if (!scan.framework) {
          output.info('No supported backend framework detected (currently Express).');
          return;
        }

        output.heading(`Backend framework: ${scan.framework}${scan.cached ? ' (cached — `decode api list --refresh` to rescan)' : ''}`);
        if (scan.routes.length === 0) {
          output.info('No routes detected. Add some to the source and re-run with `--refresh`.');
          return;
        }

        output.printTable(
          ['#', 'Method', 'Path', 'Source', 'Flags'],
          scan.routes.map((r, i) => [
            String(i + 1),
            r.method.toUpperCase(),
            r.path,
            `${r.file}:${r.line}`,
            r.hasParams ? '⚠ has params' : '',
          ]),
        );
        output.dim(`${plural(scan.routes.length, 'route')} detected — run \`decode api check\` to test them.`);
      } catch (err) {
        output.error(`api list failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

function apiCheckCommand() {
  return new Command('check')
    .description('Check detected API routes against a running backend')
    .argument('[paths...]', 'Optional path filters (substring match on route paths)')
    .option('--base-url <url>', 'Backend base URL (defaults to PORT in .env, then common dev ports)')
    .option('--spec <path|url>', 'OpenAPI spec (file path or URL) to validate responses against')
    .option('--json', 'Output machine-readable JSON to stdout')
    .option('--ci', 'CI-friendly minimal output and strict exit code')
    .option('--refresh', 'Force a fresh route scan')
    .action(async (pathFilters, opts) => {
      try {
        const scan = scanRoutes({ refresh: opts.refresh });
        const filters = (pathFilters || []).filter(Boolean).map((f) => f.trim().toLowerCase());
        const selected = scan.routes.filter(
          (r) => filters.length === 0 || filters.some((f) => r.path.toLowerCase().includes(f)),
        );

        if (selected.length === 0) {
          output.error(`No API routes detected${filters.length ? ` matching "${pathFilters.join(', ')}"` : ''}. Run \`decode api list\` first.`);
          process.exitCode = 1;
          return;
        }

        const base = await resolveBackendBaseUrl({ baseUrl: opts.baseUrl });
        if (!base) {
          output.error('Could not determine the backend base URL. Set PORT in your .env or pass --base-url <url>.');
          process.exitCode = 1;
          return;
        }

        if (!(await isBackendReachable(base))) {
          output.error(`Backend not reachable at ${base} — is it running?`);
          process.exitCode = 1;
          return;
        }

        const spec = opts.spec ? await loadSpec(opts.spec) : null;

        const useSpinner = !opts.json && !opts.ci && process.stdout.isTTY;
        const spinner = useSpinner
          ? ora(`Checking ${plural(selected.length, 'route')} against ${base}...`).start()
          : null;

        let results;
        try {
          results = await runChecks(selected, base, { spec });
        } finally {
          if (spinner) spinner.stop();
        }

        const summary = summarizeResults(results);

        if (opts.json) {
          output.printJson({ baseUrl: base, summary, results });
        } else if (opts.ci) {
          printCiResults(results, summary);
        } else {
          printHumanResults(results, summary);
        }

        if (summary.failed > 0) process.exitCode = 1;
      } catch (err) {
        output.error(`api check failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

/** Runs live checks on static routes; dynamic routes are skipped, not requested. */
async function runChecks(selected, base, { spec }) {
  const staticRoutes = selected.filter((r) => !r.hasParams);
  const paramRoutes = selected.filter((r) => r.hasParams);

  const urls = staticRoutes.map((r) => fullUrlFor(r, base));
  const checked = urls.length ? await checkRoutes(urls, { spec, timeoutMs: API_CHECK_TIMEOUT_MS }) : [];

  const results = staticRoutes.map((r, i) => ({
    ...checked[i],
    method: r.method,
    path: r.path,
  }));
  for (const r of paramRoutes) {
    results.push({
      route: fullUrlFor(r, base),
      method: r.method,
      path: r.path,
      skipped: true,
      status: null,
      responseTimeMs: null,
      ok: true,
      diagnoses: ['skipped — dynamic param, no test data'],
    });
  }
  return results;
}

function fullUrlFor(route, base) {
  const baseClean = base.replace(/\/+$/, '');
  const pathPart = route.path.startsWith('/') ? route.path : `/${route.path}`;
  return `${baseClean}${pathPart}`;
}

function summarizeResults(results) {
  const failed = results.filter((r) => !r.ok).length;
  const skipped = results.filter((r) => r.skipped).length;
  return {
    total: results.length,
    passed: results.length - failed - skipped,
    failed,
    skipped,
    ok: failed === 0,
  };
}

function printHumanResults(results, summary) {
  output.printTable(
    ['Route', 'Status', 'Time', 'Result'],
    results.map((r) => [
      r.skipped ? `${r.route} (${r.method.toUpperCase()})` : r.route,
      r.status === null ? '—' : String(r.status),
      r.responseTimeMs == null ? '—' : `${r.responseTimeMs}ms`,
      r.skipped ? '⚠ skipped — dynamic param, no test data' : r.ok ? 'PASS' : 'FAIL',
    ]),
  );

  const failures = results.filter((r) => !r.ok && !r.skipped);
  if (failures.length > 0) {
    output.heading('Diagnosis');
    for (const r of failures) {
      output.error(`${r.route}: ${r.diagnoses.join('; ')}`);
    }
    output.error(`${failures.length} of ${summary.total} routes failed.`);
  } else {
    output.success(`All ${plural(summary.total - summary.skipped, 'route')} checked passed${summary.skipped ? ` (${summary.skipped} skipped — dynamic params)` : ''}.`);
  }
}

function printCiResults(results, summary) {
  for (const r of results) {
    if (r.skipped) {
      output.plain(`SKIP ${r.route} — dynamic param, no test data`);
    } else {
      const status = r.status === null ? '—' : String(r.status);
      const time = `${r.responseTimeMs}ms`;
      if (r.ok) {
        output.plain(`PASS ${status} ${time} ${r.route}`);
      } else {
        output.plain(`FAIL ${status} ${time} ${r.route} — ${r.diagnoses.join('; ')}`);
      }
    }
  }
  output.plain(`Summary: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped`);
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}