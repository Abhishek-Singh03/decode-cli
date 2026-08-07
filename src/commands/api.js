/**
 * src/commands/api.js
 * `decode api` group — route management and health checks (PRD story 1).
 *
 * Subcommands: list, add, remove, check. The check command implements the
 * "API Contract Verifier" skill via src/services/apiChecker.js.
 */
import { Command } from 'commander';
import ora from 'ora';

import { API_CHECK_TIMEOUT_MS } from '../constants.js';
import { checkRoutes, loadSpec, summarize } from '../services/apiChecker.js';
import { addRoute, getRoutes, removeRoute } from '../services/configStore.js';
import * as output from '../utils/output.js';

export function apiCommand() {
  return new Command('api')
    .description('API route management and health checks')
    .addCommand(apiListCommand())
    .addCommand(apiCheckCommand())
    .addCommand(apiAddCommand())
    .addCommand(apiRemoveCommand());
}

function apiListCommand() {
  return new Command('list')
    .description('List configured API routes')
    .action(() => {
      try {
        const routes = getRoutes();
        if (routes.length === 0) {
          output.info('No API routes configured. Add one with `decode api add <url>`.');
          return;
        }
        output.printTable(
          ['#', 'Route'],
          routes.map((route, i) => [String(i + 1), route]),
        );
        output.dim(plural(routes.length, 'route') + ' configured.');
      } catch (err) {
        output.error(`api list failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

function apiAddCommand() {
  return new Command('add')
    .description('Add an API route to the configured list')
    .argument('<url>', 'Route URL (http/https) to add')
    .action((url) => {
      try {
        const routes = addRoute(url);
        output.success(`Route added: ${String(url).trim()}`);
        output.dim(plural(routes.length, 'route') + ' configured.');
      } catch (err) {
        output.error(`api add failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

function apiRemoveCommand() {
  return new Command('remove')
    .description('Remove a configured API route')
    .argument('<url>', 'Route URL to remove')
    .action((url) => {
      try {
        const routes = removeRoute(url);
        output.success(`Route removed: ${String(url).trim()}`);
        output.dim(plural(routes.length, 'route') + ' configured.');
      } catch (err) {
        output.error(`api remove failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

function apiCheckCommand() {
  return new Command('check')
    .description('Check configured API routes and report status, timing, and pass/fail')
    .argument('[routes...]', 'Routes to check (defaults to all configured routes)')
    .option('--json', 'Output machine-readable JSON to stdout')
    .option('--ci', 'CI-friendly minimal output and strict exit code')
    .option('--spec <path|url>', 'OpenAPI spec (file path or URL) to validate responses against')
    .action(async (routeArgs, opts) => {
      try {
        const routes = routeArgs && routeArgs.length > 0 ? routeArgs : getRoutes();
        if (routes.length === 0) {
          output.error('No routes to check. Run `decode api add <url>` or pass routes as arguments.');
          process.exitCode = 1;
          return;
        }

        const spec = opts.spec ? await loadSpec(opts.spec) : null;

        const useSpinner = !opts.json && !opts.ci && process.stdout.isTTY;
        const spinner = useSpinner
          ? ora(`Checking ${plural(routes.length, 'route')}...`).start()
          : null;

        let results;
        try {
          results = await checkRoutes(routes, { spec, timeoutMs: API_CHECK_TIMEOUT_MS });
        } finally {
          if (spinner) spinner.stop();
        }

        const summary = summarize(results);

        if (opts.json) {
          output.printJson({ summary, results });
        } else if (opts.ci) {
          printCiResults(results, summary);
        } else {
          printHumanResults(results, summary);
        }

        if (!summary.ok) process.exitCode = 1;
      } catch (err) {
        output.error(`api check failed: ${err.message}`);
        process.exitCode = 1;
      }
    });
}

function printHumanResults(results, summary) {
  output.printTable(
    ['Route', 'Status', 'Time', 'Result'],
    results.map((r) => [
      r.route,
      r.status === null ? '—' : String(r.status),
      `${r.responseTimeMs}ms`,
      r.ok ? 'PASS' : 'FAIL',
    ]),
  );

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    output.heading('Diagnosis');
    for (const r of failures) {
      output.error(`${r.route}: ${r.diagnoses.join('; ')}`);
    }
    output.error(`${failures.length} of ${summary.total} routes failed.`);
  } else {
    output.success(`All ${plural(summary.total, 'route')} passed.`);
  }
}

function printCiResults(results, summary) {
  for (const r of results) {
    const status = r.status === null ? '—' : String(r.status);
    const time = `${r.responseTimeMs}ms`;
    if (r.ok) {
      output.plain(`PASS ${status} ${time} ${r.route}`);
    } else {
      output.plain(`FAIL ${status} ${time} ${r.route} — ${r.diagnoses.join('; ')}`);
    }
  }
  output.plain(`Summary: ${summary.passed} passed, ${summary.failed} failed`);
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
