/**
 * src/services/auditRunner.js
 * Composes the API, docs, and repo-health checks into one audit result
 * (PRD story 4, AC1). Reuses the existing services directly — no duplicated
 * logic, no subprocess shell-outs.
 *
 * Status model: each component is 'pass' | 'fail' | 'skipped'. Only 'fail'
 * affects the summary's `ok`. Skipped means the component isn't applicable
 * (e.g. no routes configured, not a git repo) and is reported with a reason.
 */
import { checkRoutes, summarize } from './apiChecker.js';
import { checkDocStaleness } from './docStaleness.js';
import { checkRepoHealth } from './repoHealth.js';
import { resolveBackendBaseUrl, scanRoutes } from './routeDetector.js';

/**
 * @param {{ cwd?: string }} options
 * @returns {Promise<{ api: object, docs: object, repo: object, summary: object }>}
 */
export async function runAudit({ cwd } = {}) {
  const [api, docs, repo] = await Promise.all([
    runApiCheck({ cwd }),
    runDocsCheck({ cwd }),
    runRepoCheck({ cwd }),
  ]);

  const components = [api, docs, repo];
  const failed = components.filter((c) => c.status === 'fail').length;
  const skipped = components.filter((c) => c.status === 'skipped').length;

  return {
    api,
    docs,
    repo,
    summary: {
      total: components.length,
      passed: components.length - failed - skipped,
      failed,
      skipped,
      ok: failed === 0,
    },
  };
}

async function runApiCheck({ cwd }) {
  const scan = scanRoutes({ cwd });
  if (!scan.routes.length) {
    return { name: 'api', status: 'skipped', detail: 'no backend routes detected' };
  }

  const base = await resolveBackendBaseUrl({ cwd });
  if (!base) {
    return { name: 'api', status: 'skipped', detail: 'no reachable backend — set PORT in .env' };
  }

  const staticRoutes = scan.routes.filter((r) => !r.hasParams);
  if (staticRoutes.length === 0) {
    return { name: 'api', status: 'skipped', detail: 'all detected routes are dynamic — no live checks possible' };
  }

  const routes = staticRoutes.map((r) => `${base.replace(/\/+$/, '')}${r.path.startsWith('/') ? r.path : `/${r.path}`}`);
  const results = await checkRoutes(routes);
  const s = summarize(results);
  if (s.ok) {
    return { name: 'api', status: 'pass', detail: `${s.total} route${s.total === 1 ? '' : 's'} OK` };
  }

  const failed = results.filter((r) => !r.ok);
  const detail = `${s.failed} of ${s.total} route${s.total === 1 ? '' : 's'} failed: ${failed
    .map((r) => `${r.route} (${r.diagnoses[0] || 'error'})`)
    .join('; ')}`;
  return { name: 'api', status: 'fail', detail };
}

function runDocsCheck({ cwd }) {
  const result = checkDocStaleness({ cwd });
  if (!result.stale) {
    return { name: 'docs', status: 'pass', detail: 'documentation is up to date' };
  }
  if (result.staleSources.length === 0) {
    return { name: 'docs', status: 'fail', detail: 'no documentation found' };
  }
  return {
    name: 'docs',
    status: 'fail',
    detail: `stale: ${result.staleSources.join(', ')} ${result.staleSources.length === 1 ? 'was' : 'were'} modified after the docs`,
  };
}

function runRepoCheck({ cwd }) {
  return checkRepoHealth({ cwd });
}
